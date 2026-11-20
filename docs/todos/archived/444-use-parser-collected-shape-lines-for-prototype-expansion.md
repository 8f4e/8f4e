---
title: 'TODO: Use parser-collected shape lines for prototype expansion'
priority: Medium
effort: 4-8h
created: 2026-06-01
issue: null
status: Completed
completed: 2026-06-01
---

# TODO: Use Parser-Collected Shape Lines for Prototype Expansion

## Problem Description

`ModuleAST.containsShape` lets the compiler skip prototype shape expansion for modules that have no `shape` instructions, but modules that do contain shapes still do extra source work.

Today `compile()` parses a module to AST, checks `ast.containsShape`, then `expandModuleSourceShapes()` loops over `source.code` and calls `parseLine()` again for each `shape` line it finds.

The tokenizer/parser already encounters those shape instructions while building the module AST, so the compiler should not need to rediscover and partially reparse them from raw source.

## Proposed Solution

Extend module AST metadata from a boolean-only hint to parser-collected shape information.

Potential shape:

- Keep `containsShape` if the cheap boolean remains useful.
- Add `shapeLines: readonly ShapeLine[]` or `shapeLineNumbers: readonly number[]` to `ModuleAST`.
- Have the tokenizer/parser populate the list in `applyModuleASTLine(...)` when it sees `line.instruction === 'shape'`.
- Change shape expansion to iterate the parser-produced shape metadata instead of scanning `source.code` looking for `shape`.

Avoid adding project-level preparse flags or raw source fallbacks. The source of truth should be the module AST produced by the tokenizer/parser.

## Implementation Plan

### Step 1: Extend Module AST Metadata

- Add parser-owned shape metadata to `ModuleAST`.
- Populate it in `packages/compiler/packages/tokenizer/src/parser.ts`.
- Add tokenizer tests proving the metadata is present and source ordered.

### Step 2: Rewrite Shape Expansion Around Parser Metadata

- Change `expandModuleSourceShapes()` to consume the parsed module AST shape metadata.
- Preserve non-shape source lines and replace shape locations with prototype memory declaration lines.
- Keep diagnostics anchored to the existing parsed `ShapeLine`.

### Step 3: Preserve Macro Behavior

- Keep macro expansion before module AST parsing, because macros can produce shape instructions.
- Ensure macro-produced shape lines are represented in the parsed shape metadata.

## Success Criteria

- [x] The compiler no longer scans a shaped module with `startsWithInstruction(trimmed, 'shape')`.
- [x] The compiler no longer calls `parseLine()` while expanding already parsed shape instructions.
- [x] Macro-produced shapes still expand correctly.
- [x] Prototype shape fixture tests still pass.

## Affected Components

- `packages/compiler-spec/src/ast.ts`
- `packages/compiler/packages/tokenizer/src/parser.ts`
- `packages/compiler/src/index.ts`
- `packages/compiler/src/index.test.ts`
- `packages/compiler/tests/`

## Risks & Considerations

- **Source reconstruction**: If expansion still returns source text, it may need line-number metadata to splice replacements without scanning for shape instructions.
- **Future direction**: A larger follow-up could expand shapes at the AST level and avoid reparsing expanded module source entirely.
- **No compatibility burden**: The software has not been released yet, so update internal APIs directly and do not add compatibility shims.
