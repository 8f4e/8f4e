---
title: 'TODO: Consolidate release action commits'
priority: Medium
effort: 2-4h
created: 2026-05-19
issue: https://github.com/8f4e/8f4e/issues/664
status: Completed
completed: 2026-05-19
---

# TODO: Consolidate release action commits

## Problem Description

The release workflow currently creates up to four commits for one release:

- `chore(release): version packages`
- `chore(release): record bundle sizes`
- `chore(release): record bytecode sizes`
- `chore(release): record compiler coverage counts`

This makes release history noisy and splits one logical release operation across multiple commits.

There is also a provenance concern: the metric scripts read `git rev-parse HEAD`, so separate post-version commits can make the recorded metric commit point at the intermediate release commit rather than the final release history state.

## Proposed Solution

Prefer one release commit total. Configure or invoke Nx release so version/package changes are staged and release tags are prepared without immediately committing, then run the release metric loggers and commit everything together.

The target commit message should be:

`chore(release): version packages and record metrics`

If Nx release cannot cleanly prepare version changes and tags without making its own commit, use a smaller fallback: keep the Nx version commit and combine the three metrics commits into one `chore(release): record release metrics` commit.

## Implementation Plan

### Step 1: Adjust Nx Release Commit Behavior

- Investigate whether `npx nx release --skip-publish` can be invoked or configured to avoid the automatic version commit while still preparing version changes and tags.
- Prefer workflow-local CLI options if available; otherwise update `nx.json` release git settings only if that behavior should apply outside CI too.

### Step 2: Keep Metrics After Versioning

- Continue running the metric generation after versions are updated:
  - `npx nx run app:build`
  - `node scripts/log-bundle-sizes.mjs`
  - `npx nx run @8f4e/examples:log-bytecode-size`
  - `npx nx run @8f4e/examples:log-compiler-coverage-counts`
- Preserve the existing "skip when already logged" behavior in the metric scripts.

### Step 3: Commit Release Changes Together

- Stage version/package changes and all changed files under:
  - `logs/bundle-sizes`
  - `logs/bytecode-size`
  - `logs/compiler-coverage-counts`
- Create a single release commit when there are staged changes.
- Push the commit and release tags with the existing atomic push behavior.

### Step 4: Use Two-Commit Fallback If Needed

- If Nx release must create the version commit before tags can be produced correctly, leave that commit in place.
- Replace the three per-metric commit blocks with one combined metrics commit.

## Validation Checkpoints

- Run the release workflow logic in a dry-run or throwaway branch before enabling it on `main`.
- Confirm generated release tags point at the intended release commit.
- Confirm metric logs are still updated for the released package versions.
- Confirm the final push still uses `--atomic` with `--follow-tags`.

## Success Criteria

- [x] A normal release produces one commit total, or two commits if the fallback is chosen.
- [x] Release tags still point to the intended versioned release commit.
- [x] Bundle size, bytecode size, and compiler coverage logs are still recorded for released versions.
- [x] The workflow still pushes commits and tags atomically.

## Completion Notes

Completed on 2026-05-19.

- The two-commit fallback was chosen: Nx still creates `chore(release): version packages`, and release metrics are combined into one `chore(release): record release metrics` commit.
- Verified `.github/workflows/release.yml` runs bundle size, bytecode size, compiler coverage, and docs coverage logging after `npx nx release --skip-publish`.
- Verified the workflow stages release metric logs together and keeps the existing atomic `git push origin HEAD:main --follow-tags --no-verify --atomic`.
- Implementation landed in `5495c4478 fix(ci): consolidate release metrics commit in workflow`.

## Affected Components

- `.github/workflows/release.yml`
- `nx.json`
- `scripts/log-bundle-sizes.mjs`
- `scripts/log-bytecode-sizes.mjs`
- `scripts/log-compiler-coverage-counts.mjs`

## Risks & Considerations

- **Tag target risk**: Tags must still point at the commit that contains the package version updates.
- **Metric provenance risk**: Metric entries should continue to record a meaningful commit SHA for the release being measured.
- **Nx behavior risk**: Nx release git options may affect local/manual release behavior if changed globally in `nx.json`.

## Related Items

- **Issue**: https://github.com/8f4e/8f4e/issues/664
