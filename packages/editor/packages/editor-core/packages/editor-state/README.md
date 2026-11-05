# Editor State Package

This package implements a platform-agnostic editor state machine. It owns the full application state shape and the logic that updates that state in response to internal events, without depending on platform specific APIs.

## Execution entries

Core owns entry definitions, module/project-group membership, and the padded world-space regions in
`state.codeBlockRendering.entryBounds`. Each region contains `entryName`, `x`, `y`, `width`, and `height` for the
current project level. Hidden child-project geometry is excluded. Padding is eight horizontal and four vertical
layout-grid cells; bounds refresh after layout, project, grid, and viewport changes.

When creating or inserting a module, core uses the first entry containing the requested world position, including
its edges. Outside all entry bounds it allocates a fresh entry name. Entry assignment works without presentation.
`@8f4e/editor-plugin-entry-outlines` only draws borders and labels from these shared bounds.

## Loading indicators

`state.loadingIndicators` is a unified list of operations with `id`, contributor-supplied `message`, `status`
(`loading`, `done`, `failed`, or `cancelled`), `startedAt`, and nullable `finishedAt`. Timestamps use epoch milliseconds.
`loading.add({ id, message })` returns `done()`, `fail()`, and `cancel()` methods; the first terminal result records
its finish time and remains in state. Reusing an ID replaces its previous record in place, and previous handles
cannot change the new attempt. Indicators do not affect project history, serialization, or compiler inputs.
The loading-indicators plugin owns optional canvas presentation and periodically expires results older than five seconds.
