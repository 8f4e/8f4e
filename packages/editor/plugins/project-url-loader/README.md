# Project URL Loader Plugin

`@8f4e/editor-plugin-project-url-loader` fetches canonical `.8f4e` project source and loads its parsed project through
core's generic `loadProject` action. The host supplies `fetch` and optionally an initial URL.

```ts
createProjectUrlLoaderPlugin({ fetch, initialProjectUrl, onError })
```

The initial URL is fetched on `prepareInitialProject`. Fetching, parsing, and project installation complete before
web-ui loads the font selected by the prepared project and core draws the first frame.
Without an initial URL, initialization performs no request.
Fetching uses `cache: 'no-store'` and preserves the supplied URL. HTTP, network, and parser errors are logged in the
editor console and load an empty project.

Successful source installation, including valid empty source, completes the source preparation hook.
The optional `onError(error)` receives the original fetch or parser failure after the empty fallback is installed.
With no URL, no error callback runs. Disposal suppresses late errors and results for pending requests.
Callback errors are not treated as fetch or parser failures.

The plugin contributes ID `project-url` and message `Loading project...` while fetching, parsing, and installing
source. Success/failure settle its status; disposal cancels pending work. Results remain in state independently of presentation.
No URL means no indicator.
Initial URL loading still completes before the first canvas frame; its retained terminal result can be shown
once rendering starts.

Completion means source installation. Compilation, runtime startup, and binary assets have their own lifecycle.

When composing with session persistence, the host can give an explicit initial URL priority by disabling session restoration. The URL
loader does not know about session storage, and the session plugin does not know about URLs. Both use the same project
replacement path, which also clears file associations appropriately. Disposal unregisters listeners and prevents a
pending request from replacing the project after the editor closes.

Run the package's `build`, `test`, and `typecheck` Nx targets to verify it.
