# Editor State Testing Package

This package provides framework-agnostic test helpers for packages that consume editor-state data structures.

It intentionally does not depend on `@8f4e/editor-state`, so tests in downstream packages can create state-shaped mocks without creating a release dependency on the editor-state implementation package.

## Shared state fixtures

Use `createMockState` instead of casting a partial literal to `State`. Its defaults are checked against the complete
state contract, including compiler memory plans and exposure tables. Each call creates fresh mutable defaults.
Declare this package as a development dependency of any package importing it in tests.

```typescript
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';

const blocks = [createMockCodeBlock({ code: ['module voice', 'moduleEnd'] })];
const state = createMockState({
	compiler: { isCompiling: true },
	codeBlockRendering: { rootCodeBlocks: blocks },
	callbacks: { loadSession: async () => null },
});
```

Nested object overrides preserve unrelated defaults. Arrays, maps, sets, typed arrays, and callbacks replace their
defaults and retain the supplied identity; do not reuse mutable overrides across tests unless that sharing is intentional.
For a root-only or active-only block override, both block lists reference that same array. To model a nested project,
provide both the root tree and its active nested array explicitly:

```typescript
const nested = [createMockCodeBlock({ name: 'voice', projectPath: 'Audio' })];
const root = [createMockCodeBlock({ name: 'Audio', nestedProjectCodeBlocks: nested })];
const state = createMockState({
	codeBlockRendering: { rootCodeBlocks: root, codeBlocks: nested },
});
```

The generic code-block builder leaves `parsedDirectives` empty. Tests inside editor-state that need parsed source or
directive derivation should use its local `pureHelpers/testingUtils/testUtils` helpers. Those helpers retain the
editor-specific parsing behavior and re-export the shared state builder; they do not own a second set of state defaults.
For a genuinely narrow API, prefer a fixture typed to that API's narrow contract rather than asserting it is a full state.
