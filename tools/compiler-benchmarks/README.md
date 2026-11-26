# Compiler benchmarks

`@8f4e/compiler-benchmarks` owns benchmark programs and runners for emitted bytecode size and compiler execution counts.
It depends on the compiler, standard library and CLI without making benchmarks dependencies of product builds.

The `cases/` directory contains `.8f4e` programs whose emitted bytecode size can be tracked over time. Keep cases small,
focused, and named after the compiler behavior or project idiom they measure. The cases are also available through the
`@8f4e/compiler-benchmarks/cases` package export for integration tests.

Run `npx nx run @8f4e/compiler-benchmarks:log-bytecode-size` from the workspace root to append per-benchmark results to `logs/bytecode-size/`.

Run `npx nx run @8f4e/compiler-benchmarks:log-compiler-coverage-counts` to append V8 precise coverage execution counts for the same cases to `logs/compiler-coverage-counts/`.

The coverage runner resolves measured compiler components by package name and runs Node with `--jitless` to prevent
optimization from changing execution counts between identical runs. New records use schema version 3 and include the
measurement mode, Node version, and V8 version. A new runtime records a new measurement even for a previously measured
compiler version. Earlier records remain intact; the metrics dashboard keeps each Node/V8 series separate from other
runtimes and from the historical JIT-enabled measurements.

Log filenames and benchmark IDs are relative to `cases/`, so moving the tool does not change the measurement series.
Run `npx nx run @8f4e/compiler-benchmarks:test` to check component discovery, reproducibility, and preservation of old logs.
