---
title: 'TODO: Investigate env source overwrites'
priority: High
effort: TBD
created: 2026-10-27
issue: null
status: Open
completed: null
---

# TODO: Investigate env source overwrites

The editor generates environment constants in an `env` block. The ownership and lifecycle of that generated source
need investigation: loading a valid user-authored module named `env` currently replaces its source with generated
`constants env` content.

Reproduced while reviewing [PR #1282](https://github.com/8f4e/8f4e/pull/1282), using this project:

```text
8f4e/v1
entry main
module env
int value 1
moduleEnd
entryEnd
```

Parsing and compilation succeed. Loading the project through the editor's `loadProject` action replaces the module
body with the generated environment block. The refresh triggered when rendered blocks are populated reaches a
name-only block match in the [environment constants effect](../../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/auto-env-constants/effect.ts).

Explore how generated environment source should coexist with user-authored blocks, what ownership means across
project scopes, and which loading, editing, or navigation paths can trigger unintended rewrites. The desired
behavior and implementation approach are undecided; this TODO records the problem without choosing a fix.
