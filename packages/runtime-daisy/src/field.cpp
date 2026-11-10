#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstring>

#include "daisy_field.h"
#include "fatfs.h"
#include "patch-config.hpp"
#include "wasm_export.h"

using namespace daisy;

namespace {
constexpr uint32_t sampleRate = 48000;
constexpr uint32_t queueCapacity = 64;

DaisyField field;
SdmmcHandler sd;
FatFSInterface filesystem;
PatchConfig patch;
alignas(32) uint8_t DSY_SDRAM_BSS patchBytes[128 * 1024];
alignas(16) uint8_t wasmPool[192 * 1024];
wasm_module_inst_t instance;
wasm_exec_env_t environment;
wasm_function_inst_t render;
wasm_function_inst_t onMidi;
const uint8_t* left;
const uint8_t* right;

struct MidiMessage {
    uint8_t status;
    uint8_t data1;
    uint8_t data2;
};
MidiMessage queue[queueCapacity];
std::atomic<uint32_t> readIndex{0}, writeIndex{0}, midiDrops{0};
std::atomic<uint32_t> peakTicks{0}, deadlineMisses{0};
std::atomic<bool> audioFault{false};
uint32_t deadlineTicks;

[[noreturn]] void fail(const char* message) {
    DaisySeed::PrintLine("8f4e Field: %s", message ? message : "Wasm execution failed");
    while (true) {
        field.seed.SetLed(true);
        System::Delay(180);
        field.seed.SetLed(false);
        System::Delay(820);
    }
}

uint32_t loadPatch() {
    SdmmcHandler::Config sdConfig;
    sdConfig.Defaults();
    sdConfig.speed = SdmmcHandler::Speed::STANDARD;
    if (sd.Init(sdConfig) != SdmmcHandler::Result::OK) fail("SD initialization failed");
    FatFSInterface::Config fsConfig;
    fsConfig.media = FatFSInterface::Config::MEDIA_SD;
    if (filesystem.Init(fsConfig) != FatFSInterface::Result::OK) fail("FatFs initialization failed");
    if (f_mount(&filesystem.GetSDFileSystem(), filesystem.GetSDPath(), 1) != FR_OK) {
        fail("Cannot mount SD card");
    }
    // FatFs reads partial sectors into FIL::buf with SDMMC DMA.
    // The Cortex-M7 stack lives in DTCM, which that DMA cannot access.
    alignas(32) static FIL file;
    if (f_open(&file, "0:/PATCH.TXT", FA_READ) != FR_OK) fail("Cannot open PATCH.TXT");
    char text[64];
    UINT bytesRead = 0;
    const auto textSize = f_size(&file);
    const bool validConfig = textSize <= sizeof(text) &&
                             f_read(&file, text, textSize, &bytesRead) == FR_OK &&
                             bytesRead == textSize && patch_config::parse(text, bytesRead, patch);
    f_close(&file);
    if (!validConfig) fail("Invalid PATCH.TXT");

    if (f_open(&file, "0:/PATCH.AOT", FA_READ) != FR_OK) fail("Cannot open PATCH.AOT");
    const auto aotSize = f_size(&file);
    const bool complete = aotSize > 0 && aotSize <= sizeof(patchBytes) &&
                          f_read(&file, patchBytes, aotSize, &bytesRead) == FR_OK &&
                          bytesRead == aotSize;
    f_close(&file);
    if (!complete) fail("Cannot read PATCH.AOT or file exceeds 128 KiB");
    return aotSize;
}

wasm_function_inst_t requireFunction(const char* name, uint32_t parameters) {
    auto function = wasm_runtime_lookup_function(instance, name);
    if (!function || wasm_func_get_param_count(function, instance) != parameters ||
        wasm_func_get_result_count(function, instance) != 0) fail(name);
    return function;
}

void startWasm(uint32_t aotSize) {
    RuntimeInitArgs config{};
    config.mem_alloc_type = Alloc_With_Pool;
    config.mem_alloc_option.pool.heap_buf = wasmPool;
    config.mem_alloc_option.pool.heap_size = sizeof(wasmPool);
    if (!wasm_runtime_full_init(&config)) fail("WAMR initialization failed");

    char error[160]{};
    auto module = wasm_runtime_load(patchBytes, aotSize, error, sizeof(error));
    if (!module) fail(error);
    instance = wasm_runtime_instantiate(module, 16 * 1024, 0, error, sizeof(error));
    if (!instance) fail(error);
    environment = wasm_runtime_create_exec_env(instance, 16 * 1024);
    if (!environment) fail("WAMR execution stack allocation failed");

    auto memory = wasm_runtime_get_memory(instance, 0);
    if (!memory || !wasm_memory_get_shared(memory) ||
        wasm_memory_get_cur_page_count(memory) != wasm_memory_get_max_page_count(memory)) {
        fail("Expected fixed shared memory");
    }
    const uint32_t bytes = patch.frames * sizeof(float);
    if (!wasm_runtime_validate_app_addr(instance, patch.left, bytes) ||
        !wasm_runtime_validate_app_addr(instance, patch.right, bytes)) fail("Invalid audio offsets");
    left = static_cast<const uint8_t*>(wasm_runtime_addr_app_to_native(instance, patch.left));
    right = static_cast<const uint8_t*>(wasm_runtime_addr_app_to_native(instance, patch.right));
    render = requireFunction("buffer", 0);
    onMidi = requireFunction("onMidiEvent", 3);
    wasm_valkind_t midiTypes[3]{};
    wasm_func_get_param_types(onMidi, instance, midiTypes);
    for (const auto type : midiTypes) {
        if (type != WASM_I32) fail("MIDI arguments must be i32");
    }
    if (!wasm_runtime_call_wasm(environment, requireFunction("initDefaults", 0), 0, nullptr)) {
        fail(wasm_runtime_get_exception(instance));
    }
}

void queueMidi(const MidiEvent& event) {
    uint8_t status;
    switch (event.type) {
        case NoteOff: status = 0x80; break;
        case NoteOn: status = 0x90; break;
        case ControlChange:
        case ChannelMode: status = 0xb0; break;
        default: return;
    }
    const auto write = writeIndex.load(std::memory_order_relaxed);
    if (write - readIndex.load(std::memory_order_acquire) == queueCapacity) {
        midiDrops.fetch_add(1, std::memory_order_relaxed);
        return;
    }
    queue[write % queueCapacity] = {
        static_cast<uint8_t>(status | event.channel), event.data[0], event.data[1],
    };
    writeIndex.store(write + 1, std::memory_order_release);
}

bool renderBlock() {
    auto read = readIndex.load(std::memory_order_relaxed);
    const auto write = writeIndex.load(std::memory_order_acquire);
    // Bound MIDI work so a burst can't monopolize the audio callback.
    for (unsigned i = 0; read != write && i < 16; ++i) {
        const auto event = queue[read % queueCapacity];
        readIndex.store(++read, std::memory_order_release);
        uint32_t args[]{event.status, event.data1, event.data2};
        if (!wasm_runtime_call_wasm(environment, onMidi, 3, args)) return false;
    }
    return wasm_runtime_call_wasm(environment, render, 0, nullptr);
}

float sample(const uint8_t* buffer, size_t index) {
    float value;
    std::memcpy(&value, buffer + index * sizeof(float), sizeof(value));
    if (!std::isfinite(value)) return 0.0f;
    return std::min(1.0f, std::max(-1.0f, value * 0.25f));
}

void audio(AudioHandle::InputBuffer, AudioHandle::OutputBuffer output, size_t frames) {
    const auto started = System::GetTick();
    const bool ok = !audioFault.load(std::memory_order_relaxed) && frames == patch.frames && renderBlock();
    if (!ok) audioFault.store(true, std::memory_order_release);
    for (size_t i = 0; i < frames; ++i) {
        output[0][i] = ok ? sample(left, i) : 0.0f;
        output[1][i] = ok ? sample(right, i) : 0.0f;
    }
    const auto elapsed = System::GetTick() - started;
    if (elapsed > peakTicks.load(std::memory_order_relaxed)) {
        peakTicks.store(elapsed, std::memory_order_relaxed);
    }
    if (elapsed >= deadlineTicks) deadlineMisses.fetch_add(1, std::memory_order_relaxed);
}
} // namespace

