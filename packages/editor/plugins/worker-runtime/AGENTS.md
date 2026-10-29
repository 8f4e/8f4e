# Worker Runtime Plugin

- Ordinary `EditorPlugin` factory; inject browser resources and live compiler getters from the default editor.
- Own the `workerRuntime` schema, enabled lifecycle, subscriptions, and disposal. Other runtimes remain independent.
- Keep execution-message handling tests here; worker/worklet algorithm tests stay in their execution packages.
- Publish info only under `info.workerRuntime` and use generic environment constant contributions.
- Run `npx nx run @8f4e/editor-plugin-worker-runtime:build|test|typecheck`.
