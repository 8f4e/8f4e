# Contributing Editor Directives

This document describes how to add or refactor code-block-local editor directives in the editor codebase.

For user-facing editor directive syntax and semantics, see [editor-directives.md](./editor-directives.md).

## Goal

Editor directives should be owned by the directive itself.

That means each directive should keep its:

- parsing
- derived code-block contributions
- directive-specific tests

in its owning core feature or optional plugin package. Layout requests and geometry subscriptions use the separate layout service.

The shared directive engine should stay generic. It should coordinate directive parsing and application, but it should not hardcode directive-specific behavior such as plotter buckets, wave rules, or layout switches.

This document is specifically about the code-block directive system under `code-blocks/features/directives/`. Global editor directives are a separate feature area and should follow the same ownership principle, but they do not live in this pipeline.

## Architecture Overview

There are three distinct concerns that must stay separate:

**Directive semantics** — what a directive means:
- parsing directive arguments
- deriving block state and source display semantics
- owned by each directive folder under `directives/`

**Layout** — space, dimensions, and widget geometry:
- independent contribution values and layout subscriptions
- core layout service plus plugin-owned interpretation and geometry

**Directive editing** — how directive source lines are rewritten:
- inserting, removing, or updating directive lines in code
- canonicalizing directive placement
- owned by the shared `directiveEditing/` feature

## Directory Layout

Directive semantic code lives under:

`packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/directives/`

Shared directive editing primitives live under:

`packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/directiveEditing/`

Typical structure:

```txt
directives/
  registry.ts
  utils.ts
  hide/
    data.ts
    plugin.ts
    resolve.ts
    data.test.ts
    resolve.test.ts

directiveEditing/
  index.ts
  removeDirective.ts
  upsertDirective.ts
  updateDirectiveArgs.ts
```

Each directive folder should contain its own semantic logic. Avoid putting directive-specific logic back into `registry.ts`. Source rewriting belongs in `directiveEditing/`.

Optional directive interpretation belongs in editor plugin packages. Generic parsing remains in core. Plugins can
use `parseEditorDirectives(code, [{ name, aliases, allowTrailingComment }])` without registering a directive handler.

## Directive and Layout Flow

1. Core parses source and derives block/display semantics from its directive definitions.
2. Core calculates dimensions, display rows, source-line gaps, and cursor coordinates using independent layout requests.
3. Layout subscribers receive the calculated block and current state. A plugin can read directives or other inputs,
   update its requests, and derive private widget geometry.
4. Changed requests trigger recalculation; unchanged requests do nothing. Core completes these calculations
   synchronously before publishing the render projection.

No directive definition owns layout callbacks or space requests. A plugin without any directive can use the same
layout service, for example to reserve space after asynchronously loaded data arrives.

## Shared Directive Editing Primitives

Use the helpers in `directiveEditing/` whenever you need to rewrite directive source lines:

```ts
import { removeDirective, upsertDirective, updateDirectiveArgs } from '../directiveEditing';
```

### `removeDirective(code, name)`

Removes all lines containing a directive with the given name.

```ts
// Remove all ; @group lines
code = removeDirective(code, 'group');
```

### `upsertDirective(code, name, args?)`

Ensures exactly one directive line with the given name exists, placed after the first line (block declaration). If the directive already exists, it is replaced.

```ts
// Insert or update ; @pos 10 20
code = upsertDirective(code, 'pos', ['10', '20']);

// Insert ; @disabled (no args)
code = upsertDirective(code, 'disabled');
```

### `updateDirectiveArgs(code, name, updater)`

Updates the arguments of all existing directive lines with the given name. Useful when you need to modify args without changing line placement.

```ts
// Set the requested nonstick mode on ; @group directive
code = updateDirectiveArgs(code, 'group', ([groupName]) =>
  makeNonstick ? [groupName, 'nonstick'] : [groupName]
);
```

Apply replacement source through the public state helper once the action has checked edit mode:

```ts
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';

applyCodeBlockSourceEdits(store, [{ codeBlock, code }], { affectsCompilation: false });
```

Pass all changed owners in one batch. The helper refreshes blocks and publishes one completed project change;
set `affectsCompilation: true` when the edit changes compiler inputs. It handles empty and unchanged batches.

## Shared Types

The main shared types are in:

- `packages/editor/packages/editor-core/packages/editor-state-types/src/features/code-blocks/features/directives/types.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/directives/registry.ts`

Derived directive state contains `blockState`, `displayState`, and `displayModel`. Layout types live separately in
`editor-state-types/src/features/code-blocks/layout.ts`: `CodeBlockLayoutContribution`, `EditorLayoutContribution`,
`CodeBlockLayoutContext`, and `EditorLayoutRegistry`. Keep feature-specific widget models private to their plugins.

## Adding a New Directive

Create a new folder under `directives/`, for example:

