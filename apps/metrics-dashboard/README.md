# Metrics dashboard

The local dashboard displays historical bundle sizes, emitted bytecode sizes, compiler execution counts, TSDoc coverage,
and test coverage from the repository's `logs/` directory.

Run from the workspace root:

```sh
npx nx run @8f4e/metrics-dashboard:serve
npx nx run @8f4e/metrics-dashboard:test
npx nx run @8f4e/metrics-dashboard:test --coverage
npx nx run @8f4e/metrics-dashboard:build
```

Each report in `src/reports/` owns its markup, log-to-point mapping, summary, tables and charts. `src/main.ts` owns the
dashboard shell, view selection and controls. Shared manifest loading, release indexing, chart helpers, card markup and
formatting live in `src/shared/`. The compiler-coverage report retains separate historical and deterministic series;
when multiple Node/V8 runtimes have been recorded, select the runtime to compare only like-for-like measurements.
The test-coverage report similarly separates historic measurements from the newer production-source scope rather than
connecting incomparable coverage percentages across the change in methodology.

The Vite configuration exposes the same log manifests and JSON files in development and in the production bundle.
Release targets and measurement runners live in [release tooling](../../tools/release/README.md) and
[compiler benchmarks](../../tools/compiler-benchmarks/README.md).
