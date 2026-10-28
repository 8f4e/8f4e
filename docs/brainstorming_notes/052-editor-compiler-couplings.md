# Remaining Editor–Compiler Couplings

Date: 2026-10-28

The compiler plugin owns compilation scheduling, its worker, and compile options. The remaining dependencies cover
compiled results, input notifications, lifecycle state, and publication order. This list records those boundaries and
the config ownership checked after extraction, for future architectural discussion.

- **Shared compiler state and statistics.** Core defines compiled-module/function lookups, memory plans, defaults,
  exposures, and compilation status in [the compiler state type](../../packages/editor/packages/editor-core/packages/editor-state-types/src/features/program-compiler/types.ts).
  [Default editor state](../../packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/state/createDefaultState.ts)
  also initializes compiler-specific statistics, even when the compiler plugin is omitted.

- **Block layout from compiled facts.** [Shape declarations](../../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/shape/updateGraphicData.ts)
  inspect compiled ASTs and inherited memory defaults. [Parameter shapes](../../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/paramShape/updateGraphicData.ts)
  inspect compiler expansion records to insert display rows.

- **Connector geometry and editor types.** [Inputs](../../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/inputs/updateGraphicData.ts)
  and [outputs](../../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/outputs/updateGraphicData.ts)
  derive connectors from compiler memory plans and exposure targets. Core's
  [Output and MemoryIdentifier types](../../packages/editor/packages/editor-core/packages/editor-state-types/src/features/code-blocks/types.ts)
  embed compiler-owned planned memory declarations.

- **Memory lookup services.** [Target resolution](../../packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/resolveMemoryTarget.ts)
  and [identifier/pointer resolution](../../packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/resolveMemoryIdentifier.ts)
  read compiler plans and exposure records. Most memory widgets inherit this dependency through core's exported helpers.

- **Compiler config ownership (checked).** The plugin owns the `recompileDebounceDelay` schema, default, and reader in
  [its config module](../../packages/editor/plugins/compiler/src/editor-config.ts), and registers/removes the schema in
  [its compilation effect](../../packages/editor/plugins/compiler/src/compilation.ts). Core's config type, default state,
  and validators contain no compiler-specific setting. The shared schema-contribution mechanism is the same generic
  extension point used by other plugins.

- **Config value resolution (result dependency).** The shared [schema resolver](../../packages/editor/packages/editor-core/packages/editor-state/src/features/editor-config/schemaValidator.ts)
  resolves the `memory-address` format through compiler-backed memory lookup. Removing direct compiler-state reads from
  consumers would still leave this indirect path. This depends on compiled memory metadata rather than ownership of a
  compiler setting.

- **Runtime lifecycle.** Core's [runtime coordinator](../../packages/editor/packages/editor-core/packages/editor-state/src/features/runtime/effect.ts)
  gates startup on `compiler.isCompiling`. The web-worker, audio-worklet, and test runtime definitions also subscribe
  to that field, despite receiving memory and bytecode getters through their factories. This is a compilation-readiness
  dependency beyond consuming the accepted result.

- **Diagnostics and assertions.** Core owns a `compilationErrors` bucket and assertion results containing compiler
  assertion-site types. [Error-message derivation](../../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/deriveErrorMessages.ts)
  checks compilation status before displaying assertion failures.

- **Rendering refresh and WASM execution.** The [render projection](../../packages/editor/packages/editor-core/packages/web-ui/packages/render-projection/src/projection.ts)
  subscribes to compiler status. The [WASM overlay drawer](../../packages/editor/packages/editor-core/packages/web-ui/src/drawers/wasmOverlayTexture.ts)
  instantiates compiled code, knows its host/assertion imports, and resolves compiler memory symbols. Generic texture
  drawing and execution of the compiled overlay are distinct responsibilities to reconsider.

- **Compilation-specific change notifications.** Editing, block creation/deletion, and generated constants call
  [incrementCompilerInputRevision](../../packages/editor/packages/editor-core/packages/editor-state/src/features/program-compiler/incrementCompilerInputRevision.ts).
  [Core's publisher](../../packages/editor/packages/editor-core/packages/editor-state/src/features/program-compiler/inputChanges.ts)
  observes `compilerInputRevision` and emits `compilationInputChanged`, which the compiler plugin listens to. Piano,
  slider, skip-execution, and memory-disconnection plugins also call the revision helper after changing source inputs.
  This is input-protocol coupling beyond compiled results; an editor-owned source-change contract could replace it.

- **Artifact event and publication order.** [Editor core](../../packages/editor/packages/editor-core/src/index.ts)
  consumes `compilationSucceeded` with `ProgramArtifacts` containing memory and bytecode. The compiler plugin must
  publish its handles and this event before metadata subscriptions run and `compiler.isCompiling` becomes false,
  so consumers see matching memory, metadata, and code. The event carries results, but the required sequence is an
  additional lifecycle contract.

- **Installation and disposal order.** The default composition installs the compiler before dependent plugins and
  injects its handles. Core dispatches the generic `dispose` event before plugin cleanup so runtimes stop before the
  compiler releases its worker. Ordering is part of the integration contract, while core's plugin installer and
  disposal event remain generic.

- **Shared source-model contract.** [Project serialization](../../packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/projectSerialization/serializeToProject.ts)
  and loading use `ProjectObjectModel` from `@8f4e/language-spec`. The compiler plugin consumes that same model through
  the public serialization helper. This is a shared input-language contract used by persistence and history too;
  changing the source model can affect both sides independently of changes to compiler results.

- **Already-extracted metadata consumers.** [Tooltips](../../packages/editor/plugins/tooltips/src/state/effect.ts)
  and the [stack widget](../../packages/editor/plugins/stack/src/state/directive.ts) read compiler facts through editor
  state. A candidate first step is to give their plugin factories a compiler-owned facts getter and update subscription.
  Tooltip [live-value drawing](../../packages/editor/plugins/tooltips/src/drawer/draw.ts) also uses the core memory
  resolver, so constructor injection needs to cover memory metadata as well as stack analysis and execution order.

- **Other plugin consumers.** Binary assets, MIDI, and assertion markers observe compiler plans or status directly.
  Button, switch, slider, piano, wave, meter, plot, bars, crossfade, watch, and keyboard-memory features use compiler-backed
  memory lookup helpers. Injected capabilities could make these dependencies explicit without adding compiler services
  to the shared editor plugin context.

- **Test-only package dependency.** [editor-state's package manifest](../../packages/editor/packages/editor-core/packages/editor-state/package.json)
  still declares `@8f4e/compiler` as a production dependency, although its remaining imports are in tests. Moving it to
  development dependencies is a separate small cleanup.

Tokenizer and project-source parsing dependencies are language support; they are separate from the compiled-result
and compilation-lifecycle dependencies listed above. Core has no production TypeScript imports of `@8f4e/compiler`,
`@8f4e/compiler-worker`, or the compiler plugin, and no compilation callback. Worker communication, include resolution,
and compile-option decisions stay within the plugin/worker integration. The scan also found no production imports
from compiler or compiler-worker back into editor packages.
