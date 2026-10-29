# Worker Runtime Plugin

`@8f4e/editor-plugin-worker-runtime` is an ordinary editor plugin. The default composition imports it when the project contains
`@config workerRuntime` settings. Enable execution with:

```text
; @config workerRuntime.enabled true
```

The plugin registers its schema on setup and initializes from current configuration and compiler artifacts. It can
run alongside other runtimes, sharing the compiler's memory. Disabling it stops its own execution. A loaded plugin
stays installed until editor disposal; configuration introduced by editing uses **Load plugins used by project**.

Configure `workerRuntime.entry` and `workerRuntime.sampleRate` to select the exported entry and its rate.
The defaults are `main` and `50` respectively.
The plugin contributes `SAMPLE_RATE` by default. Set `workerRuntime.sampleRateConstantName` to choose its name:

```text
; @config workerRuntime.sampleRateConstantName CONTROL_RATE
```

Concurrent runtimes should use distinct constant names. Contributions are ordinary source in `constants env`;
the compiler handles conflicting declarations. Statistics are published under the fixed `info.workerRuntime` namespace.

The host supplies the Worker constructor and current compiler memory and bytecode getters.

Validate with `npx nx run @8f4e/editor-plugin-worker-runtime:build|test|typecheck`.
