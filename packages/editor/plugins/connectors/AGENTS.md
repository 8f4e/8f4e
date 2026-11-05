# Connectors Plugin

- Own all input/output connector widgets, geometry, output calibration, wire lookup, shaders, GPU buffers, and drawing.
  Keep connector data private to each editor; core has no input/output widget fields or output-address index.
- Own `shape` and `paramShape` presentation: expanded labels, row reservations, and private prepared coordinates.
  Keep their derivation separate internally. Compiler semantics stay in the compiler; core provides generic layout.
  Share inherited declaration ordering with connectors through the local `getMemoryDeclarationRows` helper.
  Register labels and connectors together through the ordered block drawer registry, and dispose layout requests and drawers explicitly.
- Derive geometry through `layout.subscribe` and rebuild the byte-address index after `codeBlockLayoutsChanged` from
  the current project slice. Retain support for inherited declarations, private outputs, and project memory exposures.
- Derive both connector lists in one pass and retain only fields consumed by drawing. Keep line width and initial
  capacity as trusted internal values; do not restore the former mutation helpers or a line-renderer options bag.
- Keep memory semantics in the shared compiler plan and memory-resolution helpers. Connector visibility and render
  order must not affect pointer resolution or other plugins.
- Register sprite drawing through `drawers.registerCodeBlockDrawer` and the GPU wire pass through
  `drawers.registerRenderLayer`. The layer owns initialization, palette updates, memory release, and destruction.
  Keep generic WebGL utilities and render-layer lifecycle in web-ui; keep every line-specific resource here.
- Draw wires independently of block culling. Read pointer values each frame, suppress wires during dialogs, and
  highlight connections belonging to the selected input block.
- Load through the default/minimal/landing unconditional deferred registries; connectors are inferred from memory declarations.
- Fixed reference inputs come from compiled reference-slot metadata and use the target address directly; dynamic
  pointer inputs continue to read their allocated slots. Keep both address sources explicit in connector data.
- Ignore Vitest attachments and screenshot comparison images; keep reference screenshots tracked.
- Verify with `npx nx run @8f4e/editor-plugin-connectors:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-connectors:test:screenshot`.
