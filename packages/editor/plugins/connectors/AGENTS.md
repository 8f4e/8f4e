# Connectors Plugin

- Own connector geometry, the address index, expanded shape labels and the entire GPU wire renderer. Keep
  compiler semantics in compiler stages and generic memory resolution in editor-state.
- Derive connector geometry and the index from settled layouts for the current project level. Distinguish
  fixed reference targets from pointers whose slots must be read at runtime.
- Draw widgets through `registerCodeBlockDrawer` and wires through `registerRenderLayer`. Keep wire drawing
  independent of block culling.
