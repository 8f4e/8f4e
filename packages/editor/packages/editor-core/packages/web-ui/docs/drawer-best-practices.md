# Drawer Best Practices

Drawers run in the render loop, so keep their work predictable and allocation-light.

## Render Hot Path

- Prefer plain `for` loops or `for...of` loops over creating temporary arrays with `map`, `filter`, `reduce`, `slice`, or `Object.entries` in drawer render paths.
- Avoid building intermediate objects or tuples while drawing. Read from the state model directly when possible.
- Use temporary allocations only when they save enough repeated looping to be a net win. If a drawer needs multiple passes, prefer direct loops unless materializing a reusable array clearly reduces work.
- Keep formatting helpers small and deterministic. They can return strings, but they should not allocate larger helper structures per frame.
- Skip unsupported data early. Drawers should render only the value types they explicitly support instead of stringifying arbitrary objects.

This keeps memory churn low and gives the garbage collector less work during interactive rendering.

## Allocation Placement

- Prefer doing unavoidable allocation outside the render loop whenever possible.
- Keep per-frame allocations only when they avoid enough repeated looping or recalculation to justify the extra garbage collector pressure.

## Precomputed Values

- Precompute lookup tables at module scope for stable conversions. For example, `formatWatchValue.ts` in `@8f4e/editor-plugin-watch` builds `HEX_BYTE_LOOKUP` once instead of rebuilding hex strings from scratch for every byte on every frame.
- Precompute geometry before rendering. Built-in widgets can store it in graphic data; plugins keep it in private models. For example, the piano plugin draws precomputed key geometry and pressed-overlay rows.
- Precompute repeated layout measurements in widget data. For example, info panel widgets carry `keyColumnWidth` so the drawer does not scan every info record once to measure keys and again to render rows.

## State And Drawing

- Treat editor state as immutable input. Drawers should not mutate `state`, code block graphic data, memory views, or sprite lookup tables.
- Resolve layout-heavy data before drawing when it naturally belongs in editor-state graphic data.
- Use viewport grid sizes for placement and dimensions so drawer output stays aligned with the rest of the code block renderer.
- Exit early when required sprite lookups, widgets, memory views, or renderable data are missing.

## Tests

- Add focused unit tests for new drawer behavior, especially value formatting, truncation, skipped values, and draw call placement.
- Add or update screenshot tests when a drawer changes visible layout, sprite selection, colors, or geometry.
