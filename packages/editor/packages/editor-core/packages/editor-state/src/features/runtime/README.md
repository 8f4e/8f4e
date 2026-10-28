# Runtime Feature

The runtime coordinator owns executable runtime definitions, lazy loading, and instance lifecycle. The host supplies
`Options.runtimeRegistry` directly during initialization. Editor state contains only runtime metadata in
`state.runtimeRegistry`: IDs and optional configuration schemas.

A registry entry supplies either a `factory(store, events)` returning a disposer, or a lazy `load()` returning a full
runtime definition. Lazy entries advertise a permissive configuration schema before loading. The coordinator caches
loaded definitions per editor, publishes the full schema on completion, and triggers configuration revalidation.
Factories, loaders, in-flight promises, and active-runtime disposers stay outside observable state.

`state.editorConfig.runtime` selects a registered runtime; no runtime starts without an explicit selection. Switching
stops the old runtime before starting the new one. Initialization waits while compilation is in progress, and late
loads cannot start an obsolete selection or publish state after disposal. Failed loads can be retried on a later
selection or compilation.

Runtime definitions may provide `getEnvConstants(editorConfig)`. The coordinator evaluates it when configuration or
the loaded definition changes and publishes source lines through `state.envConstantContributions.runtime`. The generic
auto-env-constants feature consumes those lines without calling runtime implementations.

Runtime result and diagnostic data remain observable, including test results and AudioWorklet buffer-size reporting.
