# Connectors Plugin

- Own connector geometry, sprites, and the address index. Keep
  compiler semantics in compiler stages and generic memory resolution in editor-state.
- Derive connector geometry and the index from settled layouts for the current project level. Distinguish
  fixed reference targets from pointers whose slots must be read at runtime.
- Draw widgets through `registerCodeBlockDrawer`. Expose resolved connections without GPU types so wire renderers
  can consume them independently of block culling.
