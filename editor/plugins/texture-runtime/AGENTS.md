# Texture Runtime Plugin

- Own `textureRuntime`, `@textureUpload` and `@texture`. Parse uploads project-wide and views per block
  outside the render path. Keep entry execution independent of view visibility.
- Resolve and bounds-check current byte spans after entry execution. Share one upload per visible address and
  one GPU program across formats. Release GPU storage without visible users. Draw in the texture overlay.
- Derive view layout from directive dimensions and the grid. Keep it independent of compiler artifacts and
  pointer changes. Keep renderer format tests here and combined runtime coverage in the composition.
