# Test Runtime Plugin

`@8f4e/editor-plugin-test-runtime` is an ordinary editor plugin. The default composition imports it when the project contains
`@config testRuntime` settings. Enable execution with:

```text
; @config testRuntime.enabled true
```

The plugin registers its schema on setup and initializes from current configuration and compiler artifacts. It can
run alongside other runtimes, sharing the compiler's memory. Disabling it stops its own execution. A loaded plugin
stays installed until editor disposal; configuration introduced by editing uses **Load plugins used by project**.

The host supplies the test Worker constructor and live memory, bytecode, and assertion-site getters. The plugin runs
the compiled test entry once per successful compilation, publishes status and results to `info.testRuntime`, and
publishes executed sites and formatted failure messages through core's generic `assertionResults`. It terminates
superseded workers and clears assertion markers on disable, recompilation, and disposal.

Validate with `npx nx run @8f4e/editor-plugin-test-runtime:build|test|typecheck`.
