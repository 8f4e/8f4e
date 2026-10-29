# Lazy Plugin Loader

`@8f4e/editor-plugin-lazy-loader` is a regular editor plugin that installs other plugins when their project signals
match. Fixed plugins still go directly into the editor's `plugins` array. Lazy entries supply lightweight matching
logic and a dynamic import, keeping the implementation out of initial loading.

```ts
import { createLazyPluginLoaderPlugin, hasDirective } from '@8f4e/editor-plugin-lazy-loader';

const loader = createLazyPluginLoaderPlugin([
	{
		id: 'plot',
		matches: project => hasDirective(project, 'plot'),
		load: () => import('@8f4e/editor-plugin-plot').then(module => module.plotPlugin),
	},
]);
```

Pass the loader alongside fixed plugins when constructing the editor. The default editor uses it for plot, wave,
meter, bars, switch, button, piano, slider, and crossfade. Its registry supplies the editor's live memory writer to
control factories after their implementations load. Other default plugins remain fixed.

Each `LazyEditorPlugin` entry contains `id`, `matches(project)`, and `load(): Promise<EditorPlugin>`. Keep IDs unique
within the registry and keep implementation imports inside `load`. Matchers receive the current canonical project,
including nested groups. They can inspect source, configuration, or other project data. `hasDirective(project, name)`
uses core's generic directive parser across every source category and nested group; it does not require the directive
implementation to be installed. Presence triggers loading; the loaded plugin owns argument validation.

Signal detection parses the serialized whole-project snapshot, including groups outside the visible editor slice.
Once installed, directive plugins consume core's cached `codeBlock.parsedDirectives` through `matchEditorDirectives`.

The loader scans the current project during setup and after completed project replacements, including file opens,
URL loads, and session restoration. It contributes **Load plugins used by project** to the background menu, dispatching
`loadPluginsUsedByProject`. Use that action after typing, pasting, adding example modules, or undo/redo introduces a
new signal. Those edits do not automatically scan.

Imports run in the background. Editor mounting and project-load notifications do not wait for them; plots appear
when their implementation arrives. Plugins own independent layout contributions and subscriptions. Submitting a changed
contribution automatically recalculates layout and rendered source without editing the project or triggering compilation. Plugins installed late
must initialize from the current state rather than depend on an earlier startup or compilation event being replayed.

Each entry installs once per editor. Overlapping scans share its pending load. Once requested, a plugin still installs
if the project changes while its import is pending, and remains installed until editor disposal. Removing a signal
does not unload it. Entries install in import-completion order; keep order-dependent plugins in the fixed list.

Modules may be shared by JavaScript's import cache; setup and cleanup remain separate for every editor. The loader
calls each plugin's ordinary `setup(context)` and owns its returned disposer. Plugins continue to own their listeners
and registrations. Editor disposal prevents pending imports from installing and releases installed plugins in reverse
installation order. Import failures are reported in the editor log; another scan can retry. Setup errors propagate
through the asynchronous activation, following the trusted-plugin error contract.

Verify from the workspace root:

```sh
npx nx run @8f4e/editor-plugin-lazy-loader:build
npx nx run @8f4e/editor-plugin-lazy-loader:test
npx nx run @8f4e/editor-plugin-lazy-loader:typecheck
npx nx run @8f4e/editor-plugin-lazy-loader:test:screenshot
```
