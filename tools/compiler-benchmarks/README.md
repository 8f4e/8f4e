# Compiler benchmarks

`@8f4e/compiler-benchmarks` owns benchmark programs and runners for emitted bytecode size and compiler execution counts.
It depends on the compiler, standard library and CLI without making benchmarks dependencies of product builds.

The `cases/` directory contains `.8f4e` programs whose emitted bytecode size can be tracked over time. Keep cases small,
focused, and named after the compiler behavior or project idiom they measure. The cases are also available through the
`@8f4e/compiler-benchmarks/cases` package export for integration tests.

Run `npx nx run @8f4e/compiler-benchmarks:log-bytecode-size` from the workspace root to append per-benchmark results to `logs/bytecode-size/`.

Run `npx nx run @8f4e/compiler-benchmarks:log-compiler-coverage-counts` to append V8 precise coverage execution counts for the same cases to `logs/compiler-coverage-counts/`.

Log filenames and benchmark IDs are relative to `cases/`, so moving the tool does not change the historical measurement series.
