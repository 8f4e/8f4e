# Project Export Plugin

- Own Export Project, its menu/action, source serialization, filename selection, and error reporting here.
- Require a per-editor `fileSession`; its plugin must be installed before project loaders and file plugins.
- Serialize the project here; the session holds only the handle and pending write state. Use the shared browser writer
  for destination selection and writes. Do not depend on the Open/Save plugin.
- Return cleanup for the action and menu contribution. Do not register keyboard shortcuts or Open behavior.
- Use clean TypeScript output. Verify build/typecheck through Nx; composed behavior is covered by project-files tests
  and the product website's minimal-editor browser suite.
