# Editor Website Package Guidelines

- Keep this package thin: HTML, hosting assets, deployment configuration, and mounting the default composition.
- Product behavior and integration wiring belong in `@8f4e/editor-default`.
- The page owns its external `@8f4e/editor-webmcp` bridge. Bind it to the mounted editor, handle registration failures independently, and dispose the bridge before disposing the editor.
- Reusable editor behavior belongs in `@8f4e/editor-core`.
- Keep the `dev` workflow scoped to the website dependency graph; use the `build-deps` and `watch-deps` targets rather
  than building or watching every workspace project.
- Run `npx nx run @8f4e/editor-website:build` after changing this package.
