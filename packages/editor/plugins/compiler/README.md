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
    callbacks: {},
    runtimeRegistry: {},
    plugins: [compiler.plugin, createButtonPlugin({ writeMemory: compiler.writeMemory })],
});
```

The factory returns stable `getMemory`, `getCodeBuffer`, `getAssertionSites`, and `writeMemory` handles alongside
`plugin`. Pass individual handles to feature factories or runtime definitions. Before the first successful compilation,
memory is `null`, bytecode is empty, assertion sites are undefined, and memory writes do nothing. The worker is created
only when compilation begins. A factory instance installs once; create a new instance for each editor.

The default worker uses Vite's `?worker` import. Hosts can inject `createWorker: () => Worker`; `resolveInclude` is
also injected at construction. Editor state does not forward a compiler or include callback.

## Input and result events

Core emits `compilationInputChanged` after `compilerInputRevision` advances. Source edits, project loading and
undo/redo, block insertion/removal, execution changes, regenerated environment constants, and saved control defaults
advance that revision after their derived state is updated. Visual edits and navigation do not advance it.

The plugin listens to that event, debounces it, and serializes the latest root code-block tree, including nested
projects. The default delay is 500ms; projects can set `; @config recompileDebounceDelay 120`. The plugin registers and
removes the validator for that setting. Compilation always requests stack analysis and enables assertions when the
project has an enabled test entry, including nested tests and a root function exported as `test`.

For an accepted result, the plugin first updates its artifact handles and emits `compilationSucceeded` with a
`CompilationResult`. Core consumes that event to refresh memory views and renderer bytecode. The plugin then publishes
compiler lookups, memory plans/defaults and project exposures, statistics, and diagnostics to shared editor state.
`compiler.isCompiling` becomes false only after the compiler metadata is available, allowing runtimes to consume it.
The binary-assets plugin observes the new memory plan and copies retained bytes into the current memory.

Each input change invalidates outstanding results immediately, including during the next debounce interval. The plugin runs one worker compilation at a time because the worker shares memory and caches across requests; edits arriving during compilation coalesce into the latest snapshot once its debounce interval has elapsed. Superseded
successes and failures cannot replace handles, rendering artifacts, compiler metadata, or diagnostics. Failed current
compilations retain the previous memory and bytecode and publish the diagnostic instead.

## Lifecycle

Editor initialization installs plugins before loading initial content. On editor disposal, core sends `dispose` to
stop its runtime coordinator before releasing plugins. Plugins are released in reverse installation order, so dependent
feature plugins shut down before the compiler. Compiler cleanup removes its event listener and configuration validator,
cancels the debounce, ignores late results, rejects pending worker requests, and terminates its worker. Cleanup also
runs after initialization failures and when another plugin's disposer throws.

Run `npx nx run @8f4e/editor-plugin-compiler:build|test|typecheck` from the workspace root.
