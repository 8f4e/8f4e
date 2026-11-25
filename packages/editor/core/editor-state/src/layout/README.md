# Block layout contributions

The independent `store.layout` service owns contributions and subscriptions. Plugins submit complete space/minimum-width
requests through `createContribution().update(block, value)` and subscribe to calculated blocks with `layout.subscribe`.
A subscription can update its own requests; unchanged values do not trigger another calculation. Core processes changed
requests synchronously and refreshes rendered text after layouts settle. Directive drafts contain only block/display
semantics. Match live blocks with `matchEditorDirectives(codeBlock.parsedDirectives, definitions)`. Core updates
records on source changes and retains unknown directives for late plugins. Raw-source parsing remains available
through `parseBlockDirectives` for incoming source and whole-project scans. Standalone and trailing directives share
the same syntax; matching preserves source context and normalizes aliases.
