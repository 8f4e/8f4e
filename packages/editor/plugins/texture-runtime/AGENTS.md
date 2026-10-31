# Texture Runtime

- Own runtime enabled/entry config and per-frame entry execution, independent of texture visibility.
- Own `@textureUpload <pointerSource> <1bit|mono|rgb|rgba> <width> <height>` and
  `@texture <pointerSource> <magnification> <width> <height> [<x> <y>]`. Keep no compatibility syntax or aliases.
- Parse project-wide upload declarations and block-local views outside the frame path. Resolve direct addresses and
  typed pointer values after entry execution each frame. Include unopened groups and group exposures.
- Match views/uploads by current resolved byte address. Coalesce identical declarations, report conflicts once in
  the editor console, and suppress conflicting resources. Bounds-check upload spans against current WASM memory.
- Upload once per visible address per frame. Keep native R8/RGB8/RGBA8 storage and one program/rectangle. Crops use
  source-pixel coordinates and original row stride; 1bit crops can start within packed bytes. Preserve nearest sampling
  and premultiplied alpha. Free storage with no visible users and recreate after GPU release.
- Rebind address caches when `compiler.isCompiling` becomes false; compiler metadata is published atomically before that signal.
- Reserve view space from explicit source-pixel dimensions, with an optional source origin defaulting to zero. Layout
  uses only directives and viewport grid sizes; it has no compiler or memory dependencies. Pointer swaps and invalid
  sources never resize views. Keep rendering bindings separate from geometry and texture fields out of core.
- Keep the overlay above editor content; block occlusion is outside this feature. Both compositions match either
  directive and raw runtime config with project scope.
- Export `createTextureRuntimePlugin({ getCodeBuffer, getMemory })`. Preserve instance reuse and stale completion cleanup.
- Verify build/test/typecheck and test:screenshot through Nx. Builds clean dist before compilation.
