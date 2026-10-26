# Web UI Render Projection

`@8f4e/web-ui-render-projection` derives web-ui-specific render data from editor state before the renderer needs it. It
moves repeatable preparation work out of the frame hot path while keeping editor-state independent from rendering
concerns.

The projection is a disposable read model, not a second source of truth. Its data can always be rebuilt from the
current editor state and rendering resources.

```text
editor-state ──changes──▶ web-ui-render-projection ──snapshot──▶ web-ui
                                   ▲
                                   │
                         sprite and lifecycle events
```

The default editor package is the composition root. It creates editor-state and the web UI render projection as sibling
layers, then passes both to the renderer. Editor-state does not import or initialize the render projection.

## Why This Package Exists

The renderer should spend each frame submitting already-prepared drawing data. Work that changes only when editor
state or rendering resources change can happen earlier, including:

- syntax highlighting;
- tab expansion into visual cells;
- line-number preparation and conversion of collapsed placeholders into render cells;
- character and font lookup resolution into sprite IDs;
- disabled-code font selection; and
- insertion of blank rows for editor-owned logical gaps.

The first extracted projection produces code-cell matrices. More render-only derivations can move here incrementally
when their ownership boundary is clear.

## Ownership Boundary

### Editor-state owns

- source code and editor directives;
- cursor, selection, dragging, and other interaction state;
- semantic results consumed by editor or compiler behavior;
- logical gaps used by caret movement and hit-testing; and
- display-row/source-row mappings used by navigation.

### The web UI render projection owns

- replaceable, render-ready data derived from editor state;
- syntax palette transitions and resolved glyph shape/color selections; and
- snapshots that can be recalculated outside the draw loop.

### The renderer owns

- drawing to the target surface;
- frame-time inputs such as current WebAssembly memory values; and
- short-lived rendering resources that cannot be derived solely from editor state.

If a value is required for editor behavior, moving it into this package would make the projection authoritative and is
therefore the wrong boundary. If a value can be discarded and recreated without changing editor behavior, it is a
candidate for the render projection.

## Update Flow

`createWebUiRenderProjection(store, events)` creates a projection controller that:

1. reads the current editor state and sprite lookups;
2. subscribes to relevant state changes and lifecycle events;
3. derives a new `WebUiRenderData` snapshot outside the renderer;
4. exposes the current snapshot through `getSnapshot()`; and
5. removes its subscriptions through `dispose()`.

The web UI reads the latest snapshot while drawing code blocks. It does not calculate syntax highlighting or resolve
glyph sprite IDs during that draw.

```typescript
import { createWebUiRenderProjection } from '@8f4e/web-ui-render-projection';

const renderProjection = createWebUiRenderProjection(store, events);

const renderData = renderProjection.getSnapshot();
const codeCells = renderData.codeBlocks.get(codeBlockId)?.codeCells;

renderProjection.dispose();
```

## Data Model

```typescript
interface WebUiRenderData {
  codeBlocks: ReadonlyMap<number, CodeBlockRenderData>;
}

interface CodeBlockRenderData {
  codeCells: Array<Array<SpriteCell | null>>; // SpriteCell is a uint32 packing a uint16 shape ID and uint16 palette index.
}
```

`deriveCodeBlockCodeCells` and `resolveCodeCells` are also exported as pure building blocks. The language-specific
syntax highlighters remain internal implementation modules.

## Current Limitations

- Relevant changes currently recalculate every code block rather than structurally sharing unaffected records.
- State subscriptions are broad and are not yet coordinated by a transaction or committed-change boundary.
- Only code glyph preparation has moved into the projection so far; the web UI still reads editor-state for other
  layout and interaction data.
- Frame-time runtime values deliberately remain live renderer inputs rather than projected data.

These constraints are tracked in
[TODO 476](../../../../../../docs/todos/476-extract-web-ui-render-projection.md).

## Development

From the repository root:

```bash
npx nx run @8f4e/web-ui-render-projection:test
npx nx run @8f4e/web-ui-render-projection:typecheck
npx nx run @8f4e/web-ui-render-projection:build
```

Palette-only updates retain the same shape IDs and stable token indices, so the cached cells remain valid without
rebuilding the projection. Font changes replace the shared glyph table and refresh projected cells.
Pre-resolved cells store shape and color together in one unsigned 32-bit number. This retains numeric cell storage
and avoids allocating a separate array or object for every glyph when the projection refreshes.
