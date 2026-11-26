# 8f4e Website

`@8f4e/8f4e-website` contains a product homepage using
[`@8f4e/editor-landing`](../../editor/compositions/editor-landing/README.md), plus examples and compiler test galleries using
[`@8f4e/editor-gallery`](../../editor/compositions/editor-gallery/README.md). Both embedded compositions keep live editing,
controls, visualizations, and URL loading. The landing editor uses the worker runtime, watch/stack, plot, scope, and slider;
its projects must be self-contained because it has no standard-library include resolver. It omits switch, button,
piano, assertion markers, keyboard mode switching, dialogs, test/audio/texture runtimes, binary
assets, MIDI, keyboard-to-memory input, bars, meter, wave, and crossfade. It also omits entry outlines, offscreen block
arrows, context menus, project file access/export, and block copy/paste. Plain-text paste remains available
through keyboard editing. Each mount starts fresh, with no browser session persistence,
WASM export, screenshots, built-in module browser, or optional authoring-action plugins. The website
controls the canvas size. Homepage editors leave wheel scrolling to the surrounding document and start in edit mode
without a mode-switching plugin. Audio contexts are supplied only to gallery editors.

`src/homepage.ts` exports `mountHomepageEditors`, which owns the homepage editors, visibility observers, and disposal;
`src/main.ts` mounts it. The homepage reveals canvases when editor mounting fulfills, after loading any requested
project and drawing the first frame. If source or renderer initialization fails, mounting rejects and the homepage
displays a reload message.

From the workspace root:

```bash
npx nx run @8f4e/8f4e-website:dev
npx nx run @8f4e/8f4e-website:build
npx nx run @8f4e/8f4e-website:test:browser
npm --prefix tools/project-preview run generate-gallery-previews
npx nx run @8f4e/8f4e-website:serve
```

The development server runs at `http://localhost:3001` so it can run alongside `@8f4e/editor-webapp`.

Set the canvas's `data-project-path` attribute in `src/index.html` to a path relative to
the `@8f4e/examples/projects` collection to choose the project loaded when the editor mounts. `src/homepage-projects.ts`
imports only the four homepage demo URLs through package subpaths; update its explicit imports when changing the homepage's project selection.
The examples gallery uses the full project and preview URL catalogs in `src/example-projects.ts`. The external source
URL collections in `vite.sources.mjs` resolve the owning packages' directory exports and are shared by the website
and its browser tests.
The homepage fetches each demo's source when its editor becomes visible. Featured preview GIFs use `?no-inline`
to remain external assets with native lazy loading, including images below Vite's default inline-size limit.
The npm command refreshes the committed 64×64 GIF previews in `src/project-previews/` after gallery projects or
their `@home` blocks change. The compiler gallery reuses one shared preview generated from a representative fixture.

## Examples gallery

The separate `/examples/` page lists curated projects from `src/examples/projects.ts`. Each entry supplies a stable ID,
title, short description, and a path relative to the `@8f4e/examples/projects` collection. The homepage footer links
to the gallery. Previews are optional: examples without a generated preview load without a thumbnail, and the compiler
test gallery also works without its shared preview. Vite builds the homepage and galleries with their project
source assets, so example projects need no separate deployment or precompiled WASM files. The `.8f4e` asset responses allow cross-origin requests through
`src/_headers` so Open in editor links can load these sources from `editor.8f4e.com`.

The list starts with the “Basic examples” category directly below the logo. `projectCategories` in the same file
defines category headings and their order. Projects are grouped by their containing directory, with Amiga MODs
listed separately from other audio examples. Category headings use `h2` and individual example headings use `h3`
on both desktop and mobile.

Above 800px, the list scrolls with the document while the selected editor stays fixed in the right column. At 800px
and below, the same panels become an accordion: the selected editor appears beneath its title and can be collapsed.
Resizing keeps the active editor instance. Without a selected example in the URL, mobile starts collapsed and desktop
opens the first example.

Each example has a shareable hash URL using its stable ID, such as `/examples/#dx7-algorithm-5-eight-voices`. Selecting
an example from the list updates the address and page title without jumping to the anchor. Back and Forward restore
selections. Opening a direct link uses the browser’s anchor navigation to bring the selected item into view on desktop
and mobile. Collapsing a mobile example removes the selection from the URL. Unknown IDs fall back to the default desktop
selection or the collapsed mobile list.

Selecting a different example creates a fresh editor and disposes the previous selection. Each selection owns its
editor, WebMCP bridge, canvas, loading timeout, and reveal frame through `src/gallery-editor-session.ts`. Pending
mounts finish independently; a disposed selection releases any editor that arrives later and ignores late load errors.
Returning to an example reloads its source; edits remain only for that editor's lifetime.
The gallery editor captures wheel gestures for panning; scrolling over the example list scrolls the document.
A link opens the example in the full editor.
The loading indicator stays visible until the project source has loaded and the editor has mounted, including its first
rendered frame. Successful empty projects are revealed too. A rejected mount offers a retry; a 30-second timeout
covers source fetching and renderer initialization. Switching examples disposes the previous editor
without waiting for its fetch. The gallery does not inspect project contents or poll editor state to infer completion.

Browser integration tests cover both website views with delayed responses, valid empty projects, mount failures/retry,
and switching examples while a fetch is pending. The gallery project-menu canvas baseline lives under
`src/__screenshots__/gallery.test.ts/` and is shared across platforms because editor glyphs use bitmap masks.

The galleries dynamically import their WebMCP bridge after the selected editor has mounted and its project source
has loaded. The bridge and its search catalog stay outside the initial script graph. Editors can be revealed and
replaced while that import is pending; a late import connects only to the current editor. Bridge loading or
registration failures are logged independently of project loading.

## Compiler test gallery

The `/tests/` page discovers `**/*.test.8f4e` through the `@8f4e/compiler/test-fixtures` URL collection in `vite.sources.mjs`.
Adding or removing a fixture updates the catalog at the next build. Fixtures are grouped by directory, with root-level
files under General. Error fixtures and include-only helper sources are excluded.

Vite emits the original project files as downloadable assets, so this gallery needs no separate fixture deployment.
Each project has a GitHub source link and an Open in editor link. Hash URLs use the relative fixture path without
`.test.8f4e`, for example `/tests/#instructions/integer-arithmetic`.

All galleries use `src/gallery.ts` for selection, editor lifecycle, and the responsive layout. The test gallery uses
the editor's default block positioning and keeps editors in edit mode with mode toggling disabled.
Fixtures enable the test-runtime plugin with `; @config testRuntime.enabled true` and execute tests after successful compilation.
The gallery does not supply the test harness's custom include resolver. Fixtures that need unavailable includes
can display compiler diagnostics while their source remains browsable.

## Typography

Departure Mono is a pixel font. Use font sizes in whole multiples of 14px (14px, 28px, 42px, and so on).
All galleries use 14px text; the homepage uses 28px text. Keep these sizes explicit when adjusting typography.
