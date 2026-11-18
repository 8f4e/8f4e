# PWA updates

`@8f4e/editor-plugin-pwa-updates` observes a page-owned service worker and presents pending updates through
the editor's dialog system. First installation is silent. Detecting a new version opens **Update available**
with a download message and a **Later** button. **Reload** becomes available when the download finishes.
The main menu reopens a postponed update through **Update status** during the download or **Reload to update**
when the update is ready.

Create the plugin with `createPwaUpdatesPlugin({ serviceWorker: navigator.serviceWorker })` and install it
alongside the dialog-rendering plugin. It can load through a deferred registry after the first render.

The host owns registration, cache policy, and refreshing windows after a controller change. The plugin only
observes `serviceWorker.ready`, registration/installing-worker events, and sends `SKIP_WAITING` after Reload.
Disposal removes event listeners, its menu item, and its dialog, including when readiness resolves late.

Verify with `npx nx run @8f4e/editor-plugin-pwa-updates:build|test|typecheck|lint`. Production desktop/Android
dialog interactions are covered by `npx nx run @8f4e/editor-website:test:browser`.
