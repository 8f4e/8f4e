# Web Worker Runtime Guidelines

- Own worker-thread execution and the message protocol. Page-side setup and lifecycle tests belong to the
  worker-runtime plugin. Keep DOM dependencies out of the worker.
- Correlate initialization replies with `requestId` and ignore stale completions.
