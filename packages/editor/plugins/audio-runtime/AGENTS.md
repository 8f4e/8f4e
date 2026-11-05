# Audio Runtime Plugin

- Track worklet-module loading and WASM initialization separately through `loading.add`. Exclude permission prompts.
  Use IDs `audio-worklet`/`audio-runtime` with custom messages. Match replies by `requestId`, report done/failed,
  and cancel pending attempts on replacement or teardown. Presentation owns private visibility.
- Ordinary browser `EditorPlugin` factory; inject live compiler getters and an optional shared AudioContext from the host composition.
- Import `@8f4e/runtime-audio-worklet/worklet?url` here and own browser API use, permissions, and resource cleanup. Keep worklet execution code in its separate package.
- The TypeScript build preserves Vite asset imports for the consuming browser build; `src/source-files.d.ts` supplies their types.
- Own the `audioRuntime` schema, enabled lifecycle, subscriptions, and disposal. Other runtimes remain independent.
- Test the public plugin factory with real editor state and configuration here; execution algorithms stay tested in their worker/worklet packages.
- Publish info only under `info.audioRuntime` and use generic environment constant contributions.
- Run `npx nx run @8f4e/editor-plugin-audio-runtime:build|test|typecheck`.
