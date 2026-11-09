# Lazy Plugin Loader

- Own per-editor matching, imports, installation and disposal. Compositions supply signals, scopes and
  factories. Keep the readiness boundary on core's `ready` event.
- Scan cached directives after completed project changes and group navigation. View scope covers one project
  level and project scope covers the tree. Read raw config records before schema registration.
- Deduplicate in-flight imports, initialize against current state and ignore completion after disposal.
  Keep installed plugins for the editor's lifetime. The layout service handles late contributions.
