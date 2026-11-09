# Compiler Plugin

- Export `createCompilerPlugin({ resolveInclude, createWorker })`, returning `plugin` plus stable `getMemory`,
  `getCodeBuffer`, `getAssertionSites`, `getDiagnostics`, and `writeMemory` handles. Construct once per editor; install before dependents.
- Diagnostic reads are detached and identify the current input revision, completed revision, and readiness. Do not present previous-input compiler errors as current while a new compilation is pending.
- Own scheduling, worker transport, include requests, accepted artifacts, diagnostics, statistics, memory-write views,
  and the compiler config schemas here. Core must not invoke a compiler callback or install a compilation effect.
- Publish raw errors through the contributor-owned `codeErrors.compiler` list and remove it on disposal. Message
  presentation belongs to error-messages; do not reserve layout or store drawing geometry here.
- Listen to `compilationInputChanged`, emitted by core after its input revision advances. Read the latest project tree
  after debouncing, using public serialization helpers. Keep worker creation lazy.
- Contribute `{ id: 'compiler', message: 'Compiling...' }` for each active attempt after debounce.
  Report done/failed results; cancel superseded attempts and pending work on disposal. New attempts replace the
  same ID. Queued requests remain sequential; the presentation plugin owns private visibility.
- Run only one worker compilation at a time; coalesce edits received in flight and respect the latest debounce interval.
- Contribute the integer `recompileDebounceDelay` config schema through `editorConfigSchemaContributions.compiler`.
  Keep its typing and default in this package; use the shared directive validation and parsing mechanism.
- Contribute the `functionInlining` schema through `editorConfigSchemaContributions.compilerFunctionInlining`.
  Advance the compiler input revision when the resolved inlining settings change, including when notes are reordered.
- The internal worker adapter requires an explicit current-input check and returns the canonical language-spec result.
  Core receives only `ProgramArtifacts` containing `memoryRef`; bytecode stays on the compiler getter.
  Do not reconstruct the old core compiler-result interface.
- Check input generation before accepting results in both the worker adapter and publication effect, including changes
  during debounce. Publish handles and the `compilationSucceeded` rendering event before metadata and runtime readiness.
- Publish all compiler metadata atomically by replacing `state.compiler.result` in one store update while `isCompiling` is
  true. Result publication must not notify progress subscribers. Set `isCompiling` false afterward so memory-plan subscribers finish loading assets before runtimes resume.
- Cancel scheduling before rejecting pending requests and terminating the worker. Release every owned registration;
  ignore late results and keep editor instances isolated. Cache typed memory-write views and refresh after growth.
- Inject include resolution through the factory. The default Vite worker import belongs to this package; do not move
  stdlib discovery or runtime selection into it.
- Keep `@8f4e/state-manager` in devDependencies; its direct import belongs to the compilation tests, not shipped code.
- Run `npx nx run @8f4e/editor-plugin-compiler:build|test|typecheck` after changes. Keep tests for trigger scheduling,
  assertion selection, diagnostic mapping, current artifacts, stale successes/failures, worker isolation, and cleanup.
