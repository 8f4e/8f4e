# Compiler Coverage Count Logs

Generated V8 precise coverage count benchmark logs live here.

Use this directory for per-case compiler and tokenizer execution-count output from benchmark cases in `tools/compiler-benchmarks/cases`.

Run `npx nx run @8f4e/compiler-benchmarks:log-compiler-coverage-counts` to append the current benchmark results.

Entries through schema version 2 are historical measurements made with the JIT enabled. Schema version 3 uses
`measurementMode: "jitless"` and records the Node and V8 versions. The runner appends a measurement for each compiler
version and Node/V8 runtime, even when the version has an entry from an older measurement mode or runtime. It never
replaces those entries. The metrics dashboard separates the series so a runtime upgrade or change in measurement mode
is not mistaken for a compiler regression.
