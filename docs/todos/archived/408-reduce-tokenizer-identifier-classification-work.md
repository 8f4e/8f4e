---
title: 'TODO: Reduce tokenizer identifier classification work'
priority: Medium
effort: 1-2d
created: 2026-05-19
issue: https://github.com/8f4e/8f4e/issues/661
status: Cancelled
completed: 2026-09-07
---

# TODO: Reduce tokenizer identifier classification work

## Problem Description

`parseArgument` and `classifyIdentifier` run many ordered shape checks for every identifier-like token. The current order is correctness-sensitive, but it means plain identifiers still pass through many intermodule, memory-reference, and metadata-query checks.

The compiler coverage hotspot run showed tokenizer parsing and identifier classification as major range-execution contributors.

## Proposed Solution

Introduce cheap prefix/suffix dispatch before running the full classification chain. For example, only check:
- intermodule/module reference patterns when the token contains `:`
- local memory address references when the token starts or ends with `&`
- metadata query forms when the token starts with `count(`, `sizeof(`, `max(`, or `min(`
- pointer forms when the token starts with `*`

Keep the existing precedence rules intact.

## Success Criteria

- [ ] Identifier classification behavior and error boundaries are unchanged.
- [ ] Existing tokenizer tests for reference parsing still pass.
- [ ] Tokenizer `rangeExecutions` drop for benchmark logs.

## Affected Components

- `packages/compiler/packages/sub-program/packages/tokenizer/src/syntax/parseArgument.ts`
- `packages/compiler/packages/sub-program/packages/tokenizer/src/syntax/*Reference*.ts`
- `packages/compiler/packages/sub-program/packages/tokenizer/src/syntax/has*Prefix*.ts`
