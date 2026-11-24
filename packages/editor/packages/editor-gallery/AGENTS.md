# Gallery Editor Guidelines

- Build directly on editor-core. Keep live editing, stdlib includes, project URL loading, controls, runtimes and
  one-shot source export. Keep session storage, file associations, Open From Disk and the built-in module catalog
  in the default composition.
- Keep the URL loader and loading indicator presentation eager alongside first-render drawing.
  A requested URL must load successfully for mounting to complete. Hosts own page URLs, loading UI, visibility and WebMCP.
- Discover stdlib through the gallery's lazy Vite source collection. Supply compiler handles and browser
  dependencies through plugin factories.
