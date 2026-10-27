---
title: 'TODO: Tighten runtime browser API typing'
priority: Medium
effort: 2-4h
created: 2026-05-18
issue: https://github.com/8f4e/8f4e/issues/656
status: Completed
completed: 2026-10-26
---

# TODO: Tighten runtime browser API typing

## Problem Description

The browser runtime packages cross several platform-specific API boundaries, especially Web Audio, AudioWorklet, MediaStream, Worker, and WebAssembly runtime messaging. Some of these boundaries currently rely on broad `any` casts and `@ts-expect-error` comments because the package TypeScript environments do not expose every browser type in every build context.

Examples:
- `packages/editor/packages/runtime-audio-worklet/src/runtimeDef.ts` stores `AudioContext`, `AudioWorkletNode`, `MediaStream`, and `MediaStreamAudioSourceNode` values as `any`.
- `packages/editor/packages/runtime-audio-worklet/src/runtimeDef.ts` suppresses type errors around `AudioContext`, `AudioWorkletNode`, and `navigator.mediaDevices`.
- runtime message handlers accept loosely typed payloads and narrow them ad hoc.

This is understandable at browser/worker/worklet boundaries, but it weakens the signal from TypeScript in code that controls live runtime startup, teardown, microphone access, and runtime-value propagation.

## Proposed Solution

Create narrow runtime-local types for the browser APIs and messages that each package actually uses. Prefer explicit injected platform interfaces and typed message unions over broad `any` escapes.

High-level approach:
- Define small interfaces for the subset of `AudioContext`, `AudioWorkletNode`, `MediaStream`, and related APIs used by the runtime.
- Type runtime message payloads with discriminated unions for `initialized`, `runtimeValues`, `stats`, `compilationError`, and `init`.
- Replace `any` fields with those narrow interfaces.
- Replace `@ts-expect-error` browser global access with a typed platform adapter or a single well-contained runtime capability lookup.
- Keep runtime package tsconfig boundaries intact; do not pull DOM-only globals into worklet build targets unless that is explicitly safe.

## Anti-Patterns

- Do not silence the issue by replacing `any` with `unknown` and immediately casting back at every use site.
- Do not add broad DOM libs to every runtime tsconfig if that makes worker/worklet code appear to support APIs it cannot actually use.
- Do not change runtime behavior while tightening types unless a real bug is discovered.

## Implementation Plan

### Step 1: Inventory Type Escapes
- Search runtime packages for `any`, `@ts-expect-error`, and loosely typed message handlers.
- Classify each escape as a platform API boundary, runtime protocol boundary, or test-only fixture.

### Step 2: Add Narrow Platform Types
- Add local interfaces for the browser APIs used by `runtime-audio-worklet`.
- Use explicit constructor/capability injection where globals are currently assumed.
- Keep the interfaces minimal so they describe real usage rather than the whole DOM API.

### Step 3: Type Runtime Messages
- Add discriminated unions for host-to-runtime and runtime-to-host messages.
- Use narrow helper functions for message handling where browser event types are too broad.

### Step 4: Remove Suppressions
- Replace production `any` fields and `@ts-expect-error` comments with the new types.
- Keep justified test fixture casts where they are only constructing partial mocks.

## Validation Checkpoints

- `npx nx run @8f4e/runtime-audio-worklet:typecheck`
- `npx nx run @8f4e/runtime-audio-worklet:test`
- `npx nx run @8f4e/runtime-web-worker:typecheck`
- `npx nx run @8f4e/runtime-web-worker:test`
- `npx nx run-many --target=typecheck --all`

## Success Criteria

- [ ] Production runtime code no longer uses `any` for Web Audio or runtime message payloads.
- [ ] Production runtime code no longer needs `@ts-expect-error` for browser globals.
- [ ] Runtime behavior remains unchanged and existing tests pass.
- [ ] Any unavoidable platform casts are isolated behind named adapters with comments explaining the browser/runtime boundary.

## Affected Components

- `packages/editor/packages/runtime-audio-worklet` - Primary cleanup target for Web Audio and microphone API typing.
- `packages/editor/packages/runtime-web-worker` - Runtime message protocol typing and worker payload validation.
- `packages/editor` - May need small adjustments if runtime factory injection types become stricter.

## Risks & Considerations

- **Type environment drift**: Worklet and worker builds should not accidentally gain access to browser APIs they cannot use.
- **Over-modeling**: Full DOM type redefinitions would add noise. Keep interfaces narrow.
- **Behavior changes**: This TODO is about type safety first; behavior changes should be split out unless directly required.

## Related Items

- **Related**: `docs/todos/380-remove-hardcoded-audio-buffer-size-from-audioworklet-runtime.md`
- **Related**: `packages/editor/packages/runtime-audio-worklet/src/runtimeDef.ts`
- **Related**: `packages/editor/packages/runtime-web-worker/src/runtimeDef.ts`

## Notes

This TODO came from a hiring-screen style review of the repository. The concern was not that browser API casts are inherently wrong, but that production runtime boundaries should make unsafe assumptions visible and localized.

## Archive Instructions

When this TODO is completed:
1. Update the front matter to set `status: Completed` and provide the `completed` date
2. Move it to the `todo/archived/` folder to keep the main todo directory clean and organized
3. Update the `todo/_index.md` file to:
   - Move the TODO from the "Active TODOs" section to the "Completed TODOs" section
   - Add the completion date to the TODO entry (use `date +%Y-%m-%d` command if current date is not provided in the context)
