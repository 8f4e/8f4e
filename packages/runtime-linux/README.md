# @8f4e/runtime-linux

A standalone C++20 Linux host for compiled 8f4e instruments. It embeds Wasmtime and connects to an existing JACK
server for stereo audio output and MIDI input. It loads WebAssembly and accepts numeric audio-buffer byte addresses.
Memory limits come directly from the WASM import; the runtime needs no memory-map file, JSON parser, editor or Node.js.

## Build on Linux

The release baseline is Debian 12 Bookworm on ARM64 and x86-64. This matches the user-space base of the
[Pi 5-compatible Patchbox OS image](https://community.blokas.io/t/beta-patchbox-os-bookworm-arm64-2024-04-04/5163).
Install the build dependencies:

```sh
sudo apt-get install build-essential cmake pkg-config libjack-jackd2-dev ca-certificates
```

From the repository root:

```sh
npx nx run @8f4e/runtime-linux:build
```

The executable is `packages/runtime-linux/dist/8f4e-runtime`. CMake downloads the Wasmtime 50.0.1 C API distribution
for ARM64 or x86-64 and verifies its SHA-256 digest. To use an already extracted distribution, configure CMake with
`-DWASMTIME_ROOT=/path/to/wasmtime-c-api`. Wasmtime is linked statically; JACK and the C/C++ runtime libraries remain
system dependencies. Prebuilt archives are built in `debian:bookworm` containers, so they do not require Ubuntu 24.04's
newer C++ library. On a target without JACK libraries, install `libjack-jackd2-0`.

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
  --memory-output /tmp/dx7.memory.json
```

The JSON is used only by the separate [runtime-command tool](../../tools/runtime-command/README.md) on the
development computer. That tool resolves symbols in the compiler memory map and prints a shell command containing
numeric byte addresses and the declared audio-buffer size. Generate a launch command with:

```sh
node tools/runtime-command/src/cli.mjs dx7.wasm /tmp/dx7.memory.json \
  --runtime ./8f4e-runtime -- \
  --connect-left system:playback_1 --connect-right system:playback_2 --sample-rate 48000
```

Copy `/tmp/dx7.wasm` to the Linux machine as `dx7.wasm`, alongside the executable, and run the printed command there.
Only the WASM file and executable are needed on the target, with JACK installed and running. Regenerate the command
whenever recompilation changes the memory layout. For separate buffers, give the command tool
`--left output:left --right output:right` before `--`; full nested references such as `synth/voice/output:left` are supported.

The compiler always emits shared memory. This host enables Wasmtime's shared-memory support and imports the
memory declared by the WASM file. Initialization, MIDI and audio execute sequentially in one instance on JACK's
playback thread; shared memory does not introduce concurrent WASM execution.

## Run with Patchbox OS and Pisound

Configure and start Patchbox's JACK service through `patchbox`. Set its sample rate to the instrument's compiled
`SAMPLE_RATE` constant. The runtime connects to the running server without starting another one or opening Pisound
directly. Patchbox shares its JACK server between users with `JACK_PROMISCUOUS_SERVER=jack`; keep that environment
setting when launching from SSH, a button script or a service. See [Blokas's explanation](https://community.blokas.io/t/understanding-jack-audio/3662).

Use `jack_lsp -tp` to list audio and MIDI ports. For an instrument whose 128-sample left/right buffers start at
byte offsets 0 and 512, and a MIDI source named `pisound:midi/capture_1`, the numeric command is:

```sh
export JACK_PROMISCUOUS_SERVER=jack
./8f4e-runtime instrument.wasm --left 0 --right 512 --buffer-size 128 \
  --connect-left system:playback_1 --connect-right system:playback_2 \
  --midi-source pisound:midi/capture_1 --sample-rate 48000
```

Use the generated command for the actual DX7 addresses and the port names reported by your JACK server.
The client defaults to `8f4e` and exposes `8f4e:out_left`, `8f4e:out_right` and `8f4e:midi_in`.
`--client-name` selects an unused name when running multiple instruments. Without connection options, ports remain
available for routing through Patchage or `jack_connect`:

```sh
jack_connect 8f4e:out_left system:playback_1
jack_connect 8f4e:out_right system:playback_2
jack_connect 'your MIDI source port' 8f4e:midi_in
```

If your hardware MIDI input is only visible to ALSA, expose it to JACK using `a2jmidid -e`, then select its resulting
JACK port. Blokas documents this setup in its [JACK MIDI guidance](https://community.blokas.io/t/getting-started-dramas-recognising-a-midi-controller/6002/6).

`--left` is required and accepts a decimal byte offset, including zero. `--right` defaults to the left address for
dual-mono output. Audio samples are little-endian float32 values. `--buffer-size` defaults to 128 and must equal the
number of samples generated by each call to the WASM block function. Both buffer ranges must fit in the imported
memory. The runtime splits or combines these blocks to fill JACK cycles, including cycles smaller than a WASM block.
JACK's buffer size may change while running. `--sample-rate` defaults to 48000 and must match both JACK and the
project; a mismatch or a later JACK sample-rate change stops the runtime. It does not retune or recompile the instrument.

The host calls `initDefaults()` once before JACK begins processing, then invokes the exported `buffer()` for every
WASM block. MIDI calls `onMidiEvent(i32 status, i32 data1, i32 data2)` on the same thread. All functions return no values.
`--entry` and `--midi-callback` override those export names. MIDI input is enabled by default; use `--no-midi` for a
project without a MIDI callback. JACK supplies complete MIDI messages; SysEx is ignored. Events take effect at the
next WASM block boundary at or after their JACK timestamp, rather than being applied early to the entire JACK cycle.

Output gain defaults to `0.25`; use `--gain` to change it. Samples are clipped to `[-1, 1]` after gain. Compilation and
host buffer allocation happen before activation; WASM initialization runs in JACK's thread initializer, outside the
process callback. Ctrl-C and SIGTERM deactivate the client and close its ports. WASM traps stop playback and report
the error on the main thread. `--blocks <count>` stops after a fixed number of WASM blocks for smoke tests.
This first version supplies audio output and MIDI input only; audio input, MIDI output and hot reload are outside its scope.

## Validate

On Linux, install `jackd2` and `jack-tools` alongside the build dependencies, then run:

```sh
npx nx run @8f4e/runtime-linux:test
```

This compiles a local `.8f4e` fixture through the real CLI and verifies initialization, MIDI callbacks, numeric memory
routing, stereo/mono output and gain. Integration tests start isolated JACK dummy servers with 64- and 256-sample cycles,
launch the generated runtime command, send MIDI and capture stereo samples from its JACK ports. They also verify SysEx
is ignored, bounded playback, sample-rate mismatch rejection, numeric argument errors and clean shutdown.
No sound card, MIDI interface or existing JACK server is needed.

The **Linux runtime / Test** workflow runs these checks in Bookworm containers on native x86-64 and ARM64 runners.
Web workflows exclude the native runtime and its command tool. These checks do not measure hardware latency or prove
glitch-free playback on a Pi; validate the actual interface and desired polyphony on the device.

## Release

Manually run **Linux runtime / Release** from `main`. It builds and tests native x86-64 and ARM64 executables in
Bookworm containers, extracts each packaged archive and checks the executable starts, then publishes the archives in
a GitHub release tagged `@8f4e/runtime-linux@<version>`. The version comes from this package's `package.json`; update
it and the root lockfile in a PR before the next release. Releasing an existing tag fails instead of replacing its assets.
The release does not version web packages, collect web metrics, or deploy sites. The normal web release excludes
this package from Nx versioning and tests.

## Dependencies

- [Wasmtime C API](https://docs.wasmtime.dev/c-api/)
- [JACK client API](https://jackaudio.org/api/)
- [JACK MIDI API](https://jackaudio.org/api/group__MIDIAPI.html)
