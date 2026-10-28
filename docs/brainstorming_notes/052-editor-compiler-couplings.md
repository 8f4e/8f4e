# Remaining Editor–Compiler Couplings

Date: 2026-10-28

The compiler plugin owns compilation scheduling and its worker. This list records the compiler-result and lifecycle
dependencies that remain in the editor and its consumers after that extraction, for future architectural discussion.

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

- **Config value resolution.** The shared [schema resolver](../../packages/editor/packages/editor-core/packages/editor-state/src/features/editor-config/schemaValidator.ts)
  resolves the `memory-address` format through compiler-backed memory lookup. Removing direct compiler-state reads from
  consumers would still leave this indirect path.

- **Runtime lifecycle.** Core's [runtime coordinator](../../packages/editor/packages/editor-core/packages/editor-state/src/features/runtime/effect.ts)
  gates startup on `compiler.isCompiling`. The web-worker, audio-worklet, and test runtime definitions also subscribe
  to that field, despite receiving memory and bytecode getters through their factories.

- **Diagnostics and assertions.** Core owns a `compilationErrors` bucket and assertion results containing compiler
  assertion-site types. [Error-message derivation](../../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/deriveErrorMessages.ts)
  checks compilation status before displaying assertion failures.

- **Rendering refresh and WASM execution.** The [render projection](../../packages/editor/packages/editor-core/packages/web-ui/packages/render-projection/src/projection.ts)
  subscribes to compiler status. The [WASM overlay drawer](../../packages/editor/packages/editor-core/packages/web-ui/src/drawers/wasmOverlayTexture.ts)
  instantiates compiled code, knows its host/assertion imports, and resolves compiler memory symbols. Generic texture
  drawing and execution of the compiled overlay are distinct responsibilities to reconsider.

- **Compilation-specific change notifications.** Editing, block creation/deletion, and generated constants call
  [incrementCompilerInputRevision](../../packages/editor/packages/editor-core/packages/editor-state/src/features/program-compiler/incrementCompilerInputRevision.ts).
  Core also consumes the compiler-named `compilationSucceeded` event. Source-change notifications and program-artifact
  delivery could eventually have editor-owned contracts independent of a particular compiler.

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
and compilation-lifecycle dependencies listed above. The scan found no production imports from compiler or
compiler-worker back into editor packages.
