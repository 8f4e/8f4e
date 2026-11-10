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

### Wasm optimization

Use `--no-memory-guards` with `cli compile` to omit compiler-generated bounds guards for memory accesses.
With guards disabled, an out-of-bounds access traps in Wasm. Guards are enabled by default.

Pruning removes unreachable functions and unused local slots by default. Use `--no-wasm-pruning` to disable it
independently of inlining.

Function inlining is off by default in `cli compile`. Use `--inline-functions` to inline eligible functions.

- `--max-inline-expansion-operations <n>` caps the size of each replacement, including argument stores and local initialization.
- `--max-inline-caller-growth <n>` caps the total additional operations from inlining in each caller.

Both limits count lowered Wasm operations and accept non-negative integers, including zero. They apply when
`--inline-functions` is set. The default caller budget allows 128 extra operations from duplicating bodies.
An explicit caller-growth limit applies to all expansions. Each replacement has no size limit unless configured.

```bash
cli compile path/to/project.8f4e --wasm-output path/to/module.wasm --inline-functions \
  --max-inline-expansion-operations 24 --max-inline-caller-growth 64
```

Use `--simplify-wasm-locals` to fuse an adjacent `local.set` and `local.get` on the same slot into `local.tee`.
This opt-in pass runs after optional inlining and preserves shared memory accesses.

Use `--env NAME=NUMBER` to override an existing numeric literal in the root
`constants env` block. The CLI rejects missing constants and requires a numeric
literal for both the declaration and the replacement. Repeat the flag to
override more than one constant. The CLI preserves the constant's type and
rewrites the parsed project in memory before compilation.

```bash
cli compile instrument.8f4e --env SAMPLE_RATE=32000 --wasm-output instrument.wasm \
  --memory-output memory.json
```

## Output

When `--wasm-output` is used, the CLI writes a decoded WebAssembly binary (`.wasm`) file.

`--memory-output` writes JSON containing `requiredMemoryBytes` and the complete `memoryPlan` from the same
compilation. When the root `constants env` block declares values, `envConstants`
contains their effective values. The plan includes qualified module ids, byte addresses, types and element counts.
The [runtime command generator](../../tools/runtime-command/README.md) uses it to print numeric launch arguments
for the [Linux audio/MIDI runtime](../runtime-linux/README.md). Compiled programs always import shared memory.
Output paths must differ from each other and from the source project.

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
