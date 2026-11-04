# Editor Website Package Guidelines

- Keep this package thin: HTML, hosting assets, deployment configuration, and mounting the default composition.
- Product behavior and integration wiring belong in `@8f4e/editor-default`.
- The page owns its external `@8f4e/editor-webmcp` bridge. Bind it to the mounted editor, handle registration failures independently, and dispose the bridge before disposing the editor.
- Dynamically import WebMCP after the editor mounts so its bridge and search catalog stay outside the initial script graph. Ignore late imports after page disposal.
- Reusable editor behavior belongs in `@8f4e/editor-core`.
- Keep the `dev` workflow scoped to the website dependency graph; use the `build-deps` and `watch-deps` targets rather
  than building or watching every workspace project.
- Bind the dev server to `0.0.0.0` so phones on the same network can access port 3000.
- Run `npx nx run @8f4e/editor-website:build` after changing this package.
- PWA installation, registration, controller-change reloads, and precaching belong in this host. Keep editor plugin/font imports
  lazy; cache all emitted application assets without executing optional modules at startup. Register only after mounting
  in production, preserve COOP/COEP headers offline, and wait for user-requested reloads before applying updates.
- Supply `pwaUpdates: navigator.serviceWorker` to the default composition in production. The PWA update plugin owns
  the editor dialog/menu. Keep first installation silent and do not add separate DOM notification overlays.
- Run `npx nx run @8f4e/editor-website:test:browser` for production PWA checks with desktop Chromium and Android touch
  emulation. Playwright uses port 3103 with strict binding. Keep browser artifacts in the ignored `.playwright-results/`.
- Full `typecheck` includes browser tests. Builds depend on `typecheck:production`, which excludes tests.

- Start mounting from an async function without top-level await. Production lazy chunks may import shared exports
  from the entry module; awaiting their imports during entry evaluation can deadlock startup.
