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
workspaces by their package names. Package-owned configuration lives in the package manifest's `nx` property; projects
without npm manifests declare themselves in `project.json`. The stdlib keeps `project.json` because its custom project
metadata must be available in the Nx graph.

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
- **package.json**: Package name, dependencies, exports, and package-owned Nx configuration under `nx`
- **project.json**: Configuration for projects without an npm manifest or those requiring custom project metadata
- **Workspaces**: Still configured for package linking compatibility

Nx's optional `sourceRoot` is workspace-relative, so omit it when projects use conventional `src/` directories.
Nx discovers each project root from its configuration; target commands can use `{projectRoot}` without repeating
physical project locations. The independently maintained Glugglugglug submodule owns its own project metadata.

Keep individual target declarations compact. For example, a typical TypeScript editor plugin declares the following
`nx` property in its package manifest:

```json
{
  "nx": {
    "projectType": "library",
    "targets": {
      "build": { "command": "rm -rf dist && tsc" },
      "test": { "command": "vitest run" },
      "typecheck": {},
      "lint": {}
    },
    "tags": ["type:library", "scope:editor"]
  }
}
```

The shared target defaults supply the package-local working directory, conventional `dist/` build output, lint command,
test-inclusive typecheck command, and screenshot command/prerequisite. Empty targets opt in to those commands.
Build and test commands remain explicit where they differ; tests using the Nx Vitest executor inherit the local
`vitest.config.ts` path. For nonstandard commands or outputs, use project-local overrides and inspect the resolved
target to ensure its dependency and caching rules remain intact.

Release metrics discover package names, roots, and versions from the Nx project graph. They select
projects that Nx identifies as npm workspace packages, preserving the existing measurement scope without parsing
`package-lock.json` or recursively scanning the repository. They use `src/` relative to each project's discovered root;
nonstandard layouts declare only a local `metadata.metrics.sourceDirectory` (for example `std` in the standard library).

## Production and test inputs

Builds use `production` and `^production`; tests use their own `default` files and dependency `production` files. Type checks keep their own test files. Test-only project imports still create graph edges even when declared as dev dependencies, so use local sample fixtures when the source package is not part of the behavior under test.

Tests build their workspace dependencies by default because imports resolve to built package exports, unless a target
has a more specific dependency configuration.

Test coverage is on demand only. Run `npx nx test <project> --coverage --skip-nx-cache` to generate a fresh report in
the project's `coverage/` directory. The shared Vitest preset includes unimported authored production files in `src/`;
generated data remains a production build input but is excluded from source coverage. Ordinary tests, including CI and
release validation, do not collect coverage. Nx caches regular test results, not the coverage reports.

Inspect resolved files with `npx nx show target inputs <project>:<target> --json` after changing dependencies, input
conventions, generators, or shipped assets. Use `npx nx run <project>:<target> --graph` to inspect prerequisite tasks.

## Migration Notes

- Vite configuration optimized for performance
- All existing npm scripts still work
- Package names and exports are unchanged; package manifests own their Nx configuration
- TypeScript builds work exactly as before
- Dependency resolution works correctly

This setup provides the foundation for modern development experience with the latest Vite build system.
