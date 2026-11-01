---
title: 'TODO: Remove hardcoded AudioWorklet buffer size from runtime contract'
priority: Medium
effort: 1-2 days
created: 2026-04-21
issue: https://github.com/8f4e/8f4e/issues/561
status: Open
completed: null
---

# TODO: Remove hardcoded AudioWorklet buffer size from runtime contract

## Problem Description

The AudioWorklet runtime currently injects `const AUDIO_BUFFER_SIZE 128` as an auto-managed environment constant in `packages/editor/packages/runtime-audio-worklet/src/runtimeDirectives.ts`.

That matches the current browser render quantum, but it bakes a host runtime property into compile-time project memory layout. AudioWorklet code can observe the real block size only once the processor is running, while 8f4e source uses `AUDIO_BUFFER_SIZE` in declarations such as `float[] buffer AUDIO_BUFFER_SIZE`, which must be resolved before compilation finishes.

This creates a brittle contract:

- the project assumes the browser render quantum is always 128
- the worklet implementation already uses `channel.length` at runtime, so the hardcoded constant is only partially true
- if browsers ever allow variable render quanta, the env constant and the actual worklet block length can diverge

## Proposed Solution

Stop treating AudioWorklet render-quantum size as a fixed compile-time constant owned by runtime directives.

The target design should separate:

- compile-time project constants such as `SAMPLE_RATE`
- runtime-observed host values such as actual AudioWorklet block length

Likely directions to evaluate:

1. Create the audio runtime first, read the first actual render quantum from the processor, and only then compile/runtime-init any code that depends on audio buffer sizing.
2. Replace source-level `AUDIO_BUFFER_SIZE` array sizing with runtime-owned audio I/O buffers so user code does not allocate host-quantum-sized arrays directly.
3. Keep a compatibility fallback for current projects, but make the fallback explicitly transitional rather than the core contract.

## Anti-Patterns

- Do not add another hardcoded constant in a different file and call it dynamic.
- Do not assume `AudioContext` exposes the render quantum directly; the observable source is the worklet processing arrays.
- Do not silently keep compile-time memory layout dependent on a value that is only knowable after worklet startup.

## Implementation Plan

### Step 1: Audit current ownership
- Trace every use of `AUDIO_BUFFER_SIZE` across runtime env-constant generation, examples, compiler snapshots, and AudioWorklet buffer-routing code.
- Separate cases that truly need a compile-time size from cases that only need per-block iteration length.

### Step 2: Choose the runtime contract
- Decide whether AudioWorklet projects should:
  - compile after runtime handshake, or
  - use runtime-managed audio buffers instead of env-sized arrays.
- Document the chosen contract in runtime docs before changing examples.

### Step 3: Implement the transition
- Remove or demote the hardcoded AudioWorklet `AUDIO_BUFFER_SIZE` env constant.
- Update runtime initialization to surface the actual observed quantum from the worklet.
- Migrate affected examples, tests, and snapshot fixtures to the new contract.

## Validation Checkpoints

- `rg -n "AUDIO_BUFFER_SIZE|Float32Array\\(128\\)|channel.length" packages/editor/packages/runtime-audio-worklet packages/examples`
- `npx nx run runtime-audio-worklet:test`
- `npx nx run-many --target=test --all`

## Success Criteria

- [ ] The AudioWorklet runtime no longer treats render-quantum size as a permanently hardcoded compile-time env constant.
- [ ] Runtime code reads actual per-block lengths from the worklet processing path.
- [ ] Examples and snapshots no longer rely on a hidden assumption that AudioWorklet block size is always 128.
- [ ] The chosen contract is documented clearly enough that future runtime changes do not reintroduce compile-time coupling.

## Affected Components

- `packages/editor/packages/runtime-audio-worklet/src/runtimeDirectives.ts` - current hardcoded env constant injection
- `packages/editor/packages/runtime-audio-worklet/src/index.ts` - runtime-observed block-length handling inside `process()`
- `packages/examples/src/projects/audio/` - examples that size buffers from `AUDIO_BUFFER_SIZE`
- `packages/cli/tests/` and tokenizer/compiler example snapshots - fixtures that encode the current env constant behavior

## Risks & Considerations

- **Compiler/runtime coupling**: changing this may require a new initialization order between compile output and runtime startup.
- **Compatibility risk**: many example projects currently assume `AUDIO_BUFFER_SIZE` is available and fixed.
- **User model**: the replacement must stay understandable from within 8f4e source, not just host-side TypeScript.
- **Testing impact**: snapshot tests will change once the contract stops emitting a fixed `128` constant.

## Related Items

- **Related**: `054` Benchmark Unrolled vs Normal Loop in Audio Buffer Filler
- **Related**: `305` Reuse WASM instance across incremental compiles

## References

- [MDN: AudioWorkletProcessor.process()](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process)
- [MDN: Using AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)

## Progress Notes

- 2026-05-29: Buffer execution was moved out of compiler-generated code and into user-authored `function buffer` exports for AudioWorklet examples. The AudioWorklet runtime now also reports the observed `audioBufferSize` and tolerates projects without a `buffer` export by using a no-op placeholder.
- This TODO remains open because `packages/editor/packages/runtime-audio-worklet/src/runtimeDirectives.ts` still injects `const AUDIO_BUFFER_SIZE 128`, and examples still size audio buffers from `AUDIO_BUFFER_SIZE`.
