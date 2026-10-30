# WASM Texture Plugin

- Own `wasmTexture` configuration, exported WASM entry execution, framebuffer lookup, placement, shaders, and GPU resources.
- Export `createWasmTexturePlugin({ getCodeBuffer, getMemory })`. The compiler supplies live handles; core has no texture options.
- Register a generic canvas-wide layer only for complete configuration. Keep the texture drawer private to this package.
- Derive configuration on store changes. Reuse the current or pending WASM instance for setting changes; create a
  new instance on activation or accepted compilation. Resolve target metadata after instantiation, since compilation
  publishes memory before updating its metadata. Discard stale completion after recompilation, configuration removal,
  or disposal. Draw only pixels and prepared state in the frame path.
- Both default and minimal editors load this plugin from raw `wasmTexture` config with project scope. Register after
  connectors so the RGBA image remains above wires and sprites. Schema validation owns user-value constraints.
- Preserve nearest sampling, per-pixel alpha, storage reuse, resize, and GPU memory release/restoration.
- Run `npx nx run @8f4e/editor-plugin-wasm-texture:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-wasm-texture:test:screenshot`.
- Ignore Vitest attachments and screenshot comparisons; retain reference images.
- Serve browser fixtures with COOP/COEP headers so the real compiler can use shared WebAssembly memory.
