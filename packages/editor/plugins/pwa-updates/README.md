# PWA updates

`@8f4e/editor-plugin-pwa-updates` observes a page-owned service worker and presents pending updates through
the editor's dialog system. First installation is silent. A waiting update opens **Update available** with
**Reload** and **Later** buttons. The **Reload to update** main-menu item reopens a postponed update.

Create the plugin with `createPwaUpdatesPlugin({ serviceWorker: navigator.serviceWorker })` and install it
alongside the dialog-rendering plugin. The default composition accepts this source as `pwaUpdates` and loads
the plugin through its deferred registry after the first render. The editor website supplies it in production.

The host owns registration, cache policy, and refreshing windows after a controller change. The plugin only
observes `serviceWorker.ready`, registration/installing-worker events, and sends `SKIP_WAITING` after Reload.
Disposal removes event listeners, its menu item, and its dialog, including when readiness resolves late.

Verify with `npx nx run @8f4e/editor-plugin-pwa-updates:build|test|typecheck|lint`. Production desktop/Android
dialog interactions are covered by `npx nx run @8f4e/editor-website:test:browser`.
