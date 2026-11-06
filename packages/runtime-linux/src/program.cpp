#include "program.hpp"

#include <algorithm>
#include <array>
#include <bit>
#include <cstring>
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <vector>
#include <wasmtime.h>

namespace {
template <class T, void (*Destroy)(T *)>
using Handle = std::unique_ptr<T, decltype(Destroy)>;

wasm_engine_t *create_engine() {
  auto *config = wasm_config_new();
  wasmtime_config_wasm_threads_set(config, true);
  wasmtime_config_shared_memory_set(config, true);
  return wasm_engine_new_with_config(config);
}

void check(wasmtime_error_t *error, wasm_trap_t *trap = nullptr) {
  if (!error && !trap) return;
  wasm_name_t message;
  if (error) wasmtime_error_message(error, &message);
  else wasm_trap_message(trap, &message);
  const std::string text(message.data, message.size);
  wasm_name_delete(&message);
  if (error) wasmtime_error_delete(error);
  if (trap) wasm_trap_delete(trap);
  throw std::runtime_error(text);
}

} // namespace

struct Program::Impl {
  Handle<wasm_engine_t, wasm_engine_delete> engine{create_engine(), wasm_engine_delete};
  Handle<wasmtime_module_t, wasmtime_module_delete> module{nullptr, wasmtime_module_delete};
  Handle<wasmtime_store_t, wasmtime_store_delete> store{
      wasmtime_store_new(engine.get(), nullptr, nullptr), wasmtime_store_delete};
  wasmtime_context_t *context = wasmtime_store_context(store.get());
  wasmtime_instance_t instance{};
  Handle<wasmtime_sharedmemory_t, wasmtime_sharedmemory_delete> memory{nullptr, wasmtime_sharedmemory_delete};
  wasmtime_func_t buffer_function{};
  wasmtime_func_t midi_function{};
  std::size_t left = 0;
  std::size_t right = 0;
  std::size_t frames = 0;

  wasmtime_func_t function(const std::string &name, std::size_t parameters) {
    wasmtime_extern_t item;
    if (!wasmtime_instance_export_get(context, &instance, name.data(), name.size(), &item) ||
        item.kind != WASMTIME_EXTERN_FUNC) {
      throw std::runtime_error("Missing WASM function export: " + name);
    }
    const wasmtime_func_t function = item.of.func;
    wasmtime_extern_delete(&item);
    Handle<wasm_functype_t, wasm_functype_delete> type{
        wasmtime_func_type(context, &function), wasm_functype_delete};
    const auto *params = wasm_functype_params(type.get());
    if (params->size != parameters || wasm_functype_results(type.get())->size != 0) {
      throw std::runtime_error("Wrong WASM function signature: " + name);
    }
    for (std::size_t i = 0; i < parameters; ++i) {
      if (wasm_valtype_kind(params->data[i]) != WASM_I32) {
        throw std::runtime_error("MIDI parameters must be i32: " + name);
      }
    }
    return function;
  }

  void call(const wasmtime_func_t &function, std::span<const wasmtime_val_t> args = {}) {
    wasm_trap_t *trap = nullptr;
    auto *error = wasmtime_func_call(context, &function, args.data(), args.size(), nullptr, 0, &trap);
    check(error, trap);
  }
};

Program::Program(const std::string &wasm_path, std::size_t left, std::size_t right, std::size_t frames,
                 const std::string &entry, const std::string &midi_callback)
    : impl_(std::make_unique<Impl>()) {
  static_assert(std::endian::native == std::endian::little);
  impl_->left = left;
  impl_->right = right;
  impl_->frames = frames;

  std::ifstream wasm(wasm_path, std::ios::binary);
  if (!wasm) throw std::runtime_error("Cannot open WASM: " + wasm_path);
  const std::vector<uint8_t> bytes{std::istreambuf_iterator<char>(wasm), {}};
  wasmtime_module_t *module = nullptr;
  check(wasmtime_module_new(impl_->engine.get(), bytes.data(), bytes.size(), &module));
  impl_->module.reset(module);

  // The compiler already records the exact memory limits in the WASM import.
  wasm_importtype_vec_t imports;
  wasmtime_module_imports(module, &imports);
  const auto *memory_type = imports.size == 1
      ? wasm_externtype_as_memorytype_const(wasm_importtype_type(imports.data[0])) : nullptr;
  Handle<wasm_memorytype_t, wasm_memorytype_delete> type{
      memory_type ? wasm_memorytype_copy(memory_type) : nullptr, wasm_memorytype_delete};
  wasm_importtype_vec_delete(&imports);
  if (!type || !wasmtime_memorytype_isshared(type.get())) {
    throw std::runtime_error("Expected a single shared WASM memory import");
  }
  wasmtime_sharedmemory_t *memory = nullptr;
  check(wasmtime_sharedmemory_new(impl_->engine.get(), type.get(), &memory));
  impl_->memory.reset(memory);
  const auto memory_size = wasmtime_sharedmemory_data_size(memory);
  const auto buffer_bytes = static_cast<uint64_t>(frames) * sizeof(float);
  if (frames == 0 || static_cast<uint64_t>(left) + buffer_bytes > memory_size ||
      static_cast<uint64_t>(right) + buffer_bytes > memory_size) {
    throw std::runtime_error("Audio buffer addresses and sample count must fit in WASM memory");
  }
  wasmtime_extern_t imported{};
  imported.kind = WASMTIME_EXTERN_SHAREDMEMORY;
  imported.of.sharedmemory = memory;
  wasm_trap_t *trap = nullptr;
  auto *error = wasmtime_instance_new(impl_->context, module, &imported, 1, &impl_->instance, &trap);
  check(error, trap);
  const auto initialize = impl_->function("initDefaults", 0);
  impl_->buffer_function = impl_->function(entry, 0);
  if (!midi_callback.empty()) impl_->midi_function = impl_->function(midi_callback, 3);
  impl_->call(initialize);
}

Program::~Program() = default;
std::size_t Program::frames() const { return impl_->frames; }

void Program::midi(MidiMessage message) {
  std::array<wasmtime_val_t, 3> args{};
  args[0].kind = args[1].kind = args[2].kind = WASMTIME_I32;
  args[0].of.i32 = message.status;
  args[1].of.i32 = message.data1;
  args[2].of.i32 = message.data2;
  impl_->call(impl_->midi_function, args);
}

void Program::render(std::span<float> stereo, float gain) {
  impl_->call(impl_->buffer_function);
  const auto *memory = wasmtime_sharedmemory_data(impl_->memory.get());
  for (std::size_t i = 0; i < frames(); ++i) {
    float left, right;
    std::memcpy(&left, memory + impl_->left + i * sizeof(float), sizeof(float));
    std::memcpy(&right, memory + impl_->right + i * sizeof(float), sizeof(float));
    stereo[2 * i] = std::clamp(left * gain, -1.0f, 1.0f);
    stereo[2 * i + 1] = std::clamp(right * gain, -1.0f, 1.0f);
  }
}
