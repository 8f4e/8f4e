# Test Runtime Plugin

`@8f4e/editor-plugin-test-runtime` is an ordinary editor plugin. Load it when the project contains
`@config testRuntime` settings. Enable execution with:

```text
; @config testRuntime.enabled true
```

The plugin registers its schema on setup and initializes from current configuration and compiler artifacts. It can
run alongside other runtimes, sharing the compiler's memory. Disabling it stops its own execution. A loaded plugin
stays installed until editor disposal. For lazy installation, match cached raw configuration with project scope
so configuration added during editing or inside unopened groups can trigger loading.

The host supplies live memory, bytecode, and assertion-site getters. The plugin imports the worker entry from the
separate `@8f4e/runtime-test-runner` execution package using Vite's `?worker` asset handling. It runs the compiled test
entry once per successful compilation. It publishes `status`, `assertionCount`, and `failureCount` (or `error`) to
`info.testRuntime`, and executed assertion source sites and outcomes through core's `assertionResults`. It terminates
superseded workers and clears assertion markers on disable, recompilation, and disposal.

Failed source assertions become raw `CodeError` records in `state.codeErrors['test-runtime']`, one per failed site,
with formatted expected/received details. Failure text is stored only in this error collection. Included source and
disabled blocks produce no inline error contribution. Source input changes refresh this list; restart clears it and
disposal removes it. `editor-plugin-error-messages` owns message wrapping, layout, and drawing.

Validate with `npx nx run @8f4e/editor-plugin-test-runtime:build|test|typecheck`.

## Loading indicators

The worker job contributes ID `test-runtime` and message `Running tests...`. Passing marks it done; assertion
failures or worker errors mark it failed. Replacement, disable, and disposal cancel pending jobs. The worker returns
one terminal result after program initialization and execution. Results remain for presentation cleanup.
