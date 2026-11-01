---
title: 'TODO: Unify project instruction syntax parsing'
priority: Medium
effort: 4-8h
created: 2026-10-14
issue: https://github.com/8f4e/8f4e/issues/1026
status: Open
completed: null
---

# TODO: Unify project instruction syntax parsing

## Problem Description

Project instructions have inconsistent syntax ownership. `expose` is parsed in `@8f4e/project-preparser` using manual
whitespace splitting and reference-string checks. `pass` and `init` use `@8f4e/tokenizer`, which already handles inline
comments, classifies reference arguments, and attaches structured syntax diagnostics.

The separate exposure parser duplicates token-level rules and reports plain errors. The program composer also has
similar collection loops for `pass` and `init`, including repeated source-context handling. These differences reflect
how the features were introduced rather than different language requirements.

## Proposed Solution

Make the tokenizer own syntax parsing and validation for all three instructions. Move exposure parsing onto the
existing instruction-token and argument-classification path. Keep project block structure and exposure collection
in the preparser, and keep scoped composition and semantic resolution in their existing stages.

Use one strict exposure parser for compiler input and tolerant live-editor parsing. Consolidate duplicated collection
and diagnostic-context code where useful without introducing another project object model or compilation input.

## Implementation Plan

1. Move exposure syntax parsing into the tokenizer, using structured identifier fields rather than splitting
   `&module:memory` again. Define its syntax errors and default messages in the central syntax-error registry.
2. Make the preparser delegate exposure syntax to that parser while retaining group ownership, duplicate-name
   validation, canonical exposure metadata, and original source text.
3. Update editor consumers and parser tests to use the tokenizer-owned API. Preserve tolerant handling of incomplete
   live-editor lines through the same strict parser; remove obsolete parser exports and implementations.
4. Consolidate repeated `pass`/`init` source-line collection and group diagnostic-context attachment in composition.
   Keep symbol lookup, scope checks, and backing-memory validation in semantic phases.
5. Add focused tokenizer coverage and project fixtures for comments, whitespace, malformed operands, extra arguments,
   nested groups, and group-relative diagnostics. Update affected documentation and snapshots.

## Success Criteria

- [ ] `expose`, `pass`, and `init` syntax is owned by the tokenizer and reuses existing token/argument parsing.
- [ ] Inline comments and whitespace are handled consistently across all three instructions.
- [ ] Malformed exposure syntax produces structured syntax diagnostics with the correct group and source line.
- [ ] Incomplete editor lines remain tolerable without a second syntax implementation.
- [ ] Project structure, source preservation, exposure resolution, namespace passes, and initializer semantics remain intact.
- [ ] Downstream phases trust validated argument shapes instead of repeating syntax checks.
- [ ] Old parser implementations and compatibility re-exports are removed.

## Affected Components

- `packages/compiler/packages/sub-program/packages/tokenizer/src/` and its project-instruction parsers/tests.
- `packages/compiler/packages/project-preparser/src/projectMemoryExposure.ts`, its exports, and project-source parsing.
- `packages/compiler/packages/program-composer/src/composeProgram.ts` and composition fixtures.
- Editor exposure consumers in `features/code-blocks/features/connectors/` and `pureHelpers/projectSerialization/`.
- `@8f4e/language-spec` project contracts only where shared syntax types are needed.

## Risks & Considerations

- Preserve group-relative diagnostic identity; do not substitute whole-file line numbers for block-relative locations.
- Keep syntax failures separate from semantic failures such as missing backing memory or invalid initializer scope.
- The project is unreleased: update consumers directly without compatibility wrappers, aliases, or fallback parsers.
- This task does not change instruction syntax, scope rules, initializer precedence, or supported initializer values.

## Validation Checkpoints

- Run tokenizer, project-preparser, program-composer, and compiler tests through Nx.
- Run editor-state tests for group connectors, project import/export, and incomplete source lines.
- Run affected Nx typechecks and Biome on changed TypeScript files.

## Related Items

- [PR #1019](https://github.com/8f4e/8f4e/pull/1019) introduced `init` and simplified `expose`, revealing the
  inconsistent parsing paths.
- [TODO 378](378-make-parser-stateful-for-block-pairing-and-owning-block-context.md) covers broader parser context and
  diagnostic ownership.
