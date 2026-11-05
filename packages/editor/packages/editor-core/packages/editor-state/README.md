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

`state.loadingIndicators` is a unified list of `LoadingIndicator` objects containing `name: string`.
`addLoadingIndicator(store, { name })` appends an object and returns an idempotent function that removes that
exact object. Use a fresh object per operation and call its remover on success, failure, cancellation, and
producer disposal. Equal names remain independent. Indicators are transient and do not change project history,
serialization, or compiler inputs. The loading-indicators plugin owns their optional canvas presentation.
