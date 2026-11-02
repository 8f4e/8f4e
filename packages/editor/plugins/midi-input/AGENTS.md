# MIDI Input Plugin

- Own MIDI configuration, access/discovery, stable port indexing, callback bindings, and WASM instance caching here.
- Receive navigator and current-memory/bytecode getters through `createMidiInputPlugin`. Keep those resources out
  of the shared plugin context and do not reintroduce an environment-plugin manager or services wrapper in core.
- Request access only for configured projects. Remove listeners on recompilation, config removal, and disposal;
  ignore stale asynchronous results. Dispose device discovery and the owned schema explicitly.
- Verify with `npx nx run @8f4e/editor-plugin-midi-input:build|test|typecheck`; use simulated ports with real compiled
  callbacks for integration coverage.
