---
title: 'TODO: Add group-scoped source templates'
priority: Medium
effort: TBD
created: 2026-11-02
issue: null
status: Completed
completed: 2026-11-02
---

# TODO: Add group-scoped source templates

## Problem Description

Repeated group implementations currently require copying their child blocks and entries. The four-voice DX7 algorithm 5 example contains four copies of the same voice implementation, differing in their outer names, positions, and input wiring. Maintaining those copies independently makes changes unnecessarily repetitive.

Add reusable group templates as a compiler language feature. Expand templates in project source text before ordinary parsing so the existing project object model, later compiler stages, and editor editing machinery continue to operate on normal groups.

The project is unreleased. Backward compatibility, legacy syntax support, and migration shims are not requirements for this work.

## Proposed Solution

### Language syntax and expansion

- Define a template with `template <name>` and `templateEnd` in a root or group project scope.
- A child group selects a template with exactly one `useTemplate <name>` instruction in its own group-level source lines.
- In input source, a group using a template must not also author child blocks or entries, including modules, functions, includes, constants, prototypes, notes, nested groups, or local template definitions. All shared content comes from the selected template.
- The compiler stage responsible for template inlining validates these restrictions before insertion. Multiple `useTemplate` instructions are invalid even when they name the same template.
- Treat these as language syntax supported by the compiler source front end, including CLI consumers. `useTemplate` is not an editor directive.
- Run a source-to-source preprocessing step before `parseProjectSource` performs its ordinary structural parsing. Use the same path when loading a project into the editor.
- Remove template definition blocks from the text passed to the ordinary parser and insert their shared content into each using group.
- Keep the original `useTemplate <name>` instruction in the expanded group. Insert the template content after the group's own declaration lines, including `expose`, `init`, and `pass`.
- Retain `useTemplate` through the existing group `code` array. Do not replace it with `; @template`, add a `templateId` field, or introduce a template registry into the project object model.
- Later compiler stages compile the expanded child blocks normally; they do not resolve or expand templates.
- Expanded editor groups intentionally contain both the retained instruction and child content. The restrictions above apply to input source before template inlining, not to expanded groups in the project model or editor.

Conceptual flow:

```text
Load / CLI: source with templates -> expand source text -> ordinary project parser -> ordinary compiler
Save: ordinary project serialization -> extract templates from expanded group source -> source with templates
```

### Shared content and instance-specific content

The boundary is between a group's own declaration lines and its child blocks, rather than simply between content inside and outside entries.

| Content | Ownership |
| --- | --- |
| Group name and outer position | Per instance |
| Group-level `expose`, `init`, `pass`, and other declaration lines | Per instance |
| `useTemplate <name>` | Retained per instance as the template reference |
| Child functions, includes, constants, prototypes, and note blocks | Shared template content |
| Entries, including empty entries, their modules, and nested groups | Shared template content |
| Internal block positions and directives | Shared template content |
| Nested template definitions | Owned by their local scope within the shared content |

For example, an instance keeps this outer shell; expansion inserts the selected template's child blocks and entries before `groupEnd`:

```text
group voice1
; @pos 330 0
expose frequency &voiceInput:frequency
expose velocity &velocityCapture:velocity
expose trigger &voiceInput:trigger
expose release &voiceInput:release
expose out &limiter:out
init &frequency &roundRobin:frequency1
init &velocity &roundRobin:velocity1
init &trigger &roundRobin:trigger1
init &release &roundRobin:release1
pass env
pass preset
useTemplate dx7Voice
groupEnd
```

Templates share source text. Each expanded group still has independent memory and execution state. Sharing generated code is a separate concern.

### Scope isolation

- Root and every group can own template definitions.
- Resolve a group's `useTemplate` only against definitions in the project scope that directly contains that group.
- Do not search further outward through ancestors, and do not make sibling groups' private definitions visible.
- The root can define `dx7Voice` for groups directly inside root. A voice group can define `envelope` for its own direct child groups. Those child groups cannot automatically use the root's `dx7Voice` definition.
- The same template name can be used independently in different owning scopes. Identify a template by its owning scope and name, not by name alone.
- Preserve nested template scopes when expanding an outer template. Each expanded instance owns its own nested scopes.
- Explicit forwarding of templates across scope boundaries, such as a future `pass` extension, is outside the initial implementation.

### Serialization: rightmost group wins silently

