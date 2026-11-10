# Landing Editor Guidelines

- Build directly on editor-core for self-contained homepage demos. Keep live editing, project URL loading,
  the worker runtime and a small set of demo controls and visualizations. Keep standard-library discovery and
  broader runtime and authoring features in other compositions.
- Keep the composition menu-free and force core's `contextMenu` feature off even with host feature overrides.
  Keep editing and plain-text paste available independently of block clipboard and file commands.
- The host owns loading UI. Core loading status remains available without the loading-indicators plugin.
