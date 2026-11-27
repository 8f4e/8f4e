# Editor Web App

`@8f4e/editor-webapp` is the deployable website for the default 8f4e editor. It owns the HTML page, static hosting
files, and Vite configuration. Its TypeScript entry point mounts `@8f4e/editor-default`, then dynamically imports
the external WebMCP bridge. The bridge and its search catalog load after editor initialization, outside the initial
script graph. Bridge loading or registration failures are logged independently of editor startup.

From the workspace root:

```bash
npx nx run @8f4e/editor-webapp:dev
npx nx run @8f4e/editor-webapp:build
npx nx run @8f4e/editor-webapp:serve
npx nx run @8f4e/editor-webapp:test:browser
```

Cloudflare Pages should use `npx nx run @8f4e/editor-webapp:build` as its build command. The output directory is
`apps/editor-webapp/dist`, which is also configured in the root `wrangler.toml`.

The production website is an installable PWA. Its fullscreen manifest lets the installed Android app launch
without system status/navigation bars in either orientation, with no orientation lock. After the editor mounts,
its service worker downloads all build
assets, including lazy plugins, fonts, workers, worklets, stdlib, and bundled example modules. Precaching does
not import or execute those modules. On subsequent online launches, the website checks for an update.
The `editor-plugin-pwa-updates` plugin shows a dialog when a download is detected and offers Reload when it finishes.
First installation is silent.
Development mode does not register a service worker.

The browser tests run against the production build on port 3103, using desktop Chromium and Android touch
emulation. They verify complete precaching, an offline cold launch, first-use lazy loading and runtime execution,
session restoration, and an update that preserves project data and the existing binary asset cache. Install the
Playwright Chromium browser before running them. Full type checks include the tests; production builds use
`typecheck:production` to keep test-only inputs out of the build cache.

See [Offline editor](../../docs/editor-pwa.md) for installation, updates, and offline limitations.
