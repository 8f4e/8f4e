---
title: 'TODO: Benchmark Wasm IR simplifications'
priority: Medium
effort: TBD
created: 2026-11-10
issue: null
status: Open
completed: null
---

# TODO: Benchmark Wasm IR simplifications

## Problem Description

The opt-in `--simplify-wasm-locals` pass fused 862 local write/read pairs in the inlined DX7 build
with compiler memory guards disabled. Measure its effect on Wasmtime render time and compare it
with other small IR rewrites. [Local simplification PR](https://github.com/8f4e/8f4e/pull/1450)

## Proposed Solution

Benchmark compiler-only rewrites on the existing [eight-voice DX7 project](../../packages/examples/src/projects/midi/dx7Algorithm5EightVoices.8f4e).
Treat every declared memory location as observable through the editor.

- Propagate known literals through Wasm locals within straight-line blocks. Fold the resulting
  integer expressions while preserving Wasm overflow and trap behavior.
- Eliminate writes to unread locals. Replace an unused `local.set` with `drop` to preserve operand
  evaluation. Remove an unused `local.tee` while leaving its operand on the stack.
- Replace a void `if` containing only a branch to an enclosing block with `br_if`. Adjust the
  branch depth for the removed block.

## Implementation Plan

1. Measure the baseline and the current local fusion pass on Wasmtime on the Pi 5. Use the same
   compiler revision, DX7 source, 48 kHz sample rate, and 128-sample blocks.
2. Measure each candidate independently against the fusion pass. Start with literal propagation
   and integer folding together, then compare a build that combines the candidates. Keep
   inlining, pruning, and memory guard settings fixed within each comparison.
3. Include a matching `wasm-opt -O3` reference. Record the compiler and optimizer flags, WASM
   size, instruction counts, mean and p99 render time, JACK load, and underruns.

## Success Criteria

- [ ] Record the size and timing change for the current fusion pass and each candidate.
- [ ] Compare all shared memory bytes after each of 768 blocks with the same 468 scripted MIDI
      events across every variant.
- [ ] Repeat the JACK probes and record the Pi clock and throttling status with the results.

## Affected Components

- [Wasm IR simplifier](../../packages/compiler/packages/sub-program/packages/wasm-ir-simplifier/src/index.ts)
  for the candidate rewrites.
- [CLI compile](../../packages/cli/README.md#wasm-optimization) for selecting benchmark variants.

## Risks & Considerations

Keep the project source and shared memory accesses intact. Use exact WebAssembly semantics for
folding and preserve potentially trapping computations when dropping a local write. Treat the
instruction counts as size evidence and use Wasmtime timings to assess runtime gains.
