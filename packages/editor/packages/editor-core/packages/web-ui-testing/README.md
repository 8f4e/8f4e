# Web UI Testing

`@8f4e/web-ui-testing` provides an `AsciiRenderer` for browser-free scene tests. Declare it as a development dependency
and supply an instance to `@8f4e/web-ui` with viewport dimensions in pixels. `toText()` returns every cell in the
viewport, including trailing spaces and empty rows. Use file snapshots when comparing complete frames.

The helper uses the installed font's cell dimensions and renders sprite submissions in order. Font bitmaps and GPU
effects are not simulated. The package does not depend on web-ui, so both web-ui and its plugins can use it in tests.

Browser tests that exercise native input can keep their canvas and pass `createAsciiCanvasRenderer(canvas)` to the
editor. Compare `readAsciiViewport(canvas)` with a `*.viewport.snap` file. The canvas still handles focus and resizing,
but the frame is drawn into the text grid. Keep real-renderer screenshots when the expected result depends on colors,
font rasterization, sub-cell geometry, GPU effects, or image export.
