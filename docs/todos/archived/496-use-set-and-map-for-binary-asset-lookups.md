---
title: 'TODO: Use Set and Map for binary-asset lookups'
priority: Low
effort: 1-2h
created: 2026-10-14
issue: https://github.com/8f4e/8f4e/issues/1013
status: Completed
completed: 2026-10-21
---

# TODO: Use Set and Map for binary-asset lookups

## Problem Description

Binary-asset configuration synchronization deduplicates URLs by repeatedly calling `includes()` on a growing array.
After fetching, it calls `find()` on the fetched-asset array for every load request to attach request-specific IDs and
memory targets. Both phases can perform quadratic work as the number of assets grows.

This affects project loading and binary-asset configuration changes rather than continuous rendering. Network and
decoding work may dominate real loading time, so the practical speedup needs measurement.

## Proposed Solution

Deduplicate request URLs with a `Set`, then pass its insertion-ordered values to the existing fetch helper. Build a
`Map` from URL to fetched metadata once per fetch result and reuse it while assembling the final asset array.

Keep request order and multiple memory destinations for the same URL. Preserve existing fetch behavior, error
handling, disposal checks, and generation checks that discard stale asynchronous results.

## Implementation Plan

1. Replace the unique-URL array membership loop with Set-based deduplication.
2. Index fetched metadata by URL once, then use direct lookups when creating request-specific asset entries.
3. Cover repeated URLs, distinct memory targets, failed fetches, and stale results with focused tests.
4. Compare metadata-processing time on large synthetic asset configurations with fetching mocked out.

## Success Criteria

- [ ] URL deduplication and fetched-metadata joining require linear total work for each configuration sync.
- [ ] Each unique URL is fetched once and in its original first-seen order.
- [ ] Multiple requests for one URL still produce separate entries with the correct IDs and memory targets.
- [ ] Failed or missing assets keep the current handling, and stale/disposed fetch results remain ignored.
- [ ] Measurements distinguish metadata-processing savings from network loading time.

## Affected Components

- `packages/editor/packages/editor-core/src/editorEnvironmentPlugins/binaryAssets/configSync.ts`
- Binary-asset configuration synchronization tests.
- `packages/editor/packages/editor-core/src/editorEnvironmentPlugins/binaryAssets/fetchBinaryAssets.ts` as the existing
  fetch contract; a return-type change is not required.

## Risks & Considerations

- Deduplicate fetches by URL without collapsing separate load requests or their memory destinations.
- Retain the original result ordering and first-match semantics if duplicate fetched metadata can occur.
- The current asset byte store is already a Map; this task targets the remaining repeated array searches.

## Validation Checkpoints

- Run `npx nx run @8f4e/editor-core:test` and its typecheck.
- Load a project that sends one binary asset to multiple memory targets and confirm every destination is populated.
