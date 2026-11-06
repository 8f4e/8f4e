# @8f4e/runtime-linux

A standalone C++20 Linux host for compiled 8f4e instruments. It embeds Wasmtime and uses ALSA for stereo audio
output and one MIDI 1.0 input. It loads WebAssembly and the compiler's memory information without the editor or Node.js.

## Build on Linux

Use a 64-bit Linux installation, including Raspberry Pi OS on a Pi 5. Install the build dependencies:

```sh
sudo apt-get install build-essential cmake libasound2-dev nlohmann-json3-dev ca-certificates
```

From the repository root:

```sh
npx nx run @8f4e/runtime-linux:build
```

The executable is `packages/runtime-linux/dist/8f4e-runtime`. CMake downloads the Wasmtime 50.0.1 C API distribution
for ARM64 or x86-64 and verifies its SHA-256 digest. To use an already extracted distribution, configure CMake with
`-DWASMTIME_ROOT=/path/to/wasmtime-c-api`. Wasmtime is linked statically; ALSA remains a system dependency.

Without the JavaScript workspace tooling, the native package can also be built directly:

```sh
cmake -S packages/runtime-linux -B packages/runtime-linux/dist/build -DCMAKE_BUILD_TYPE=Release
cmake --build packages/runtime-linux/dist/build --parallel 2
```

## Compile an instrument

Build the CLI and export the DX7 project on the development computer:

```sh
npx nx run @8f4e/cli:build
node packages/cli/bin/cli.js compile packages/examples/src/projects/midi/dx7Algorithm5EightVoices.8f4e \
  --wasm-output /tmp/dx7.wasm \
  --memory-output /tmp/dx7.memory.json \
  --no-shared-memory
```

Copy both files to the Linux machine. The JSON contains the compiler's unmodified `requiredMemoryBytes` and
`memoryPlan` fields. Always deploy a matching pair from the same compilation. The runtime resolves qualified
`module:memory` references through `memoryPlan.modules[module].memory[name]`; nested module ids remain intact.
Addresses are bytes, and audio samples are little-endian float32 values.

`--no-shared-memory` is required: this host owns one WASM instance and executes MIDI and audio sequentially.
The CLI's normal shared-memory output remains available for other hosts.

## Run with Pisound

Use `aplay -L` to find PCM device names and `amidi -l` to find raw MIDI devices (`alsa-utils` supplies both commands).
For a Pisound card named `pisound`:

```sh
packages/runtime-linux/dist/8f4e-runtime /tmp/dx7.wasm /tmp/dx7.memory.json \
  --audio-device plughw:CARD=pisound \
  --midi-device hw:CARD=pisound \
  --sample-rate 48000
```

The ALSA `plughw` device converts the runtime's stereo float32 stream into the card's supported hardware format.
The left buffer defaults to `audioout:buffer`; the right defaults to the same buffer for dual-mono output. For
separate buffers, supply `--left output:left --right output:right`. The block size comes from the buffer's
`numberOfElements`; both buffers must have equal lengths. The WASM block function must generate exactly that many
samples on each call. `--sample-rate` must match the project's compiled `SAMPLE_RATE` constant; it does not retune
or recompile the instrument.

The host calls `initDefaults()` once, then invokes the exported `buffer()` function for every audio block. It reads
MIDI in nonblocking mode between blocks and invokes `onMidiEvent(i32 status, i32 data1, i32 data2)`. All functions
run on the same thread and return no values. `--entry` and `--midi-callback` override those export names. MIDI input
is disabled when `--midi-device` is omitted, and no MIDI export is then required. Running status, short messages,
split reads, and interleaved realtime messages are supported; SysEx payloads are ignored.

Output gain defaults to `0.25`; use `--gain` to change it. Samples are clipped to `[-1, 1]` after gain. The host
preallocates its audio buffer and prepares WASM before opening devices. ALSA paces the blocking audio writes,
including partial writes and underrun/suspend recovery. Ctrl-C and SIGTERM stop playback and close the devices.
MIDI timing is quantized to block boundaries. This first version supplies audio output and MIDI input only;
audio input, MIDI output, hot reload, and sample-accurate MIDI scheduling are outside its scope.

## Validate

On Linux with the build dependencies installed:

```sh
npx nx run @8f4e/runtime-linux:test
```

This compiles a local `.8f4e` fixture through the real CLI, tests MIDI parsing and exported callbacks, verifies
compiler memory routing, stereo/mono output and gain, and runs the executable against ALSA's `null` PCM device.
No sound card or MIDI interface is needed. For a bounded smoke test of another instrument:

```sh
packages/runtime-linux/dist/8f4e-runtime /tmp/dx7.wasm /tmp/dx7.memory.json --audio-device null --blocks 100
```

These checks do not measure hardware latency or prove glitch-free playback on a Pi. Test the actual interface and
polyphony before using it for a performance.

## Dependencies

- [Wasmtime C API](https://docs.wasmtime.dev/c-api/)
- [ALSA PCM API](https://www.alsa-project.org/alsa-doc/alsa-lib/group___p_c_m.html)
- [ALSA RawMIDI API](https://www.alsa-project.org/alsa-doc/alsa-lib/group___raw_midi.html)
