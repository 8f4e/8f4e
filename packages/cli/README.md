# @8f4e/cli

CLI for compiling `.8f4e` project files into WebAssembly artifacts and runtime inspection output.

## Usage

```bash
cli compile path/to/project.8f4e --wasm-output path/to/module.wasm
```

For a standalone host, also export the compiler memory layout:

```bash
cli compile path/to/project.8f4e --wasm-output path/to/module.wasm --memory-output path/to/memory.json
```

```bash
cli run path/to/project.8f4e --cycles 16 --dump main:counter
```

```bash
cli capture path/to/project.8f4e --buffer audioout:buffer --cycles 128 --repeat 100 --out path/to/audio.bin
```

```bash
cli format path/to/module.8f4em --comment-width 32 --write
```

```bash
cli test path/to/project.8f4e 'path/to/tests/*.8f4em'
```

### Function inlining

Function inlining is off by default in `cli compile`. Use `--inline-functions` to inline eligible functions.

- `--max-inline-expansion-operations <n>` caps the size of each replacement, including argument stores and local initialization.
- `--max-inline-caller-growth <n>` caps the total additional operations from inlining in each caller.

Both limits accept non-negative integers, including zero, and apply when `--inline-functions` is set.
Omit a limit to leave that budget uncapped.

```bash
cli compile path/to/project.8f4e --wasm-output path/to/module.wasm --inline-functions \
  --max-inline-expansion-operations 24 --max-inline-caller-growth 64
```

## Output

When `--wasm-output` is used, the CLI writes a decoded WebAssembly binary (`.wasm`) file.

`--memory-output` writes JSON containing `requiredMemoryBytes` and the complete `memoryPlan` from the same
compilation. The plan includes qualified module ids, byte addresses, types and element counts. It can be consumed
by the [runtime command generator](../../tools/runtime-command/README.md) to print numeric launch arguments for the
[Linux audio/MIDI runtime](../runtime-linux/README.md). Compiled programs always import shared memory. Output paths
must differ from each other and from the source project.

When `format` is used, the CLI wraps long semicolon comments to the requested `--comment-width` or the default width
of 32. It writes to stdout by default, writes to a separate file with `--out`, or updates the input file with `--write`.

When `test` is used, the CLI executes test entries or exported test functions using `@8f4e/test-runner`, shared with
compiler fixtures. Native `assert` checks nonzero integer conditions, and `assertEqual expected`
compares the actual stack value to a required inline expected value with matching types and exact equality.
Test compilation enables assertions and initializes fresh memory once. Failure output includes the input filename, expected/received values, original module or function,
one-based line within that block, and assertion site ID. Loop invocations of the same assertion share a site ID.

When `capture` is used, the CLI:

- compiles and initializes the project
- optionally applies `--set`, `--set-json`, and `--load-file`
- runs `cycle()` for the requested `--cycles` window
- reads the requested `--buffer`
- repeats that capture `--repeat` times
- writes the concatenated raw bytes to `--out`

## Notes

- No schema validation is performed.
- `compile` requires `--wasm-output`.
- `run` requires at least one `--dump`.
- `capture` requires `--buffer` and `--out`.
- `format` accepts `.8f4e` and `.8f4em` files.