```txt
directives/
  hide/
    data.ts
    plugin.ts
    data.test.ts
```

Then:

1. Add a directive plugin in `plugin.ts`
2. If needed, add argument-to-data helpers in `data.ts`
3. Register the plugin in `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/directives/registry.ts`
4. Add tests in the same directive folder
5. Update the user-facing docs in [editor-directives.md](./editor-directives.md)

If you are adding project-level settings owned by an extension or runtime, prefer a schema-backed `@config` root
registered through `editorConfigSchemaContributions` instead of adding a new `~` directive.
Schema fields with `format: 'memory-address'` resolve numeric addresses and memory references to compiled word addresses
when read through `resolveSchemaConfigRoot(...)` with state. When a config directive appears in a module block,
memory-formatted values can use a local memory name; the config parser normalizes it to `module:memory` before consumers
receive `state.editorConfig`.

If you need to insert or update the directive in source code (e.g., from an effect or action), use the `directiveEditing/` helpers rather than writing inline regex logic.

## Parsing

Directive syntax parsing is centralized.

The shared parser in:

- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/directives/utils.ts`

handles the common syntax:

```txt
; @directiveName argument1 argument2 ...
; @directiveName argument1 @otherDirective
```

Multiple directives may share one comment line. Shared syntax utilities parse
one directive record per `@name` token, and source-editing helpers must preserve
unrelated directives on the same line.

Directives should not re-parse their own comment syntax.

Use the shared argument validators in
`packages/editor/packages/editor-core/packages/editor-state/src/shared/editorDirectiveArgumentTypes.ts` for the
canonical memory-id, memory-address, pointer-source, numeric, and element-count forms. This keeps argument contracts
consistent across directives instead of accepting ad hoc string variants in individual `data.ts` files.

Directive folders should only:

- interpret `args`
- derive typed directive data
- derive block/display semantics or use the separate layout service for widget requests and geometry

If a directive needs more context than a single line, keep that extra derivation logic inside the directive folder. Do not move it into the central registry.

## Block Contributions

Use `plugin.ts` to contribute block-level metadata such as:

- `disabled`
- `isHome`
- display transforms such as `@hide`

If a directive changes how code should be displayed, that should be modeled as a directive-owned contribution to the display model, not as a renderer hack in `codeBlockRendering`.

## Layout Contributions and Subscriptions

A plugin receives `layout` in its setup context. Create an owner for requests and update a complete per-block value:

```ts
const contribution = layout.createContribution();
contribution.update(codeBlock, {
  verticalSpaceAfterSourceLine: [{ sourceLineIndex: 2, heightInRows: 2 }],
  minGridWidth: 40,
});
```

Source lines are zero-based; heights use editor rows and widths use editor columns. Space after the same line adds
across owners; minimum widths combine by maximum. Core maps source lines to display rows and skips hidden lines.
`remove(codeBlock)` clears one block and `dispose()` removes all requests belonging to that owner.

Subscribe with `layout.subscribe(({ codeBlock, state }) => { ... })`. The callback runs for the current visible blocks
immediately and whenever their layout is calculated, including source, font, metadata, and contribution changes.
Dimensions, display rows, gaps, and cursor coordinates are current. Read source through the generic parser if your
feature uses directives; other features can derive their requests from different inputs.

Subscribers may replace their own requests. An unchanged value is a no-op; changed values cause another calculation
before rendering. Keep geometry in a private map shared by drawing and hit testing. Coordinates are relative to the
block; viewport placement remains core-owned. Unsubscribe before disposing requests so callbacks cannot resubmit them.
Plugins own every subscription and contribution disposer. Layout changes do not edit source or trigger compilation.

## Testing

Test semantic directives through `deriveDirectiveState`; keep generic syntax parsing tests in core and feature argument
interpretation tests in the owning package. Test layout through actual contribution updates and subscriptions, including
source/metadata changes, cleanup, and geometry shared by drawing and hit testing. No compatibility directive-layout
callbacks remain. Use plugin integration tests and browser screenshots to verify visible behavior.

## Boundaries To Preserve

Good:

- one folder per directive for semantics
- `directiveEditing/` for all source rewriting mechanics
- generic shared directive engine
- generic directive syntax parsing
- plugin-owned argument interpretation and independent layout requests/widget geometry
- directive-owned tests
- action features remain separate (e.g., group togglers) but delegate source edits to `directiveEditing/`

Bad:

- central registry switches with directive-specific numbers or behavior
- layout requests or callbacks embedded in directive state, or shared concrete widget buckets
- directive logic split across unrelated feature folders
- directive-specific comment parsers that duplicate the shared syntax parser
- reintroducing directive-specific `updateGraphicData.ts` files outside `directives/`
- inline regex-based directive line manipulation in effect/action files (use `directiveEditing/` instead)
