# Compiler Plugin

- Export `createCompilerPlugin({ resolveInclude, createWorker })`, returning `plugin` plus stable `getMemory`,
  `getCodeBuffer`, `getAssertionSites`, and `writeMemory` handles. Construct once per editor; install before dependents.
- Own scheduling, worker transport, include requests, accepted artifacts, diagnostics, statistics, memory-write views,
  and the recompile debounce validator here. Core must not invoke a compiler callback or install a compilation effect.
- Listen to `compilationInputChanged`, emitted by core after its input revision advances. Read the latest project tree
  after debouncing, using public serialization helpers. Keep worker creation lazy.
- Run only one worker compilation at a time; coalesce edits received in flight and respect the latest debounce interval.
- Check input generation before accepting results in both the worker adapter and publication effect, including changes
  during debounce. Publish handles and the `compilationSucceeded` rendering event before metadata and runtime readiness.
- Cancel scheduling before rejecting pending requests and terminating the worker. Release every owned registration;
  ignore late results and keep editor instances isolated. Cache typed memory-write views and refresh after growth.
- Inject include resolution through the factory. The default Vite worker import belongs to this package; do not move
  stdlib discovery or runtime selection into it.
- Run `npx nx run @8f4e/editor-plugin-compiler:build|test|typecheck` after changes. Keep tests for trigger scheduling,
  assertion selection, diagnostic mapping, current artifacts, stale successes/failures, worker isolation, and cleanup.
