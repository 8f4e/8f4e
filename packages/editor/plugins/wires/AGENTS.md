# Wires Plugin

- Own WebGL wire rendering, shaders, palette resolution and GPU resource lifetime. Consume the public connector
  geometry API without deriving endpoints or owning connector state. Keep connection drawing independent of block culling.
- Keep pixel-specific rasterization checks in this package. Browser compositions may install wires with connectors in a
  shared deferred activation; connector-only compositions do not need this package.
