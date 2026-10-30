# Texture Runtime

- Own `textureRuntime.enabled` (default false), `entry` (default main), and per-editor-frame WASM execution.
  Entry execution is independent of framebuffer display and runs once per frame regardless of visible view count.
- Own `@texture <framebuffer> <1bit|mono|rgb|rgba> <width> <height> <magnification>`, argument validation, scoped memory
  resolution, private per-block views, and layout contributions. Dimensions and magnification are positive integers.
  Reserve rows immediately below each directive and enough block width, even while memory is unresolved.
- Export `createTextureRuntimePlugin({ getCodeBuffer, getMemory })`. Reuse ready/pending instances for directive and
  entry changes. Create instances on activation or accepted compilation; cancel stale completion on disable/recompile/dispose.
- Use one private GPU program and rectangle per renderer, with a format uniform and independent storage per directive.
  Upload raw R8/RGB8/RGBA8 bytes; decode packed 1bit rows in the shader (byte-aligned, MSB first).
- Use generic layout and render-layer APIs; add no texture fields to core state. The overlay may cover other editor
  elements; block overlap handling is intentionally outside this feature. Track viewport/block positions and cull invisible views.
- Both editor compositions match raw `textureRuntime` config or `@texture` with project scope before plugin installation.
- Preserve nearest sampling, premultiplied-alpha output, storage reuse, and resource release/restoration. Free texture
  storage for removed/offscreen views. Schema validation owns config constraints; directive parsing owns argument constraints.
- Run `npx nx run @8f4e/editor-plugin-texture-runtime:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-texture-runtime:test:screenshot`.
- Builds clear `dist/` before compilation so deleted or renamed sources cannot remain in emitted output or build caches.
- Ignore Vitest attachments and screenshot comparisons; retain reference images. Browser fixtures require COOP/COEP.
