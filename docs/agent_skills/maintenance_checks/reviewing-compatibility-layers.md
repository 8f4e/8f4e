# Reviewing Compatibility Layers

Use this check when a user asks an AI agent to do cleanup, simplify after a refactor, remove old APIs, tighten types, remove ambiguity, or make one source of truth own a contract.

This document is meant to be an agent aid. When a cleanup request is broad or underspecified, use it to look for compatibility layers that may have been left behind by previous AI-generated work.

## Goal

Find and remove compatibility layers that preserve old shapes after the repository has moved to a stricter interface.

## Why This Matters

This project is not released yet and we own the whole codebase. Compatibility layers often make AI-generated refactors look smaller while leaving duplicate contracts behind. They also make future work harder because contributors must reason about both the intended interface and the legacy path that still accepts stale shapes.

Common costs:

- old and new APIs drift apart;
- tests keep passing through fallback behavior instead of proving the new contract;
- runtime code keeps accepting states that strict types should rule out;
- future agents copy the compatibility layer as if it were part of the design.

## Typical Compatibility Layers

Watch for these especially after AI-assisted edits:

- **Alias-only types**: `OldThing = NewThing`, `ParsedThing = TokenizedThing`, `CodegenThing = ResolvedThing` where the names no longer represent distinct shapes.
- **Compatibility re-exports**: old module paths that re-export the new path only to avoid updating imports.
- **Adapter wrappers**: functions whose only job is to translate old argument order, field names, or return shape into the new API.
- **Duplicated spec tables**: a new central metadata object plus an old local map, list, or enum that mirrors part of the same contract.
- **Hardcoded exception lists**: `if (name !== 'oldSpecialCase')` or `Exclude<NewUnion, 'oldSyntheticName'>` when the new metadata could describe the difference directly.
- **Fallback parsers or readers**: code that accepts old syntax, old JSON keys, old config names, or old serialized formats after sources/tests should have been migrated.
- **Optional fields kept for old shapes**: fields made optional only because old construction sites were not updated.
- **Broad unions kept during migration**: `Old | New`, `string | StrictName`, or `unknown` inputs that remain after all callers could use the strict type.
- **No-op wrapper functions**: `normalizeX`, `toNewX`, or `fromLegacyX` implementations that return their input unchanged.
- **Deprecated names without removal plan**: comments, names, or tests that say "legacy", "temporary", "backward compatible", or "for compatibility" without an active migration boundary.
- **Test-only shims**: helper branches that exist only to avoid updating fixtures, snapshots, or mocks.
- **Silent default fallbacks**: code that fabricates placeholder values for missing data that should now be required by type or earlier validation.

## Search Prompts

Do not rely on explicit compatibility language. Most leftover compatibility layers are not labeled as compatibility. Start from the contract that should now have one owner, then search for duplicate shapes around that contract.

Search for duplicate metadata, registries, and derived lists near the owning spec:

```sh
rg -n "Spec|Specs|Names|List|Map|Registry|Table|Record<|Set<|ReadonlySet" compiler/packages/language-spec/src compiler/src compiler/packages/sub-program/packages/tokenizer/src -g '*.ts'
```

Search for alias-only type layers and renamed shapes that may only preserve an old interface:

```sh
rg -n "export type .* = .*;|type .* = .*;" compiler/packages/language-spec/src compiler/src compiler/packages/sub-program/packages/tokenizer/src -g '*.ts'
```

Search for broad input types that may keep runtime code responsible for ambiguity:

```sh
rg -n "unknown|any|string \\||\\| string|Partial<|Record<string|\\?:" compiler/packages/language-spec/src compiler/src compiler/packages/sub-program/packages/tokenizer/src -g '*.ts'
```

Search for pass-through wrappers and old-to-new conversion functions:

```sh
rg -n "normalize|resolve|to[A-Z]|from[A-Z]|create|build|parse" compiler/packages/language-spec/src compiler/src compiler/packages/sub-program/packages/tokenizer/src -g '*.ts'
```

Search for fallback-style control flow and runtime checks that might exist only because the type interface is still too loose:

```sh
rg -n "fallback|if \\(!.*\\)|\\?\\?|as unknown|as any|Exclude<|Extract<|throw getError|throw new" compiler/packages/language-spec/src compiler/src compiler/packages/sub-program/packages/tokenizer/src -g '*.ts'
```

Only after structural searches, do a low-confidence sweep for explicit labels:

```sh
rg -n "compat|compatibility|legacy|deprecated|shim|adapter|backward|backwards|temporary|transitional" packages src docs -g '*.ts' -g '*.md'
```

These searches are intentionally noisy. Review matches by intent, not by keyword alone. A clean explicit-label search does not mean the cleanup is complete.

## Review Steps

1. Restate the cleanup target in concrete terms.

   Name the old interface, broad type, duplicated metadata, runtime fallback, or transitional path that should disappear.

2. Identify the new intended source of truth.

   Examples: an instruction spec table, a discriminated union, a parsed AST line shape, an Nx project target, or a single package export.

3. Trace all old names and paths.

   ```sh
   rg -n "OldName|old-path|legacyField" .
   ```

4. Classify each old surface.

   Ask whether it is:

   - a real independent concept;
   - a compatibility layer that only preserves the old interface.

   If it is a compatibility layer, remove it. Do not keep migration shims, aliases, fallbacks, or alternate names for future cleanup.

5. Prefer metadata over exception lists.

   If a name is excluded because it is synthetic, internal, non-codegen, non-source, or otherwise special, add explicit metadata to the owning spec instead of keeping a hardcoded exclusion list elsewhere.

6. Delete the compatibility path and update callers.

   Since the project is unreleased, prefer direct API moves over shims. Update imports, tests, snapshots, fixtures, docs, and helper types to the new interface.

7. Verify old names are gone.

   ```sh
   rg -n "OldName|LegacyName|compat|shim|backward" packages docs
   ```

8. Run the smallest meaningful verification, then broaden if shared contracts moved.

   For compiler/type-interface changes, prefer:

   ```sh
   npx nx run @8f4e/language-spec:typecheck
   npx nx run @8f4e/tokenizer:typecheck
   npx nx run compiler:typecheck
   npx nx run @8f4e/tokenizer:test
   npx nx run compiler:test
   ```

9. Report what was removed.

   In the final answer or PR description, list the compatibility layers removed and mention any old names that intentionally remain. If an old name remains, explain the current owner and why it is not a compatibility layer.

## Removal Rule

Never keep a compatibility layer. This project is unreleased, and the repository owns its callers, tests, fixtures, package exports, and docs. When a compatibility layer is found, delete it and update every caller to the intended interface in the same change.

Compatibility layers must be removed when:

- all callers live in this repository;
- the old name only exists to avoid updating imports, tests, snapshots, or fixtures;
- the old shape is now impossible after tokenizer, semantic, or type validation;
- the compatibility layer duplicates metadata that now has one owner;
- the layer makes runtime code handle ambiguity that strict types can remove.

## Review Notes

- Small-looking PRs are not the goal. A larger honest rename is better than a small PR that hides a stale interface.
- Do not preserve old and new spellings unless the user explicitly asks for a migration window.
- Do not add runtime fallbacks for states that the parser, semantic pass, or type system should make impossible.
- When in doubt, write down the owner of the contract. If two places own it, one is probably a compatibility layer.
