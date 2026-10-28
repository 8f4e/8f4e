# Project URL Loader Plugin

`@8f4e/editor-plugin-project-url-loader` fetches canonical `.8f4e` project source and loads its parsed project through
core's generic `loadProject` action. The host supplies `fetch` and optionally an initial URL.

```ts
createProjectUrlLoaderPlugin({ fetch, initialProjectUrl })
```

The initial URL is fetched on the generic `init` event. Without one, initialization performs no request. The
`loadProjectByUrl` action accepts `{ projectUrl }` for later requests. Fetching uses `cache: 'no-store'` and preserves
the supplied URL. HTTP, network, and parser errors are logged in the editor console and load an empty project.

The default editor gives an explicit initial URL priority by disabling the session plugin's restoration. The URL
loader does not know about session storage, and the session plugin does not know about URLs. Both use the same project
replacement path, which also clears file associations appropriately. Disposal unregisters listeners and prevents a
pending request from replacing the project after the editor closes.

Run the package's `build`, `test`, `typecheck`, and `test:screenshot` Nx targets to verify it.
