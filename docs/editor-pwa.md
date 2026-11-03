# Offline editor

The default editor at editor.8f4e.com can be installed as a progressive web app (PWA). Open it online and wait
for **8f4e is available offline** before disconnecting. In Chrome on Android, use the browser's **Install app**
option to add it to your launcher. Offline support also works in a regular browser tab after preparation finishes.

## What is available offline

The app downloads the complete editor build: compiler, plugins, runtimes and their workers/worklets, fonts,
standard library, bundled example modules, and the WebMCP reference catalog. Plugins and fonts still load
only when needed; downloading them into the offline cache does not execute them at startup.

The current project is autosaved in browser storage and restored when the editor reopens. Locally imported
project files can be used offline. Export Project remains available for keeping independent copies.

External project URLs require a connection; they are not added to the app's offline cache. After a project
has opened successfully, its current source is saved with the session and can be restored by reopening the
editor's plain URL or launcher icon. Binary assets use their existing cache and must have been downloaded
successfully before they can be used offline. App updates preserve that cache.

The installation does not add mobile source editing. Touch navigation and project controls keep their existing
behavior. Browser audio restrictions also still apply: audio may require a tap, and Android may suspend it when
the app is backgrounded or the screen is locked.

## Updates and storage

New versions download while online. The app shows an update notice and waits for **Reload**, or for the old app
windows to close, before activating the new version. Reload updates all open editor windows. Dismiss the notice
to continue the current session. Updates do not force an immediate reload when they finish downloading.
Project autosaves remain separate from the versioned app cache.

![The update notice with Reload and Dismiss buttons](images/editor-pwa-update.png)

Offline availability depends on browser storage. Clearing site data removes the saved session and offline files;
the browser can also reclaim storage under pressure. Keep exported copies of projects you want to retain.

## Hosting and verification

PWA support belongs to `@8f4e/editor-website`; the reusable editor compositions retain their lazy-loading policy.
The service worker is registered only in production builds after the editor mounts. Vite PWA/Workbox generates
its precache list from build output and fails the build if an asset exceeds Workbox's precache size limit.

Deploy the complete build directory together over HTTPS. Keep the supplied Cloudflare `_headers` rules: cached
HTML must retain COOP/COEP isolation for shared WebAssembly memory, and `sw.js` must be revalidated for updates.
The Vite production preview supplies the same isolation headers.

Run `npx nx run @8f4e/editor-website:test:browser` for production offline and update tests. These include Android
touch emulation, but installation and device-specific audio behavior should also be checked on a physical phone.
