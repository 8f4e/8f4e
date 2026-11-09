# Gallery Editor Guidelines

- Build directly on editor-core. Keep live editing, stdlib includes, project URL loading, controls, runtimes and
  source saving. Keep session storage, Open From Disk and the built-in module catalog in the default composition.
- Keep the URL loader, file session and loading indicator presentation eager alongside first-render drawing.
  Forward initial-project callbacks to the URL loader. Hosts own page URLs, loading UI, visibility and WebMCP.
- Discover stdlib through the gallery's lazy Vite source collection. Supply compiler handles and browser
  dependencies through plugin factories.