- Run template extraction on the source produced by ordinary project serialization, keeping template-specific behavior out of the editor's editing model.
- Process each owning scope independently. For each referenced template in that scope, select the last using group in actual serialization traversal order.
- Reuse the existing spatial precedence used for other blocks: left to right, then top to bottom, then creation order. The rightmost group wins; moving a group can change which copy supplies the template. Use the existing ordering logic rather than introducing a separate template comparator.
- Use that group's shared content to emit one `template <name>` / `templateEnd` definition in the owning scope.
- Adding `useTemplate foo` to an existing expanded editor group automatically makes its child content a template during serialization. No prior template definition or registration is required for authoring this way; the serializer creates the owning-scope definition from the selected group.
- Omit unused template definitions during serialization. Definitions are reconstructed from using groups; there is no requirement to preserve a definition with no instances.
- Serialize every using group with its own declaration lines and retained `useTemplate` instruction, omitting its expanded shared content.
- Earlier instances' differing shared content is silently superseded by the selected last instance. Do not compare copies for divergence, warn, fail the save, or ask for confirmation.
- Saving need not synchronize or mutate the live groups. They may differ until the saved project is reopened; reopening expands the selected content into every instance.
- Apply the same rules recursively to local templates inside shared content. Keep nested definitions in their owning scopes instead of hoisting them to root.

Live synchronization and stronger enforcement of equal contents between instances are deferred.

## Implementation Plan

### Step 1: Add scoped source preprocessing

- Place source expansion in the compiler's project-source front end so editor loading and CLI parsing use the same behavior.
- Scan structural block boundaries, including nested groups, entries, and template definitions. Preserve comment and note text without interpreting embedded examples as instructions.
- Collect definitions per owning scope before expanding references so lookup is independent of definition placement within that scope.
- Validate raw using groups in the template-inlining stage before expansion: exactly one `useTemplate` instruction and no authored child blocks or entries alongside it. Do not defer these checks to ordinary parsing or later compiler stages.
- Expand references recursively with direct-containing-scope lookup. Report malformed definitions, missing templates, duplicate names within one scope, and recursive expansion without leaking templates into later compiler stages.
- Keep expansion diagnostics useful at the source boundary and retain existing block-relative diagnostics for the resulting editable groups.

### Step 2: Add inverse source serialization

- Extract shared child content while preserving each instance's declaration lines and `useTemplate` instruction.
- Select the last instance separately for each scoped template using existing spatial serialization order, so the rightmost instance takes precedence. Emit definitions in their owning scopes.
- Generate a definition automatically when an expanded editor group gains `useTemplate`, even if that name had no previous definition. Omit definitions without using groups.
- Preserve internal layout, nested groups, all entry definitions, and nested template scope boundaries.
- Keep templates out of canonical project and editor state types; do not add a registry to retain unused definitions.

### Step 3: Apply templates to the four-voice DX7 example

- Extract the repeated voice implementation into a root-owned `dx7Voice` template.
- Keep four named voice groups with their own positions, exposures, initializers, passes, and `useTemplate dx7Voice` instruction.
- Preserve the existing round-robin distribution, temporary sustain behavior, independent voice state, and shared preset behavior.

### Step 4: Document and verify the language feature

- Document syntax, input-source restrictions, the shared-content boundary, scope isolation, automatic template creation, unused-definition removal, and silent rightmost-instance serialization.
- Add focused compiler/preparser and serialization tests, followed by a real-editor load/edit/save/reopen check.
- Adapt example tests that currently compare literal copied voice bodies to verify equivalent expanded voices instead.

## Success Criteria

- [x] Compiler/CLI and editor loading accept the same template source through the shared source front end.
- [x] Expanded groups retain `useTemplate` and compile without template resolution in later stages.
- [x] The template-inlining stage rejects multiple `useTemplate` instructions and authored child blocks or entries alongside a template reference in input source, while expanded editor groups remain valid.
- [x] No template-specific fields or registries are added to project-model or editor-state types.
- [x] Functions, includes, constants, prototypes, notes, empty entries, modules, and nested groups survive expansion and serialization.
- [x] Every instance retains its own outer name, position, exposures, initializers, passes, and other group-level lines.
- [x] Template lookup uses only the directly containing scope; ancestors and sibling private scopes are inaccessible.
- [x] Identical names in separate scopes resolve and serialize independently, including inside copied outer templates.
- [x] Divergent instances save silently using existing spatial serialization order: the rightmost instance wins, moving a group can change the winner, and reopening gives all corresponding instances that selected shared content.
- [x] Adding `useTemplate foo` to an existing expanded editor group creates the definition from its content on save without requiring an earlier definition.
- [x] Unused template definitions are omitted during save without introducing template storage in the project model or editor.
- [x] Saving, reopening, and saving again produces stable template source and preserves internal layout.
- [x] Nested block parsing, note text, missing references, duplicate definitions, and recursive expansion have focused coverage.
- [x] The four-voice DX7 example has one saved voice implementation and four independently wired and stateful instances, with existing playback checks passing.