int main() {
    field.Init(true);
    DaisySeed::StartLog(false);
    startWasm(loadPatch());
    field.SetAudioSampleRate(SaiHandle::Config::SampleRate::SAI_48KHZ);
    field.SetAudioBlockSize(patch.frames);
    const auto tickHz = System::GetTickFreq();
    deadlineTicks = (static_cast<uint64_t>(tickHz) * patch.frames) / sampleRate;
    field.midi.StartReceive();
    field.StartAudio(audio);
    field.seed.SetLed(true);

    uint32_t lastLog = System::GetNow();
    while (true) {
        if (audioFault.load(std::memory_order_acquire)) {
            field.StopAudio();
            const char* reason = wasm_runtime_get_exception(instance);
            fail(reason ? reason : "Audio block size mismatch");
        }
        field.midi.Listen();
        while (field.midi.HasEvents()) {
            queueMidi(field.midi.PopEvent());
        }
        const auto now = System::GetNow();
        if (now - lastLog >= 1000) {
            lastLog = now;
            const auto peak = (static_cast<uint64_t>(peakTicks.load(std::memory_order_relaxed)) *
                               1000000) / tickHz;
            DaisySeed::PrintLine("Peak %lu us, deadline misses %lu, MIDI drops %lu",
                                static_cast<unsigned long>(peak),
                                static_cast<unsigned long>(deadlineMisses.load(std::memory_order_relaxed)),
                                static_cast<unsigned long>(midiDrops.load(std::memory_order_relaxed)));
        }
    }
}
