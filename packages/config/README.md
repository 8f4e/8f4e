# @8f4e/config

Centralized tooling configuration for the 8f4e workspace.

This package provides shared configuration helpers that allow packages to maintain thin local config files while sharing common defaults across the workspace.

## Usage

### TypeScript Configuration

Packages can extend the shared TypeScript base configurations:

```json
{
  "extends": "@8f4e/config/tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "src/**/*.test.ts"]
}
```

Available base configurations:
- `@8f4e/config/tsconfig.base.json` - Core compiler options (strict, module, etc.)
- `@8f4e/config/tsconfig.node.json` - For pure library packages (es2023 lib)
- `@8f4e/config/tsconfig.dom.json` - For browser/DOM packages (es2023 + DOM lib)
- `@8f4e/config/tsconfig.webworker.json` - For web worker packages (es2023 + webworker lib)

Note: `outDir`, `rootDir`, `include`, and `exclude` must be specified in each package's tsconfig.json as they are path-relative.

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
