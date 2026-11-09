# Audio Worklet Guidelines

- Own audio-thread execution and the message protocol. Page-side setup and lifecycle tests belong to the
  audio-runtime plugin. Keep the worklet entry small and free of DOM dependencies.
- Correlate initialization replies with `requestId` and ignore stale completions.
- Emit the Vite worklet bundle before TypeScript output. Preserve the bundle for consuming plugins.
