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
advance that revision after their derived state is updated. Visual edits and navigation do not advance it.

The plugin listens to that event, debounces it, and serializes the latest root code-block tree, including nested
projects. The default delay is 500ms; projects can set `; @config recompileDebounceDelay 120`. The plugin contributes an integer schema with a minimum of zero through
`editorConfigSchemaContributions.compiler`, and removes that contribution on disposal. Compilation always requests stack analysis and enables assertions when the
project has an enabled test entry, including nested tests and a root function exported as `test`.

For an accepted result, the plugin first updates its artifact handles and emits `compilationSucceeded` with the
`ProgramArtifacts` needed for rendering: `memoryRef`. Core consumes that event to refresh memory views; bytecode stays
on the compiler getter. The plugin replaces `state.compiler` in one store update containing all compiler lookups,
memory plans/defaults and project exposures, while `isCompiling` remains true. Every metadata subscriber sees the
complete result. Once those subscribers finish, the plugin sets `compiler.isCompiling` false so runtimes resume,
then publishes statistics and diagnostics. The binary-assets plugin observes the new memory plan and copies retained
bytes into current memory before runtimes run, regardless of subscription order.

Each input change invalidates outstanding results immediately, including during the next debounce interval. The plugin
runs one worker compilation at a time because the worker shares memory and caches across requests; edits arriving
during compilation coalesce into the latest snapshot once its debounce interval has elapsed. Superseded
successes and failures cannot replace handles, rendering artifacts, compiler metadata, or diagnostics. Failed current
compilations retain the previous memory and bytecode and publish the diagnostic instead.

## Lifecycle

Editor initialization installs plugins before loading initial content. On editor disposal, core sends `dispose` to
dispose execution plugins before releasing compiler resources. Plugins are released in reverse installation order, so dependent
feature plugins shut down before the compiler. Compiler cleanup removes its event listener and configuration schema,
cancels the debounce, ignores late results, rejects pending worker requests, and terminates its worker. Cleanup also
runs after initialization failures and when another plugin's disposer throws.

Run `npx nx run @8f4e/editor-plugin-compiler:build|test|typecheck` from the workspace root.
