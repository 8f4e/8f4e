#include "program.hpp"

#include <algorithm>
#include <array>
#include <bit>
#include <cstring>
#include <fstream>
#include <iterator>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <vector>
#include <wasmtime.h>

namespace {
using Json = nlohmann::json;
template <class T, void (*Destroy)(T *)>
using Handle = std::unique_ptr<T, decltype(Destroy)>;

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

struct Buffer {
  std::size_t address;
  std::size_t frames;
};

Buffer resolve_buffer(const Json &info, const std::string &id) {
  const auto separator = id.rfind(':');
  if (separator == std::string::npos) {
    throw std::runtime_error("Audio buffer must be a qualified module:memory reference: " + id);
  }
  const auto &memory = info.at("memoryPlan").at("modules").at(id.substr(0, separator))
                          .at("memory").at(id.substr(separator + 1));
  if (memory.at("type") != "float" || memory.at("pointerDepth") != 0) {
    throw std::runtime_error("Audio buffer must contain float32 samples: " + id);
  }
  return {memory.at("byteAddress"), memory.at("numberOfElements")};
}
} // namespace

struct Program::Impl {
  Handle<wasm_engine_t, wasm_engine_delete> engine{wasm_engine_new(), wasm_engine_delete};
  Handle<wasmtime_module_t, wasmtime_module_delete> module{nullptr, wasmtime_module_delete};
  Handle<wasmtime_store_t, wasmtime_store_delete> store{
      wasmtime_store_new(engine.get(), nullptr, nullptr), wasmtime_store_delete};
  wasmtime_context_t *context = wasmtime_store_context(store.get());
  wasmtime_instance_t instance{};
  wasmtime_memory_t memory{};
  wasmtime_func_t buffer_function{};
  wasmtime_func_t midi_function{};
  Buffer left{};
  Buffer right{};

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

Program::Program(const std::string &wasm_path, const std::string &memory_path,
                 const std::string &left, const std::string &right,
                 const std::string &entry, const std::string &midi_callback)
    : impl_(std::make_unique<Impl>()) {
  static_assert(std::endian::native == std::endian::little);
  std::ifstream metadata(memory_path);
  if (!metadata) throw std::runtime_error("Cannot open memory information: " + memory_path);
  const auto info = Json::parse(metadata);
  impl_->left = resolve_buffer(info, left);
  impl_->right = resolve_buffer(info, right);
  if (!impl_->left.frames || impl_->left.frames != impl_->right.frames) {
    throw std::runtime_error("Left and right audio buffers must have the same nonzero sample count");
  }

  std::ifstream wasm(wasm_path, std::ios::binary);
  if (!wasm) throw std::runtime_error("Cannot open WASM: " + wasm_path);
  const std::vector<uint8_t> bytes{std::istreambuf_iterator<char>(wasm), {}};
  wasmtime_module_t *module = nullptr;
  check(wasmtime_module_new(impl_->engine.get(), bytes.data(), bytes.size(), &module));
  impl_->module.reset(module);

  const auto required = info.at("requiredMemoryBytes").get<uint64_t>();
  const auto pages = static_cast<uint32_t>(std::max(uint64_t{1}, (required + 65535) / 65536));
  const wasm_limits_t limits{pages, pages};
  Handle<wasm_memorytype_t, wasm_memorytype_delete> type{
      wasm_memorytype_new(&limits), wasm_memorytype_delete};
  check(wasmtime_memory_new(impl_->context, type.get(), &impl_->memory));
  wasmtime_extern_t imported{};
  imported.kind = WASMTIME_EXTERN_MEMORY;
  imported.of.memory = impl_->memory;
  wasm_trap_t *trap = nullptr;
  auto *error = wasmtime_instance_new(impl_->context, module, &imported, 1, &impl_->instance, &trap);
  check(error, trap);
  const auto initialize = impl_->function("initDefaults", 0);
  impl_->buffer_function = impl_->function(entry, 0);
  if (!midi_callback.empty()) impl_->midi_function = impl_->function(midi_callback, 3);
  impl_->call(initialize);
}

Program::~Program() = default;
std::size_t Program::frames() const { return impl_->left.frames; }

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
  const auto *memory = wasmtime_memory_data(impl_->context, &impl_->memory);
  for (std::size_t i = 0; i < frames(); ++i) {
    float left, right;
    std::memcpy(&left, memory + impl_->left.address + i * sizeof(float), sizeof(float));
    std::memcpy(&right, memory + impl_->right.address + i * sizeof(float), sizeof(float));
    stereo[2 * i] = std::clamp(left * gain, -1.0f, 1.0f);
    stereo[2 * i + 1] = std::clamp(right * gain, -1.0f, 1.0f);
  }
}
