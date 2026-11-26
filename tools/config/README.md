# @8f4e/config

Centralized tooling configuration for the 8f4e workspace.

This package provides shared configuration helpers that allow packages to maintain thin local config files while sharing common defaults across the workspace.

## Usage

### TypeScript Configuration

Packages with the standard `src/` → `dist/` layout only need to select their environment:

```json
{
  "extends": "@8f4e/config/tsconfig.node.json"
}
```

Available presets:

- `@8f4e/config/tsconfig.base.json` - Core compiler options without a prescribed layout, for applications and other nonstandard projects.
- `@8f4e/config/tsconfig.library.json` - Adds the standard source and output paths without prescribing an environment or test exclusions.
- `@8f4e/config/tsconfig.node.json` - Standard Node.js library (ES2023 and Node types, excluding colocated test files).
- `@8f4e/config/tsconfig.dom.json` - Standard browser library (ES2023 and DOM, excluding colocated test files and `__tests__/` directories).
- `@8f4e/config/tsconfig.webworker.json` - Standard web worker library (ES2023 and web worker APIs, excluding colocated test files).

The library presets use TypeScript's `${configDir}` template (available since TypeScript 5.5) so source, output and exclusion
paths resolve relative to the consuming project's configuration, not the shared package. Override options and file patterns
locally only when a project differs from the defaults.

For test type checking, extend the project's configuration followed by the shared test overlay:

```json
{
  "extends": ["./tsconfig.json", "@8f4e/config/tsconfig.testing.json"],
  "compilerOptions": { "rootDir": "." },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

The overlay disables emission, enables Vitest globals and excludes `node_modules/` and `dist/`. Specify additional types,
source patterns or a different root directory locally when needed.
The shared preset is named differently from project-local `tsconfig.test.json` files so Nx retains it in dependency inputs.

For programmatic access to TypeScript options:

```ts
import { baseCompilerOptions, libBuildOptions, libs } from '@8f4e/config/ts';
```

### Vitest Configuration

```ts
import { defineConfig } from 'vitest/config';
import { createNodePreset } from '@8f4e/config/vitest';

export default defineConfig(
	createNodePreset({
		include: ['tests/**/*.test.ts'],
		typecheckEnabled: true,
	})
);
```

Available presets:
- `createNodePreset()` - For packages without DOM APIs
- `createJsdomPreset()` - For packages that need DOM APIs in tests
- `createPreset()` - Generic preset with full customization

Coverage includes authored production JavaScript and TypeScript files under the package's `src/`, even if no test imports
them. Declaration files, test files, test helper directories, snapshot directories, generated source directories and
`src/fixtures/` are excluded.
Coverage is generated only on demand using `npx nx test <project> --coverage --skip-nx-cache`. Reports use Vitest's
default package-local `coverage/` directory and are not cached by Nx.

### Vite Configuration

```ts
import { defineConfig } from 'vite';
import { createEsLibConfig } from '@8f4e/config/vite';

export default defineConfig(createEsLibConfig('./src/index.ts'));
```

Available helpers:
- `createEsLibConfig()` - Simple ES module library
- `createLibConfig()` - Full customization
- `createWorkerLibConfig()` - Web worker library

## Philosophy

Only **shared/common defaults** should live in `@8f4e/config`. Package-specific behavior (custom aliases, environment tweaks, include/exclude patterns, etc.) should stay in each package's own config wrapper.

This keeps packages self-contained while avoiding heavy configuration duplication.
