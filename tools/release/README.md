# Release tooling

`@8f4e/release` coordinates repository release validation and metrics. The runners in `scripts/` collect bundle sizes
and TSDoc coverage. Compiler-specific measurements live in [compiler-benchmarks](../compiler-benchmarks/README.md).

Run the following targets from the workspace root:

```sh
npx nx run @8f4e/release:test
npx nx run @8f4e/release:bundle-sizes
npx nx run @8f4e/release:docs-coverage
npx nx run @8f4e/release:tests
```

Measurement logs are written under `logs/`. The root `bundle-size.config.json` is shared by the bundle-size runner and
the metrics dashboard; it identifies packages by name and defaults to `dist/` inside each discovered package root.
Only nonstandard output directories need a package-relative `distDir` override. Entry patterns match within that
output directory. The root scripts directory is reserved for workspace maintenance utilities.

Package discovery uses the Nx project graph and its package-manager workspace membership, project roots,
and package versions. It preserves the default set previously discovered through npm workspace links.
Source directories default to `src/` within each discovered project root; nonstandard layouts can declare a
project-relative `metadata.metrics.sourceDirectory` in `project.json` (for example `std` in the standard library).
For local TSDoc measurements, the runner accepts repeated `--package-root <directory>`
filters for Nx package projects under those directories and `--out-dir <directory>` to write isolated results.
A directory filter that matches no Nx package projects is an error rather than an empty measurement.

Release validation runs tests without collecting coverage or historical test coverage metrics. To measure coverage on
demand, run `npx nx test <project> --coverage --skip-nx-cache`; reports stay in that project's `coverage/` directory.

For actual releases and deployment, follow the [release instructions](../../docs/releasing.md).
