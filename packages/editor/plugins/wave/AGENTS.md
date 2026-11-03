# Wave Plugin

- Own `@wave`, `@wave2`, and `@wave4` arguments, typed sample resolution, vertical spacing, and drawing here.
- Keep rendering in `src/drawer/`, layout subscriptions in `src/state/`, and argument helpers in `src/helpers/`.
  Keep tests beside their implementations.
- Export an `EditorPlugin` without installation as an import side effect. Editor-default selects the standard plugins.
- Keep wave data in a per-instance `wavesByBlock` WeakMap. Do not attach it to core state or share wave models with core.
- Leave generic directive parsing and layout in editor-state. Submit extra rows through an owned layout contribution and use `layout.subscribe` for geometry.
- Use public memory APIs for module/group scopes, typed sample metadata, and element counts.
- Read live sample buffers, counts, and optional playheads during drawing.
- Own cleanup of the layout subscription, contribution, and drawer.
- Run `npx nx run @8f4e/editor-plugin-wave:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-wave:test:screenshot` for browser rendering tests.
- Cover all height variants, sample types, pointer/count sources, exposed memory, source edits, cleanup, and isolation.

- Keep layout independent of directive registration. Match cached `codeBlock.parsedDirectives` through `matchEditorDirectives`; own contribution
  updates and `layout.subscribe` geometry. Unsubscribe before disposing requests. Do not attach layout to directive drafts.
