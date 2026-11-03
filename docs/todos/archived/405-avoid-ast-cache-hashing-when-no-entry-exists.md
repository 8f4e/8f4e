---
title: 'TODO: Avoid AST cache hashing when no cache entry exists'
priority: Medium
effort: 1-2h
created: 2026-05-19
issue: https://github.com/8f4e/8f4e/issues/658
status: Completed
completed: 2026-05-19
---

# TODO: Avoid AST cache hashing when no cache entry exists

## Problem Description

`compileToAST` computes `hashSource(...)` before it knows whether a cache entry exists for the supplied key. In normal one-shot compiler runs, or on first parse for a key, that means every source block is fully hashed even though there is no entry to compare against.

The compiler coverage metrics showed `hashSource` as one of the hottest tokenizer functions by range executions.

## Proposed Solution

Check for an existing cache entry before hashing. If there is no entry for the key, skip hashing until after parsing, or store the parsed AST with a hash only when a future comparison will need it.

Consider whether fresh non-incremental compiler runs should bypass AST cache hashing entirely.

## Success Criteria

- [x] `compileToAST` avoids hashing source when no cache entry exists.
- [x] Incremental/editor cache hits still validate source changes correctly.
- [x] Compiler coverage hotspot mitigation landed for initial AST cache misses.

## Completion Notes

Completed on 2026-05-19.

- Verified `getASTCacheLookupResult` returns before `hashSource(...)` when there is no cached entry or when line counts differ.
- Verified AST cache tests cover unchanged cache hits, initial misses without hashing, changed source, changed line count, and changed line metadata.
- Implementation landed in `42c5b7331 fix(tokenizer): avoid AST cache hashing on initial miss (#665)`.

## Affected Components

- `packages/compiler/packages/tokenizer/src/parser.ts`
- `packages/compiler/packages/tokenizer/src/cache/hashSource.ts`
