---
title: 'TODO: Add url editor directive for clickable links'
priority: Medium
effort: 4-8h
created: 2026-03-12
issue: https://github.com/8f4e/8f4e/issues/413
status: Open
completed: null
---

# TODO: Add url editor directive for clickable links

## Problem Description

The editor currently has no directive for attaching a clickable external link to a code block.

That makes it awkward to associate a module or project with documentation, demos, or a homepage. Users can leave URL comments, but those comments are not interactive and require manual copy/paste.

## Proposed Solution

Add a new editor-only directive:

```txt
; @url 8f4e.com
```

The directive should render the URL as a clickable element in the editor and open it in a new browser tab when activated.
The directive input should omit the protocol and the editor should assume `https://`.

Key requirements:

- Treat `@url` as editor metadata only, not as a compiler instruction.
- Accept one URL argument from the directive line, without a protocol prefix.
- Render the URL in a visible way near the code block.
- Open the link in a new tab using safe browser semantics.
- Always construct the destination URL with `https://`.

## Anti-Patterns

- Do not accept or pass through explicit schemes such as `http:`, `https:`, `javascript:`, or `data:`.
- Do not require the compiler to parse or preserve special behavior for this directive.
- Do not make the link open automatically without explicit user interaction.

## Implementation Plan

### Step 1: Parse and store the directive
- Add parser support for `; @url <host-or-path>` in editor-state.
- Store the raw directive value in code block graphic data alongside other editor directive extras.
- Reject inputs that already include a protocol or otherwise fail the chosen validation rules.

### Step 2: Render clickable URL UI
- Add a web-ui drawer/decorator for URL directives.
- Render the URL as clickable text or a compact link label associated with the code block.
- Ensure placement does not interfere with text editing or selection.

### Step 3: Add interaction handling
- Detect pointer interaction on the rendered URL element.
- Open `https://` + directive value in a new browser tab.
- Use `noopener`/`noreferrer` protection or equivalent browser-safe handling.

### Step 4: Add tests and docs
- Add parser and graphic-data tests in editor-state.
- Add interaction or integration coverage in web-ui where practical.
- Document the directive in the editor directives docs.

## Validation Checkpoints

- `npx nx run @8f4e/editor-state:test`
- `npx nx run @8f4e/web-ui:test`
- `rg -n "@url|https://|window.open|noopener|noreferrer" packages/editor docs`

## Success Criteria

- [ ] `; @url 8f4e.com` is recognized as an editor directive.
- [ ] The URL renders as a clickable element in the editor.
- [ ] Activating the element opens `https://` plus the directive value in a new browser tab.
- [ ] Unsupported or malformed URLs fail safely without breaking rendering.
- [ ] The compiler continues to ignore the directive.
- [ ] The directive is documented in the editor directives docs.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features` - URL directive parsing and graphic-data integration
- `packages/editor/packages/editor-core/packages/web-ui/src/drawers/codeBlocks` - URL rendering and interaction handling
- `packages/editor/docs/editor-directives.md` - directive documentation

## Risks & Considerations

- **Security**: URL handling must reject unsafe schemes and avoid opener leaks.
- **Interaction overlap**: Clickable hit areas must not interfere with code editing and block selection.
- **Visual clutter**: Raw URLs can be long, so rendering may need truncation or wrapping rules.
- **Platform behavior**: Opening a new tab should happen from a direct user gesture to avoid popup blocking.
- **Validation scope**: The allowed host/path format should be strict enough to reject malformed values but not so strict that normal HTTPS URLs become annoying to enter.

## Related Items

- **Related**: `docs/todos/241-load-project-from-query-param-url.md`
- **Related**: [TODO 210: Expose editor editing handles and add an external WebMCP adapter](archived/210-add-editor-editing-handles-and-webmcp-adapter.md)

## Notes

- This TODO records requested behavior only. Implementation is intentionally deferred.
- If raw URL text proves too noisy, a follow-up could add a label form such as `; @url 8f4e.com 8f4e`.
