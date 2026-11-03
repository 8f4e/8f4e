# Project URL Loader Plugin

`@8f4e/editor-plugin-project-url-loader` fetches canonical `.8f4e` project source and loads its parsed project through
core's generic `loadProject` action. The host supplies `fetch` and optionally an initial URL.

```ts
createProjectUrlLoaderPlugin({ fetch, initialProjectUrl, onLoaded, onError })
```

The initial URL is fetched on the generic `init` event. Without one, initialization performs no request.
Fetching uses `cache: 'no-store'` and preserves the supplied URL. HTTP, network, and parser errors are logged in the
editor console and load an empty project.

The optional `onLoaded()` callback runs after the parsed source has been installed through `loadProject`, including
when that source is an empty project. `onError(error)` receives the original fetch or parser failure after the empty
fallback is installed; a failure does not call `onLoaded`. With no URL, neither callback runs. Disposal suppresses both
notifications for pending requests. Callback errors are not treated as fetch or parser failures.

Completion means source installation. Compilation, runtime startup, and binary assets have their own lifecycle.

The default editor gives an explicit initial URL priority by disabling the session plugin's restoration. The URL
loader does not know about session storage, and the session plugin does not know about URLs. Both use the same project
replacement path, which also clears file associations appropriately. Disposal unregisters listeners and prevents a
pending request from replacing the project after the editor closes.

Run the package's `build`, `test`, `typecheck`, and `test:screenshot` Nx targets to verify it.
