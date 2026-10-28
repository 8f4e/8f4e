# 8f4e Website

`@8f4e/8f4e-website` contains a product homepage, an examples gallery, and a compiler test gallery with embedded default editors. The website
controls the canvas size. Homepage editors leave wheel scrolling to the surrounding document and start in edit mode
with mode switching disabled.

From the workspace root:

```bash
npx nx run @8f4e/8f4e-website:dev
npx nx run @8f4e/8f4e-website:build
npx nx run @8f4e/8f4e-website:test:browser
npm --prefix tools/project-preview run generate-gallery-previews
npx nx run @8f4e/8f4e-website:serve
```

The development server runs at `http://localhost:3001` so it can run alongside `@8f4e/editor-website`.

Set the canvas's `data-project-path` attribute in `src/index.html` to a path relative to
`packages/examples/src/projects/` to choose the project loaded when the editor mounts. `src/example-projects.ts`
uses a Vite glob to emit the original `.8f4e` sources as downloadable assets shared by the homepage and examples gallery.
The npm command refreshes the committed 64×64 GIF previews in `src/project-previews/` after gallery projects or
their `@home` blocks change. The compiler gallery reuses one shared preview generated from a representative fixture.

## Examples gallery

The separate `/examples/` page lists curated projects from `src/examples/projects.ts`. Each entry supplies a stable ID,
title, short description, and a path relative to `packages/examples/src/projects/`. The homepage footer links
to the gallery. Vite builds the homepage and both galleries, including their project source assets, so example projects
need no separate deployment or precompiled WASM files. The `.8f4e` asset responses allow cross-origin requests through
`src/_headers` so Open in editor links can load these sources from `editor.8f4e.com`.

`projectCategories` in the same file defines category headings and their order. Projects are grouped by their
containing directory, with Amiga MODs listed separately from other audio examples. Category headings use `h2`
and individual example headings use `h3` on both desktop and mobile.

Above 800px, the list scrolls with the document while the selected editor stays fixed in the right column. At 800px
and below, the same panels become an accordion: the selected editor appears beneath its title and can be collapsed.
Resizing keeps the active editor instance. Without a selected example in the URL, mobile starts collapsed and desktop
opens the first example.

Each example has a shareable hash URL using its stable ID, such as `/examples/#granular-sampler`. Selecting an example
updates the address and page title; Back and Forward restore selections. Direct links also expand the matching mobile
accordion and scroll it into view. Collapsing a mobile example removes the selection from the URL. Unknown IDs fall back
to the default desktop selection or the collapsed mobile list.

Selecting a different example creates a fresh editor and disposes the previous instance. Mounts are serialized to
handle rapid selections, and each example uses its own session storage namespace. The gallery editor captures wheel
gestures for panning; scrolling over the example list scrolls the document. A link opens the example in the full editor.
The loading indicator stays visible while the editor contains its empty startup project. The gallery reveals the
canvas once fetched project content arrives; requests that leave it empty reach the 30-second timeout and offer a retry.

The browser integration test mounts the real default editor with a delayed project response to verify this startup path.

## Compiler test gallery

The `/tests/` page discovers `packages/compiler/tests/**/*.test.8f4e` through the Vite glob in `src/tests/projects.ts`.
Adding or removing a fixture updates the catalog at the next build. Fixtures are grouped by directory, with root-level
files under General. Error fixtures and include-only helper sources are excluded.

Vite emits the original project files as downloadable assets, so this gallery needs no separate fixture deployment.
Each project has a GitHub source link and an Open in editor link. Hash URLs use the relative fixture path without
`.test.8f4e`, for example `/tests/#instructions/integer-arithmetic`.

Both galleries use `src/gallery.ts` for selection, editor lifecycle, and the responsive layout. The test gallery uses
the editor's default block positioning and keeps editors in edit mode with mode toggling disabled.
Fixtures select `TestRuntime` through their editor directives and execute tests after successful compilation.
The gallery does not supply the test harness's custom include resolver. Fixtures that need unavailable includes
can display compiler diagnostics while their source remains browsable.

## Typography

Departure Mono is a pixel font. Use font sizes in whole multiples of 14px (14px, 28px, 42px, and so on).
Both galleries use 14px text; the homepage uses 28px text. Keep these sizes explicit when adjusting typography.
