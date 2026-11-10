# Daisy runtime

The Daisy Field runtime loads an 8f4e instrument from microSD at boot. It runs
on the Field's Daisy Seed with stereo audio output at 48 kHz and note and
controller events from the 3.5 mm Type A TRS MIDI input.

## Build the firmware

Install the Arm GNU toolchain (`arm-none-eabi-gcc` and `arm-none-eabi-g++`),
GNU Make and CMake 3.20 or newer. The firmware build compiles libDaisy and
WAMR from the pinned submodules.

The Daisy submodules are opt-in. Run the build from the 8f4e repository root
after installing the workspace dependencies.

```sh
git submodule update --init --checkout -- packages/runtime-daisy/third_party
npx nx run @8f4e/runtime-daisy:build
```

The firmware is `packages/runtime-daisy/dist/firmware/8f4e-field.bin`. It
targets the Daisy bootloader's QSPI application slot. Follow the
[Daisy bootloader guide](https://docs.daisy.audio/tutorials/_a7_Getting-Started-Daisy-Bootloader/#flashing-with-the-bootloader)
to install it.

## Prepare an instrument

Use a project configured for 48 kHz that exports `initDefaults()`,
`buffer()`, and `onMidiEvent(i32, i32, i32)`. Each call to `buffer` should
write one block of 1 to 256 float32 samples per output buffer. Use `wamrc`
from the [WAMR 2.4.5 release](https://github.com/wasm-micro-runtime/wasm-micro-runtime/releases/tag/WAMR-2.4.5)
to match the firmware. Run the commands below from the repository root
after building the 8f4e CLI.

```sh
node packages/cli/bin/cli.js compile instrument.8f4e \
  --wasm-output instrument.wasm --memory-output memory.json
wamrc --target=thumbv7em --target-abi=eabihf --cpu=cortex-m7 \
  --bounds-checks=1 --opt-level=3 -o PATCH.AOT instrument.wasm
node packages/runtime-daisy/tools/write-patch-config.mjs memory.json PATCH.TXT
```

The config generator uses `audioout:buffer` for both channels by default. Pass
`--left <module:buffer>` and `--right <module:buffer>` for other outputs. The
right channel defaults to the left. Put `PATCH.AOT` and `PATCH.TXT` in the root
of a FAT32 microSD card, insert it in the Field, and restart to load the instrument.
Regenerate the text file after recompiling the instrument.

`PATCH.TXT` contains three lines of ASCII decimal values in this order.
The offsets are byte addresses within the instrument's shared Wasm memory.

```text
left=4
right=4
frames=128
```

`PATCH.AOT` is the unmodified Cortex-M7 output from `wamrc`. Use files built
from projects you trust. The AOT file limit is 128 KiB, and a separate 128 KiB
SRAM arena holds relocated code and Wasm linear memory together.

The Field logs peak callback time, measured deadline misses, and MIDI queue
drops once per second over the Seed's USB serial port. At 48 kHz and 128
samples the callback has 2.67 ms. A one-voice DX7 E.PIANO 1 patch was tested
on the Field. The eight-voice DX7 example exceeds this deadline.
