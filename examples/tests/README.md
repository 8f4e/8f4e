# Example integration tests

`@8f4e/examples-integration` is the private Nx project for regression tests of complete example programs and reusable
modules. It depends on the examples and benchmark source collections, compiler, standard library and CLI, without adding
those dependencies to the examples asset package's build graph. The project has no production build or release target.

Run from the repository root:

```sh
npx nx run @8f4e/examples-integration:test
npx nx run @8f4e/examples-integration:typecheck
npx nx run @8f4e/examples-integration:lint
```

The suite verifies program behavior and layout, compilation/output snapshots through the CLI's public API, and any
embedded module assertions through the CLI. CLI command and API-contract tests with local fixtures stay in `apps/cli/tests/`.
Use the exported source collections in `programSources.ts` for fixture discovery; file snapshots use collection-relative
paths so workspace moves do not rename their baselines.
