# Test Runtime Plugin

`@8f4e/editor-plugin-test-runtime` is an ordinary editor plugin. The default composition imports it when the project contains
`@config testRuntime` settings. Enable execution with:

```text
; @config testRuntime.enabled true
```

The plugin registers its schema on setup and initializes from current configuration and compiler artifacts. It can
run alongside other runtimes, sharing the compiler's memory. Disabling it stops its own execution. A loaded plugin
stays installed until editor disposal. Both editor compositions automatically detect configuration after editing
and across unopened groups, using cached parsed directives.

The host supplies live memory, bytecode, and assertion-site getters. The plugin imports the worker entry from the
separate `@8f4e/runtime-test-runner` execution package using Vite's `?worker` asset handling. It runs the compiled test
entry once per successful compilation. It publishes `status`, `assertionCount`, and `failureCount` (or `error`) to
`info.testRuntime`, and executed assertion outcomes with source sites and formatted failure messages through core's
generic `assertionResults`. It terminates superseded workers and clears assertion markers on disable, recompilation,
and disposal.

Validate with `npx nx run @8f4e/editor-plugin-test-runtime:build|test|typecheck`.
