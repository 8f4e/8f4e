# Connectors Plugin

- Own all input/output connector widgets, geometry, output calibration, wire lookup, shaders, GPU buffers, and drawing.
  Keep connector data private to each editor; core has no input/output widget fields or output-address index.
- Derive geometry through `layout.subscribe` and rebuild the byte-address index after `codeBlockLayoutsChanged` from
  the current project slice. Retain support for inherited declarations, private outputs, and project memory exposures.
- Keep memory semantics in the shared compiler plan and memory-resolution helpers. Connector visibility and render
  order must not affect pointer resolution or other plugins.
- Register sprite drawing through `drawers.registerCodeBlockDrawer` and the GPU wire pass through
  `drawers.registerRenderLayer`. The layer owns initialization, palette updates, memory release, and destruction.
  Keep generic WebGL utilities and render-layer lifecycle in web-ui; keep every line-specific resource here.
- Draw wires independently of block culling. Read pointer values each frame, suppress wires during dialogs, and
  highlight connections belonging to the selected input block.
- Install in the fixed default and minimal compositions; connectors are inferred from memory declarations.
- Verify with `npx nx run @8f4e/editor-plugin-connectors:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-connectors:test:screenshot`.