## Affected Components

- `packages/compiler/packages/project-preparser/` - Source scanning, scope-local template expansion, and parser integration.
- `packages/compiler/src/index.ts` and CLI consumers - Shared source-front-end access; ordinary object-model compilation remains template-agnostic.
- `packages/editor/plugins/project-save/src/serializeTo8f4e.ts` - Integration with inverse source extraction after ordinary serialization.
- Editor project-loading consumers - Use the shared compiler source path without template-specific editing behavior.
- `packages/examples/src/projects/audio/dx7Algorithm5FourVoices.8f4e` - First concrete use of group templates.
- Compiler/preparser, project-save, CLI example, and editor integration tests - Expansion, scoping, serialization, and playback coverage.
- Language and project-source documentation - New syntax and serialization semantics.

## Risks & Considerations

- Silent last-instance selection intentionally discards earlier instances' differing shared content from the saved source. This is the agreed initial behavior; do not add divergence warnings or enforcement.
- Existing spatial serialization order determines the winner, with the rightmost group taking precedence. Group movement intentionally affects selection, including in nested scopes.
- Unused definitions are intentionally removed on save. Adding `useTemplate` to a populated editor group is the supported way to create a definition from existing content. Raw source loading still requires the referenced definition and forbids inline child content beside the reference.
- Plain text replacement is insufficient for nested structures and note content. Keep structural scanning contained in source preprocessing and extraction.
- The project is unreleased; make direct changes where needed without compatibility branches or migration machinery.

## Related Items

- [TODO 477: Establish compiler-owned ProjectObjectModel](477-establish-project-object-model.md) - Preserve the canonical expanded project contract.
- [TODO 499: Unify project instruction syntax parsing](../499-unify-project-instruction-syntax-parsing.md) - Coordinate group-level source syntax ownership without adding template semantics to later compiler stages.

## References

- `packages/compiler/packages/project-preparser/src/parseProjectSource.ts` - Existing source-to-project boundary.
- `packages/editor/plugins/project-save/src/serializeTo8f4e.ts` - Existing project-to-source boundary.
- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/projectSerialization/serializeProjectLevel.ts` - Existing recursive editor serialization and ordering.
- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/compareCodeBlocksByPosition.ts` - Existing spatial precedence and tie-breaking logic to reuse.

## Notes

- Recorded on 2026-11-02 from the group-template design discussion following the four-voice DX7 example.
- Clarified on 2026-11-02: remove unused definitions, create templates automatically from marked editor groups, validate one reference and no inline child content in the compiler inlining stage, and reuse rightmost spatial precedence.
- Initial scope deliberately excludes synchronized editing, divergence checks, implicit ancestor visibility, template forwarding, and generated-code deduplication.

## Implementation Result

Completed on 2026-11-02:

- Added compiler-owned source inlining and inverse extraction in `@8f4e/project-preparser`, preserving `useTemplate` without new project-model or editor-state fields.
- Added isolated scope lookup, forward definitions, input-source validation, centralized diagnostics, automatic definition creation, unused-definition removal, and silent existing spatial precedence.
- Connected extraction after ordinary project saving and documented the language and authoring rules. Notes preserve arbitrary block examples during save as well as load.
- Recovered only the earlier four-voice DX7 example, its tests, and preview from the workspace stash, then replaced its four repeated voice bodies with one `dx7Voice` template. Other stashed work was left untouched.
- Verified parser, language-spec, tokenizer, compiler, project-save, and project-open suites; all affected type checks and Biome checks; 23 DX7/example tests; and both website builds.
- Verified all 19 product-website browser checks, including adding references through generic editing, editing child content, moving a group to change precedence, saving, and reopening selected template content.
- Confirmed live four-voice keyboard allocation, sustained chords, sustain release, shared preset switching, no layout overlaps, and no browser page errors.
- Audited shipped build inputs for the DX7 source/preview, compiler fixture, and documentation catalog.

## Archive Instructions

When this TODO is completed:

1. Set `status: Completed` and provide the completion date.
2. Move the file to `docs/todos/archived/` and update related links.
3. Move its entry from Active TODOs to Completed TODOs in `docs/todos/_index.md`.
