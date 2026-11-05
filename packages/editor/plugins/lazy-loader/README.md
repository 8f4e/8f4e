# Lazy Plugin Loader

`@8f4e/editor-plugin-lazy-loader` is a regular editor plugin that automatically installs other plugins when their
cached editor directives match. Fixed plugins still go directly into the editor's `plugins` array. Lazy entries
supply a loading scope, lightweight matching logic, and a dynamic import.

```ts
import { createLazyPluginLoaderPlugin, hasDirective } from '@8f4e/editor-plugin-lazy-loader';

const loader = createLazyPluginLoaderPlugin([
	{
		id: 'plot',
		scope: 'view',
		matches: directives => hasDirective(directives, 'plot'),
		load: () => import('@8f4e/editor-plugin-plot').then(module => module.plotPlugin),
	},
]);
```

Pass the loader alongside fixed plugins when constructing the editor. Use `view`
scope for plot, wave, meter, bars, watch, stack, switch, button, piano, slider, and crossfade. Supply the editor's
live memory writer to control factories after their implementations load. Keyboard-to-memory input, MIDI input, binary assets, and
audio/worker/test/texture runtime plugins use `project` scope. The texture runtime matches both `@texture` and its config root.
Keyboard-to-memory input matches raw `@config keyboard.*` directives before its schema is installed.
Watch matches `@watch`/`@w`; stack matches `@stack`/`@s`.

Each `LazyEditorPlugin` entry contains `id`, required `scope: 'view' | 'project'`, `matches(directives)`, and
`load(): Promise<EditorPlugin>`. Keep IDs unique and implementation imports inside `load`. The loader reads core's
cached `codeBlock.parsedDirectives` records without serializing the project or parsing source again:

- `view` passes directives from the current project level, including blocks outside the screen, without descending
  into groups. Entering a group discovers the plugins needed by its contents.
- `project` passes directives from every block in the recursive project tree, including unopened groups. Runtime,
  MIDI, and asset behavior can therefore start without navigating to its configuration.

`hasDirective(directives, name)` matches an exact directive name without requiring its implementation to be installed.
`hasConfig(directives, root)` matches raw `@config` paths equal to the root or beginning with `${root}.`, allowing
configuration to trigger loading before its schema exists. Presence triggers loading; the loaded plugin owns argument
validation. These helpers consume parsed records directly, including chained and trailing editor directives.

The loader scans during setup and automatically after completed project changes, including typing, paste, module
insertion, API edits, undo/redo, file opens, URL loads, and session restoration. It also watches changes to the current
project level so group navigation triggers loading. Synchronous notifications share one microtask scan, allowing API
edits to finish restoring their current group before matching. There is no manual scan action or menu item.

Imports run in the background. Editor mounting and project-load notifications do not wait for them; plots appear
when their implementation arrives. Plugins own independent layout contributions and subscriptions. Submitting a
changed contribution automatically recalculates layout and rendered source without editing the project or triggering
compilation. Plugins installed late must initialize from current state rather than depend on an earlier startup or
compilation event being replayed.

Each entry installs once per editor. Overlapping scans share its pending load. Once requested, a plugin still installs
if the project or current group changes while its import is pending, and remains installed until editor disposal.
Removing a signal or leaving a group does not unload it. Entries install in import-completion order; keep
order-dependent plugins in the fixed list.

Each import/setup contributes ID `plugin:<entry.id>` and message `Loading <entry.id>...`. Successful setup marks
it done, import/setup errors mark it failed, and disposal cancels pending work. Retrying replaces the same ID.
Results remain for loading-indicator cleanup; contributions work without the presentation plugin.

Modules may be shared by JavaScript's import cache; setup and cleanup remain separate for every editor. The loader
calls each plugin's ordinary `setup(context)` and owns its returned disposer. Editor disposal prevents queued scans
and pending imports from installing plugins and releases installed plugins in reverse installation order. Import
failures are reported in the editor log; the next matching automatic scan can retry. Setup errors propagate through
asynchronous activation, following the trusted-plugin error contract.

The same package exports `createDeferredPluginLoaderPlugin({ load })` for optional features that should load
regardless of project directives. It starts on core's `ready` event, after initial project loading/parsing, font-atlas
loading, and rendering. This single readiness gate needs no frame callback or timer. Font payloads remain separate lazy
chunks. Their directive-based loader is part of that deferred set, so its imports cannot start
earlier. Ordinary optional features use individual entries with unconditional or capability predicates, including
input plugins. Entries load independently and have no keyboard-specific loading stage.

`load()` resolves to one ordinary editor plugin. It can return a lazy-loader plugin that owns
individual optional feature imports. The deferred loader installs it against current state and calls its disposer
when the editor closes. Disposal removes the readiness listener and ignores pending imports. Load or setup failures
are logged. Optional features must initialize from current state without relying on startup events being replayed.
The deferred import uses ID `editor-plugins` and message `Loading editor plugins...`, with the same terminal
outcomes for completion, failure, and disposal.

Verify from the workspace root:

```sh
npx nx run @8f4e/editor-plugin-lazy-loader:build
npx nx run @8f4e/editor-plugin-lazy-loader:test
npx nx run @8f4e/editor-plugin-lazy-loader:typecheck
```

Browser composition tests combining the loader with plot live in editor-default. Run them with
`npx nx run @8f4e/editor-default:test:screenshot`.
