# Font preview

- Own F18/F19 font cycling, temporary preview state, and cleanup in this plugin. Receive the keyboard target through the factory.
- Use sprite-generator's catalog and default. Web-ui owns font validation, atlas loading, and grid updates.
- Keep preview changes out of source, history, project revisions, and serialization. Retain the preview across config
  resolution and clear it with a capture listener before `loadProject` handlers run.
- Unsubscribe before calling generic `resolveEditorConfig` to restore source config on disposal. Add no core font fields or override registry.
- Default editor imports this plugin with its desktop keyboard plugins; minimal omits it.
- Test with local core-service fixtures, without installing sibling plugins. Real rendering combinations belong to editor-default.
- Run `npx nx run @8f4e/editor-plugin-font-preview:build|test|typecheck`.
