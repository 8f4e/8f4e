# Wires Plugin

- Own wire endpoint layout, the address index, WebGL rendering, shaders, palette resolution, and GPU resource
  lifetime. Do not depend on connector presentation. Keep wire drawing independent of block culling.
- Keep pixel-specific rasterization checks in this package. Test combined rendering in a composition suite.
