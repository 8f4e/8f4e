# Worker Runtime Plugin

- Ordinary browser `EditorPlugin` factory; inject only live compiler getters from the default editor.
- Import `@8f4e/runtime-web-worker?worker` here and own worker creation and cleanup. Keep execution code in its separate package.
- The TypeScript build preserves Vite asset imports for the consuming browser build; `src/source-files.d.ts` supplies their types.
- Own the `workerRuntime` schema, enabled lifecycle, subscriptions, and disposal. Other runtimes remain independent.
- Keep execution-message handling tests here; worker/worklet algorithm tests stay in their execution packages.
- Publish info only under `info.workerRuntime` and use generic environment constant contributions.
- Run `npx nx run @8f4e/editor-plugin-worker-runtime:build|test|typecheck`.
