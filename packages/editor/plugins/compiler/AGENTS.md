# Compiler Plugin

- Own scheduling, worker transport, include requests, accepted artifacts, diagnostics and writable memory views.
  The composition supplies include resolution and passes the compiler's live handles to dependents.
- Compile on `compilationInputChanged`. Coalesce edits, keep worker jobs sequential and reject stale results
  before accepting artifacts or publishing diagnostics. Keep diagnostic reads detached and revision-aware.
- Publish live artifacts and `compilationSucceeded` before atomically replacing `state.compiler.result`. Clear
  `isCompiling` after result subscribers have handled the memory plan so runtimes resume against current memory.
- Publish raw errors as a contributor. Keep error presentation and layout in error-messages. Core's source-edit
  helper invalidates compiler inputs for all directive edits, including configuration.
