# Editor Website Guidelines

- Own HTML, hosting assets, deployment and mounting the default composition. Keep product behavior in
  editor-default and reusable editor behavior in editor-core.
- Load the external WebMCP bridge after mounting. Keep registration failures independent of editor startup and
  dispose the bridge before its editor. Ignore late imports after teardown.
- The page owns service worker registration, precaching and controller-change reloads. Register after mounting
  in production, cache all emitted assets without evaluating lazy modules, and preserve COOP/COEP offline. The
  PWA update plugin owns the editor prompt and triggers user-requested updates.
- Scope dev builds and watches to the website's dependency graph. Keep mount startup off top-level await so
  optional chunks can import shared entry exports.
- Use `npx nx run @8f4e/editor-website:test:browser` for production PWA behavior.
