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

All packages in `packages/` (including nested directories) are automatically detected as Nx projects with their original names:

- `@8f4e/editor-default`
- `@8f4e/editor-website`
- `@8f4e/editor-core`
- `glugglugglug` (`packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug`)
- `@8f4e/sprite-generator` (`packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator`)
- `@8f4e/compiler`
- `@8f4e/compiler-worker`
- `@8f4e/runtime-audio-worklet`
- `@8f4e/runtime-web-worker`

## Configuration

- **nx.json**: Main Nx configuration with caching and dependency rules
- **package.json**: Updated scripts to use Nx commands
- **Workspaces**: Still configured for package linking compatibility

## Production and test inputs

Builds use `production` and `^production`; tests use their own `default` files and dependency `production` files. Type checks keep their own test files. Test-only project imports still create graph edges even when declared as dev dependencies, so use local sample fixtures when the source package is not part of the behavior under test.

Run `npx nx run @8f4e/release:audit-build-inputs` after changing dependencies, input conventions, generators, or shipped assets. Add `--output-style=static -- --inventory` to inspect test-only source references. The [workspace audit](build-input-audit.md) records confirmed cases, preserved shipped assets, verification and remaining package-boundary follow-ups.

## Migration Notes

- Vite configuration optimized for performance
- All existing npm scripts still work
- Package.json files in packages unchanged
- TypeScript builds work exactly as before
- Dependency resolution works correctly

This setup provides the foundation for modern development experience with the latest Vite build system.
