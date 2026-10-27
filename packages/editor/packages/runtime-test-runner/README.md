# Test Runtime

`@8f4e/runtime-test-runner` provides the selectable `TestRuntime` in the default editor. Add this editor configuration
directive to a project that has a test entry:

```8f4e
; @config runtime TestRuntime
```

The runtime executes the compiled `test` export once after each successful compilation or recompilation. Selecting
it after compilation executes the latest successful program once. It has no timer or repeating execution loop.
Projects without an enabled test entry and failed compilations do not run.

Execution uses `@8f4e/test-runner` in a dedicated worker with the editor's existing shared memory. The compiler worker
owns default initialization and patches changed defaults on recompilation. The test runner does not initialize or
reset supplied memory; test writes remain visible in the editor and survive recompilation according to the existing
compiler memory policy.

A new compilation or runtime disposal terminates the test worker; superseded results are ignored. The runtime
publishes its state under `state.runtime.values.TestRuntime`, containing
the status (`idle`, `running`, `passed`, `failed`, or `error`), static assertion sites, and completed
assertion results or runtime error. Assertion failures are also formatted in the browser console.

Execution results, run status, and worker-message types belong to this runtime package. Separately, the runtime
publishes executed source sites, pass/fail outcomes, and formatted failure messages to `state.assertionResults`, whose `AssertionResult` type
belongs to `@8f4e/editor-state-types` and has no test-runner dependency. The optional
`@8f4e/editor-plugin-assertion-markers` reads that array and current block layout in its drawer to cover assertion
line numbers with pass/fail indicators. The array is cleared when compilation starts, a new run starts,
a run errors, or the runtime is disposed; results remain visible during recompilation debouncing.

Failed assertions also appear as inline editor errors below their source line. Equality failures show both values
(for example, `Assertion failed: expected 9, received 10`); condition failures show the expected nonzero condition
and the received value. Repeated invocations produce one message per source site, using its first failed invocation.

Validate from the workspace root:

```bash
npx nx run @8f4e/runtime-test-runner:build
npx nx run @8f4e/runtime-test-runner:test
npx nx run @8f4e/runtime-test-runner:typecheck
```
