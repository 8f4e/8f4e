---
title: 'TODO: Add an inline sample browser directive'
priority: Medium
effort: TBD
created: 2026-10-22
issue: null
status: Open
completed: null
---

# TODO: Add an inline sample browser directive

## Problem Description

Referencing sample files requires typing or copying long URLs into `@config bin.<id>.url`. Exploring a collection
and switching between samples would be easier with a file selector inside the editor.

## Proposed Idea

Add an editor directive that renders a directory browser within a code block, for example:

```txt
; @browser https://baseurl.com/folder/samples/ bin.amen
```

The browser lists folders and files under the supplied URL. Selecting a folder navigates into it; selecting a file
creates or updates `; @config bin.amen.url <selected-file-url>` in the project source. The existing binary asset
loading flow then loads the selected sample.

Keep the selected file visible in the list and make selection a normal, undoable source edit that survives saving
and reopening the project. A compact, scrollable list could keep the widget's size manageable.

## Open Questions

- Should the directive target an asset (`bin.amen`) or an explicit config path (`bin.amen.url`)?
- How should the host expose its file list? A generated JSON index could work with static hosting; directory-listing
  endpoints are another possibility. A folder URL alone does not guarantee that its contents can be enumerated.
- What listing format and cross-origin access configuration should be supported initially?
- Where should the generated config line live, and how should existing or duplicate declarations be handled?
- Should search, filtering, or audio preview be included initially or added later?

## Success Criteria

- [ ] A directive displays a navigable folder/file list inside its code block.
- [ ] Selecting a file updates the bound asset URL in saved project source.
- [ ] Selection participates in undo/redo and triggers the existing asset-loading flow.

## Notes

This is an initial idea; directive syntax, listing protocol, and interaction details remain open.
