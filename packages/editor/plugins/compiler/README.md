# Compiler Plugin

`@8f4e/editor-plugin-compiler` owns compilation scheduling, worker communication, include resolution, current
WebAssembly artifacts, diagnostics, statistics, and memory writes for one editor instance.

Construct it before dependent plugins, then install its `plugin` first:

```ts
import initEditor from '@8f4e/editor-core';
import { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createButtonPlugin } from '@8f4e/editor-plugin-button';

const compiler = createCompilerPlugin({ resolveInclude });
const editor = await initEditor(canvas, {
    plugins: [compiler.plugin, createButtonPlugin({ writeMemory: compiler.writeMemory })],
});
```

The factory returns stable `getMemory`, `getCodeBuffer`, `getAssertionSites`, and `writeMemory` handles alongside
`plugin`. Pass individual handles to feature factories or runtime definitions. Before the first successful compilation,
memory is `null`, bytecode is empty, assertion sites are undefined, and memory writes do nothing. The worker is created
only when compilation begins. A factory instance installs once; create a new instance for each editor.

The default worker uses Vite's `?worker` import. Hosts can inject `createWorker: () => Worker`; `resolveInclude` is
also injected at construction. The public editor options contain no callback bag. Editor state receives internal browser callbacks from core; the compiler
plugin receives its worker and include dependencies directly.

## Input and result events

Core emits `compilationInputChanged` after `compilerInputRevision` advances. Source edits, project loading and
undo/redo, block insertion/removal, execution changes, regenerated environment constants, and saved control defaults
advance that revision after their derived state is updated. Visual edits that preserve compilation inputs and
navigation leave the revision unchanged.

The plugin listens to that event, debounces it, and serializes the latest root code-block tree, including nested
projects. The default delay is 500ms; projects can set `; @config recompileDebounceDelay 120`. The plugin contributes an integer schema with a minimum of zero through
`editorConfigSchemaContributions.compilerDebounce`, and removes that contribution on disposal. Compilation always requests stack analysis and enables assertions when the
root project declares a `test` entry or an enabled function exported as `test`. Group entries named `test` remain
local; groups placed inside the root test entry run their own `main` as part of that test.

Each active compilation contributes `{ id: 'compiler', message: 'Compiling...' }` through `loading.add` after
debounce. Success and failure report their respective terminal status; superseded attempts and disposal cancel
pending work. Sequential attempts replace the same ID. Results and finish timestamps remain in state independently of presentation.

For an accepted result, the plugin first updates its artifact handles and emits `compilationSucceeded` with the
`ProgramArtifacts` needed for rendering: `memoryRef`. Core consumes that event to refresh memory views; bytecode stays
on the compiler getter. The plugin replaces `state.compiler.result` in one store update containing all compiler lookups,
memory plans/defaults and project exposures, while `isCompiling` remains true. Every metadata subscriber sees the
complete result without notifying compilation-progress subscribers. Once those subscribers finish, the plugin sets `compiler.isCompiling` false so runtimes resume,
then publishes statistics and diagnostics. The binary-assets plugin observes the new memory plan and copies retained
bytes into current memory before runtimes run, regardless of subscription order.

Each input change invalidates outstanding results immediately, including during the next debounce interval. The plugin
runs one worker compilation at a time because the worker shares memory and caches across requests; edits arriving
during compilation coalesce into the latest snapshot once its debounce interval has elapsed. Superseded
successes and failures cannot replace handles, rendering artifacts, compiler metadata, or diagnostics. Failed current
compilations retain the previous memory and bytecode and publish the diagnostic instead.

The plugin replaces its raw errors through `codeErrors.compiler` and removes that contribution on disposal.
Core directive validation owns `codeErrors['editor-directives']`; other plugins can publish their own lists.
Inline message layout and drawing belong to `editor-plugin-error-messages`.

## Function inlining

The editor inlines eligible functions by default. Use `; @config compiler.functionInlining.enabled false` to disable
inlining for the project, or set it to `true` to enable it explicitly. Changes to these settings trigger compilation.

```8f4e
; @config compiler.functionInlining.maxExpansionOperations 24
; @config compiler.functionInlining.maxCallerGrowth 64
```

Both limits accept non-negative integers, including zero. `maxExpansionOperations` caps each replacement, including
argument stores and local initialization. `maxCallerGrowth` caps the total additional operations from inlining in
each caller. Omit a limit to leave that budget uncapped.

## Lifecycle

Editor initialization installs plugins before loading initial content. On editor disposal, core sends `dispose` to
dispose execution plugins before releasing compiler resources. Plugins are released in reverse installation order, so dependent
feature plugins shut down before the compiler. Compiler cleanup removes its event listener and configuration schemas,
cancels the debounce, ignores late results, rejects pending worker requests, and terminates its worker. Cleanup also
runs after initialization failures and when another plugin's disposer throws.

Run `npx nx run @8f4e/editor-plugin-compiler:build|test|typecheck` from the workspace root.
