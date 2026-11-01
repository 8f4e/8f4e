# Test Runtime Plugin

- Ordinary browser `EditorPlugin` factory; inject only live compiler getters from the default editor.
- Import `@8f4e/runtime-test-runner?worker` here and own worker creation and cleanup. Keep execution code in its separate package.
- The TypeScript build preserves Vite asset imports for the consuming browser build; `src/source-files.d.ts` supplies their types.
- Own the `testRuntime` schema, enabled lifecycle, subscriptions, and disposal. Other runtimes remain independent.
- Keep execution-message handling tests here; worker/worklet algorithm tests stay in their execution packages.
- Publish info only under `info.testRuntime` and use generic environment constant contributions.
- Run `npx nx run @8f4e/editor-plugin-test-runtime:build|test|typecheck`.
