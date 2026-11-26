# Release tooling

`@8f4e/release` coordinates repository release validation and metrics. The runners in `scripts/` collect bundle sizes,
test coverage, and TSDoc coverage. Compiler-specific measurements live in [compiler-benchmarks](../compiler-benchmarks/README.md).

Run the following targets from the workspace root:

```sh
npx nx run @8f4e/release:test
npx nx run @8f4e/release:bundle-sizes
npx nx run @8f4e/release:docs-coverage
npx nx run @8f4e/release:test-and-coverage
```

Measurement logs are written under `logs/`. The root `bundle-size.config.json` is shared by the bundle-size runner and
the metrics dashboard; it identifies packages by name and defaults to `dist/` inside each discovered package root.
Only nonstandard output directories need a package-relative `distDir` override. Entry patterns match within that
output directory. The root scripts directory is reserved for workspace maintenance utilities.

Package discovery uses the Nx project graph and its package-manager workspace membership, project roots,
package versions, and test targets. It preserves the default set previously discovered through npm workspace links.
Source directories default to `src/` within each discovered project root; nonstandard layouts can declare a
project-relative `metadata.metrics.sourceDirectory` in `project.json` (for example `std` in the standard library).
For local TSDoc and test-coverage measurements, the runners accept repeated `--package-root <directory>`
filters for Nx package projects under those directories and `--out-dir <directory>` to write isolated results.
A directory filter that matches no Nx package projects is an error rather than an empty measurement.

Test coverage uses only each package's `coverage/coverage-summary.json`, as declared by its Nx test outputs. After
running `nx test <project> --coverage` (or `@8f4e/release:tests` for all release tests), metrics collection fails before
appending any records if an expected report is missing. Integration-only, native and other non-coverage tests opt out
with empty test outputs. Packages without tests that ship executable sources are not counted as measured packages.
New test-coverage records identify their `production-source` measurement scope, since the shared preset now includes
untested authored production files and excludes test helpers and generated data. Older records are retained but are
not directly comparable. These are Vitest process measurements; execution in separate subprocesses, such as CLI
integration tests that launch the built command, is not included.

For actual releases and deployment, follow the [release instructions](../../docs/releasing.md).
