---
title: 'TODO: Extend CLI run with tracing and derived debug signals'
priority: Medium
effort: 1-2d
created: 2026-04-23
issue: https://github.com/8f4e/8f4e/issues/564
status: Open
completed: null
---

# Extend CLI `run` with tracing and derived debug signals

## Why

The new `cli run` command is already useful for inspecting final state after a fixed
number of cycles, but signal-debugging sessions still require modifying the `.8f4e`
project to expose temporary debug buffers and helper modules.

For audio, DSP, and compiler-runtime debugging, the CLI should make it easy to:

- record a value on every cycle
- inspect slices of larger buffers
- compare two signals without editing the source project
- export traces in formats that are easy to plot and diff

## Proposed additions

### Per-cycle tracing

- `--trace <id>`
  Record the requested value after every cycle.
- `--trace-out <file>`
  Write traces to a file instead of stdout.

Expected use:

```bash
cli run project.8f4e --cycles 128 --trace pcmPlayer:out --trace blepSmoother:correction
```

### Derived debug expressions

- `--expr <name>=<lhs>-<rhs>`
- Keep the first version intentionally small.
- Start with basic arithmetic on dumped or traced scalar values.

Expected use:

```bash
cli run project.8f4e --cycles 128 --trace pcmPlayer:out --trace blepSmoother:out --expr diff=blepSmoother:out-pcmPlayer:out
```

This would remove the need for temporary `difference` modules in many debugging sessions.

### Buffer range dumping

- `--dump-range <id>[start:end]`

Expected use:

```bash
cli run project.8f4e --cycles 1 --dump-range blepSmoother:blepBuffer[0:16]
```

This is preferable to dumping a whole large buffer when only a window matters.

### Optional export formats

- `--format json|csv`

JSON should stay the default, but CSV is easier to inspect in plotting tools and spreadsheets.

## Implementation notes

- Keep this as an extension of the existing `run` command, not a separate subcommand.
- Prefer small, composable helpers under `packages/cli/src/run/`.
- Avoid turning the CLI into a REPL for now.
- Derived expressions should operate on already-resolved values and traces, not introduce a general expression language.

## Suggested order

1. Add `--trace`
2. Add `--trace-out`
3. Add `--dump-range`
4. Add simple `--expr`
5. Add optional `--format csv`
