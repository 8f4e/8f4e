# Runtime command generator

A standalone Node.js development tool that reads the compiler's memory-layout JSON and prints a Linux runtime
launch command with numeric byte addresses. It has no npm dependencies and never executes the printed command.
The target machine needs only the native runtime and the `.wasm` file.

First compile a project with the main CLI's `--wasm-output` and `--memory-output` options. Programs use shared memory.
Then, from the repository root:

```sh
node tools/runtime-command/src/cli.mjs instrument.wasm memory.json \
  --runtime ./8f4e-runtime \
  --left synth/output:left --right synth/output:right -- \
  --sample-rate 48000
```

The first path is the WASM path to use on the target machine; the second is the memory-map file on the development
computer. `--runtime` selects the target executable path and defaults to `8f4e-runtime`. The left symbol defaults
to `audioout:buffer`, and the right symbol defaults to the left. Qualified names include any group path, such as
`synth/voice/output:left`. Both buffers must contain float32 samples with equal nonzero element counts.

The printed command contains `--left <byte-address> --right <byte-address> --buffer-size <sample-count>` followed
by the runtime options after `--`. Every argument is quoted for a POSIX shell, including filenames with spaces,
single quotes and shell metacharacters. Sample rate remains an explicit runtime option; the memory map does not
contain the instrument's compiled sample rate. JACK must already be running at that rate; see the
[Linux runtime documentation](../../packages/runtime-linux/README.md) for automatic hardware connections and
Patchbox MIDI-bridge setup. Regenerate the command when rebuilding changes the memory layout.

Run the tests and Biome checks with:

```sh
npx nx run @8f4e/runtime-command:test
npx nx run @8f4e/runtime-command:lint
```
