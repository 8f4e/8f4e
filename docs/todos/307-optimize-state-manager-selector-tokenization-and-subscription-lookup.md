---
title: 'TODO: Optimize state-manager selector tokenization and subscription lookup'
priority: Medium
effort: 3-6h
created: 2026-03-14
issue: https://github.com/8f4e/8f4e/issues/555
status: Open
completed: null
---

# TODO: Optimize state-manager selector tokenization and subscription lookup

## Problem Description

The state manager currently does repeated string splitting and repeated path traversal during every `set(...)` call.

Current behavior:
- [packages/editor/packages/editor-core/packages/state-manager/src/subscribe.ts](packages/editor/packages/editor-core/packages/state-manager/src/subscribe.ts) tokenizes selectors when subscriptions are created
- [packages/editor/packages/editor-core/packages/state-manager/src/subscribeToValue.ts](packages/editor/packages/editor-core/packages/state-manager/src/subscribeToValue.ts) duplicates the same tokenization flow
- [packages/editor/packages/editor-core/packages/state-manager/src/set.ts](packages/editor/packages/editor-core/packages/state-manager/src/set.ts) splits the selector again on every update
- `set(...)` then calls `getValueByPath(...)`, which splits the selector yet again for every matching subscription

Why this is a problem:
- `set(...)` is a hot path
- repeated selector parsing is unnecessary because subscriptions already cache path tokens
- duplicated subscription setup logic makes the package harder to evolve

## Proposed Solution

Reduce repeated selector work and centralize subscription creation.

High-level approach:
- extract a shared selector-token helper or shared subscription factory
- add a token-based getter or direct traversal path so `set(...)` does not need to re-split selectors when reading subscriber targets
- keep the public API unchanged

Possible implementation shape:
- add `tokenizeSelector(selector)` helper
- add `getValueByTokens(state, tokens)` helper used internally by `set(...)`
- implement `subscribe(...)` and `subscribeToValue(...)` on top of one shared `createSubscription(...)` helper

## Anti-Patterns

- Do not introduce a large indexing system unless profiling proves it is needed.
- Do not change path semantics or selector syntax as part of this optimization.
- Do not make matcher behavior more complex while refactoring tokenization.

## Implementation Plan

### Step 1: Share selector tokenization
- Add one internal helper for converting a selector string into tokens
- Reuse it from `subscribe(...)`, `subscribeToValue(...)`, and `set(...)`

### Step 2: Avoid repeated path splitting on notification
- Add a token-based value reader
- In `set(...)`, use `subscription.tokens` instead of re-reading `subscription.selector` through `getValueByPath(...)`
- Keep current matching semantics intact

### Step 3: Dedupe subscription creation logic
- Factor common subscription object construction into one helper
- Keep type signatures and public behavior unchanged

### Step 4: Add focused tests or assertions
- Verify `subscribe(...)`, `subscribeToValue(...)`, `waitForChange(...)`, and `waitForValue(...)` still behave the same
- Add targeted tests around nested selectors and matcher callbacks

## Validation Checkpoints

- `rg -n "split\\('\\.'\\)|getValueByPath|subscribeToValue|createSubscribe" packages/editor/packages/editor-core/packages/state-manager/src`
- `npx nx run state-manager:test`
- `npx nx run state-manager:typecheck`

## Success Criteria

- [ ] Selector tokenization is centralized.
- [ ] `set(...)` no longer re-splits subscription selectors when notifying subscribers.
- [ ] `subscribe(...)` and `subscribeToValue(...)` no longer duplicate the same setup logic.
- [ ] Public API and matcher behavior remain unchanged.
- [ ] Tests still cover nested path subscriptions and value matching.

## Affected Components

- `packages/editor/packages/editor-core/packages/state-manager/src/set.ts` - current hot-path repeated selector work
- `packages/editor/packages/editor-core/packages/state-manager/src/subscribe.ts` - duplicated subscription setup
- `packages/editor/packages/editor-core/packages/state-manager/src/subscribeToValue.ts` - duplicated subscription setup
- `packages/editor/packages/editor-core/packages/state-manager/src/getValueByPath.ts` - likely source for a token-based internal variant

## Risks & Considerations

- **Behavior drift**: matcher semantics in `set.ts` are subtle and should remain unchanged.
- **Premature complexity**: the goal is to remove obvious repeated work, not to build a full reactive index.
- **Test gaps**: there should be explicit coverage for both primitive matcher values and predicate matchers.

## Related Items

- **Related**: `docs/todos/162-add-subscribe-to-value-state-manager.md`

## Notes

- This is a small internal optimization with some cleanup benefits.
- It should stay focused on tokenization and lookup reuse, not broader state-manager redesign.
