---
title: 'TODO: Add WASM memory to GLSL float uniform bindings via project config'
priority: Medium
effort: 2-4d
created: 2026-02-08
issue: https://github.com/8f4e/8f4e/issues/550
status: Completed
completed: 2026-06-14
---

# TODO: Add WASM memory to GLSL float uniform bindings via project config

## Problem Description

Post-process and background shader effects currently support engine-owned shared uniform buffers, but there is no declarative way to bind shader uniforms to values in WebAssembly memory through stack config.

This blocks a key workflow: driving GLSL effects from live program state without manual JS glue code. The current path also makes projects harder to share because memory-to-shader wiring is not encoded in config.

## Proposed Solution

Add a project-config section that declares float uniform bindings for post-process and background effects. Each binding maps a GLSL uniform name to a `memoryId`, and `memoryId` encodes both source address and span (uniform size).

Float-only scope for this TODO:
- Bind float, vec2, vec3, vec4 from WASM memory.
- No int uniforms in v1.
- No transform options (`scale`, `bias`) in v1.

Suggested config shape:
- `shaderUniformBindings.postprocess.<uniformName>.memoryId`
- `shaderUniformBindings.background.<uniformName>.memoryId`

Suggested `memoryId` formats:
- `module.value` (scalar, size 1)
- `module.buffer[12]` (scalar at index 12, size 1)
- `module.buffer[12:4]` (span of 4 floats starting at index 12)

## Anti-Patterns (Optional)

- Adding int uniform support in the same change (separate follow-up TODO).
- Storing explicit `size` next to `memoryId` when size can be parsed from `memoryId`.
- Allowing unresolved/invalid `memoryId` bindings to silently fail without surfaced config/shader errors.

## Implementation Plan

### Step 1: Extend project config schema and types
- Add `shaderUniformBindings` to project config defaults/types/schema.
- Keep schema strict (`additionalProperties: false`) at object levels where practical.
- Validate binding object shape as `{ memoryId: string }`.

### Step 2: Add memoryId span parsing and resolution
- Extend/introduce resolver logic in editor-state to parse:
  - `module.memory`
  - `module.memory[index]`
  - `module.memory[index:size]`
- Resolve to memory metadata plus effective word-aligned start and span size.
- Enforce float-compatible sources for v1 and produce actionable errors for invalid bindings.

### Step 3: Bridge resolved bindings into glugglugglug effect uniforms
- Build uniform mapping objects for active postprocess/background effects from parsed bindings.
- Mirror WASM memory float values into the engine shared buffers each frame (or on render tick) before effect draw.
- Validate uniform arity (float/vec2/vec3/vec4) against parsed span size.

### Step 4: Testing and examples
- Add schema/config compilation tests for valid and invalid binding shapes.
- Add resolver tests for `memoryId` parsing edge cases.
- Add integration tests around effect binding application and fallback behavior.
- Add/update an example project showing config-driven memory-to-shader binding.

## Success Criteria

- [x] `config project` supports `shaderUniformBindings` for `postprocess` and `background`.
- [x] `memoryId` parsing supports scalar/index/span formats and resolves stable word addresses and sizes.
- [x] Float uniform bindings update shader uniforms from WASM memory during rendering.
- [x] Invalid bindings surface clear config/shader errors without breaking the render loop.
- [x] Tests cover schema validation, parser/resolver behavior, and render integration.

## Affected Components

- `packages/editor/packages/editor-state/src/features/project-config/schema.ts` - project config schema extension
- `packages/editor/packages/editor-state/src/features/project-config/types.ts` - config type additions
- `packages/editor/packages/editor-state/src/features/project-config/defaults.ts` - defaults for new config section
- `packages/editor/packages/editor-state/src/features/shader-effects/*` - derive/apply bindings into effect descriptors
- `packages/editor/packages/web-ui/src/index.ts` - hook binding updates into render lifecycle
- `packages/editor/packages/glugglugglug/src/types/postProcess.ts` - mapping compatibility checks (if needed)
- `packages/editor/packages/glugglugglug/src/postProcess/PostProcessManager.ts` - runtime uniform upload path
- `packages/editor/packages/glugglugglug/src/background/BackgroundEffectManager.ts` - runtime uniform upload path

## Risks & Considerations

- **Resolver ambiguity**: parsing `memoryId` spans must stay unambiguous and backward compatible with existing `module.memory` identifiers.
- **Memory growth**: WASM memory buffer identity can change; binding reads must use refreshed views.
- **Render safety**: malformed bindings should fail safely and keep passthrough/fallback rendering available.
- **Performance**: per-frame copying should remain small for float uniform use cases.

## Related Items

- **Related**: `docs/todos/archived/156-add-glsl-shader-code-blocks.md`
- **Related**: `docs/todos/archived/158-add-background-effects.md`
- **Related**: `docs/todos/archived/166-default-post-process-vertex-shader.md`
- **Related**: `docs/todos/archived/179-glugglugglug-shader-error-callback.md`
- **Related**: `docs/todos/archived/185-simplify-post-process-single-effect.md`
- **Related**: `docs/todos/archived/194-unsigned-int8-int16-buffers.md`

## Notes

- Keep v1 strictly float-only to minimize scope and unblock end-to-end config-driven wiring.
- If needed later, int uniforms can be added via a separate `kind`/typed binding extension.
