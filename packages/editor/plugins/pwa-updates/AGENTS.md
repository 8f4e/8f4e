# PWA Update Plugin

- Own waiting-update observation, dialog content/actions, and the main-menu action here. Use the generic editor
  `addDialog`/`removeDialog` events; leave geometry, hit testing, and drawing to `editor-plugin-dialogs`.
- Receive the page-owned service worker through `serviceWorker.ready`. Keep registration, precaching, and
  controller-change reloads in the website host. First installation must stay silent.
- Activate a waiting worker only through the explicit Reload action. Later closes the dialog; the main-menu
  action must remain available while the update is waiting.
- Dispose registration/worker event listeners, menu/action registrations, and only this plugin's dialog. Ignore
  readiness that resolves after disposal. Announce each waiting worker once.
- Run `npx nx run @8f4e/editor-plugin-pwa-updates:build|test|typecheck|lint`; unit-test lifecycle with injected
  worker sources and editor events. Browser composition coverage lives in `editor-website:test:browser`.
