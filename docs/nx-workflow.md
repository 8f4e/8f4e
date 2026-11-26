# Nx Workspace Workflow

This project now uses Nx for improved monorepo management with Vite as the modern build tool.

## Key Benefits

- **Local Caching**: Nx caches build outputs locally and only rebuilds what's changed
- **Dependency Management**: Automatic build ordering based on project dependencies
- **Affected Builds**: Only rebuild projects affected by changes
- **Better Developer Experience**: Rich tooling and project graph visualization
- **No Cloud Dependencies**: All caching and features work locally without external services

## Available Commands

### Building

```bash
# Build all packages (uses Nx caching)
npm run build

# Build specific project
npx nx run @8f4e/compiler:build

# Build all projects with Nx
npx nx run-many --target=build

# Build only affected projects
npx nx affected --target=build --base=main
```

### Testing

```bash
# Run all tests
npm test

# Run tests for specific project
npx nx run @8f4e/compiler:test

# Run only affected tests
npx nx affected --target=test --base=main
```

### Type Checking

```bash
# Type check all projects
npm run typecheck

# Type check specific project
npx nx run @8f4e/compiler:typecheck
```

### Development

```bash
# Start development server (unchanged)
npm run dev

# Watch build for specific project
npx nx run @8f4e/compiler:dev
```

## Project Structure

Application entry points live under `apps/`; the `compiler/`, `editor/` and `examples/` directories own product libraries
and sources. `tools/` holds shared tooling libraries and standalone development utilities. The root npm workspace
lists these project locations explicitly, so standalone tools do not become npm workspaces accidentally. Nx discovers
workspaces by their package names; native applications without npm manifests declare their projects in `project.json`.

- `@8f4e/editor-default` (`editor/compositions/editor-default`)
- `@8f4e/editor-webapp` (`apps/editor-webapp`)
- `@8f4e/8f4e-website` (`apps/8f4e-website`)
- `@8f4e/cli` (`apps/cli`)
- `@8f4e/metrics-dashboard` (`apps/metrics-dashboard`)
- `@8f4e/runtime-daisy` (`apps/runtime-daisy`)
- `@8f4e/runtime-linux` (`apps/runtime-linux`)
- `@8f4e/runtime-command` (`apps/runtime-command`)
- `@8f4e/editor-core` (`editor/core/editor-core`)
- `glugglugglug` (`editor/core/glugglugglug`)
- `@8f4e/sprite-generator` (`editor/core/sprite-generator`)
- `@8f4e/compiler` (`compiler/`)
- `@8f4e/examples` (`examples/`)
- `@8f4e/examples-integration` (`examples/tests/`, test only)
- `@8f4e/compiler-benchmarks` (`tools/compiler-benchmarks`, metrics tooling)
- `@8f4e/config` (`tools/config`)
- `@8f4e/test-runner` (`tools/test-runner`)
- `@8f4e/vite-plugin-sources` (`tools/vite-plugin-sources`)
- `@8f4e/compiler-worker` (`editor/plugins/compiler/packages/compiler-worker`)
- `@8f4e/runtime-audio-worklet` (`editor/plugins/audio-runtime/packages/runtime-audio-worklet`)
- `@8f4e/runtime-web-worker` (`editor/plugins/worker-runtime/packages/runtime-web-worker`)
- `@8f4e/runtime-test-runner` (`editor/plugins/test-runtime/packages/runtime-test-runner`)

## Configuration

- **nx.json**: Main Nx configuration with caching and dependency rules
- **package.json**: Updated scripts to use Nx commands
- **Workspaces**: Still configured for package linking compatibility

Nx's optional `sourceRoot` is workspace-relative, so omit it when projects use conventional `src/` directories.
Nx discovers each project root from its configuration; target commands can use `{projectRoot}` without repeating
physical project locations. The independently maintained Glugglugglug submodule owns its own project metadata.

Release metrics discover package names, roots, versions, and test targets from the Nx project graph. They select
projects that Nx identifies as npm workspace packages, preserving the existing measurement scope without parsing
`package-lock.json` or recursively scanning the repository. They use `src/` relative to each project's discovered root;
nonstandard layouts declare only a local `metadata.metrics.sourceDirectory` (for example `std` in the standard library).

## Production and test inputs

Builds use `production` and `^production`; tests use their own `default` files and dependency `production` files. Type checks keep their own test files. Test-only project imports still create graph edges even when declared as dev dependencies, so use local sample fixtures when the source package is not part of the behavior under test.

Tests build their workspace dependencies by default because imports resolve to built package exports, unless a target
has a more specific dependency configuration.

The shared Vitest preset measures authored production files in `src/`, including unimported files, and writes reports to
`{projectRoot}/coverage`. Nx's test default caches this directory. Tests that do not produce coverage (such as native
or integration-only suites) explicitly declare empty outputs. Release coverage collection requires a fresh or
cache-restored report for each coverage-producing test target. Generated data remains a production build input but is
excluded from source coverage.

Inspect resolved files with `npx nx show target inputs <project>:<target> --json` after changing dependencies, input
conventions, generators, or shipped assets. Use `npx nx run <project>:<target> --graph` to inspect prerequisite tasks.

## Migration Notes

- Vite configuration optimized for performance
- All existing npm scripts still work
- Package.json files in packages unchanged
- TypeScript builds work exactly as before
- Dependency resolution works correctly

This setup provides the foundation for modern development experience with the latest Vite build system.
