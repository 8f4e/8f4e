# Per-Module Memory Reservations for Live Coding

## Overview

This document captures brainstorming and planning notes for introducing per-module memory reservations (headroom) in the compiler to support live coding / algorave scenarios without interrupting generative audio playback.

## Current Memory Model

- All modules compile into a single linear WebAssembly memory arena (`Int32Array` / `Float32Array` over `WebAssembly.Memory`).
- Memory addresses are assigned in a strict global order:
  - First by module order (topologically sorted via `sortModules` in `compiler/src/index.ts`).
  - Then by declaration order within each module (`compiler/src/compiler.ts`).
- For each module, `compileModule`:
  - Receives a `startingByteAddress` (derived from a global `memoryAddress` word index).
  - Compiles all `memory` declarations into a `memoryMap` of `DataStructure` entries.
  - Each `DataStructure` includes:
    - `byteAddress` and `wordAlignedAddress` (index into the global arena).
    - `wordAlignedSize` (how many words the structure occupies).
- After compilation, `calculateWordAlignedSizeOfMemory` sums a module’s declared data structures to get its total `wordAlignedSize`.
- In `compileModules` (`compiler/src/index.ts`):
  - A global `memoryAddress` (in words) is maintained.
  - For each module:
    - `startingByteAddress = memoryAddress * GLOBAL_ALIGNMENT_BOUNDARY`.
    - The module is compiled, yielding `module.wordAlignedSize`.
    - `memoryAddress += module.wordAlignedSize`.
- Result:
  - Modules are tightly packed back-to-back; there are no gaps between modules.
  - The base address and contents of any module depend on the sizes of all preceding modules.
  - Adding or removing a memory declaration in an earlier module changes that module’s `wordAlignedSize`, shifts all later modules’ base addresses, and effectively requires rebuilding and reinitialising memory to stay consistent with the new layout.

## Live-Coding Pain Point

In live coding / algorave scenarios, performers edit code while audio is running. Today:

- Adding a new array or variable to any earlier module changes the global memory layout.
- The runtime must treat the program as structurally different and rebuild/reinitialise memory.
- This can glitch audio or reset generative state, breaking the musical flow.

We want a way for coders to make small, local changes (like adding a new variable) without forcing a global memory reset, as long as they stay within some pre-declared budget.

## Goal: Per-Module Memory Reservations (Headroom)

High-level objective:

- Give each module its own reserved headroom area in memory where it can freely grow and shrink (within a budget) without disturbing others.
- As long as a module’s total memory usage stays within its pre-allocated reservation:
  - Its own base address and size remain stable.
  - The base addresses of all following modules remain stable.
  - The runtime can reload code without resetting or shuffling the existing memory contents, preserving audio buffers and state.
- If a module exceeds its reserved headroom:
  - The system gracefully falls back to the current behaviour: modules are repacked and memory is reinitialised, which may cause an audible hiccup.
  - This “overflow” should be rare and intentional, not the default live-coding path.

## Planned Mechanism: `allocate` Instruction (Soft Reservation)

Introduce a new module-level instruction:

- Syntax (proposed):
  - `allocate N`
  - `N` is a number of **words** to reserve for this module.
- Semantics:
  - The compiler still computes the actual required size of each module (`actualWordSize`) by summing its declared data structures (current behaviour).
  - Each module may also specify a minimum reserved size (`reservedWordSize`) via `allocate N`.
  - The effective “slot size” for the module becomes:
    - `slotWordSize = max(actualWordSize, reservedWordSize)`.
  - The module’s `wordAlignedSize` (which drives global layout) is set to `slotWordSize`.
- Behaviour:
  - If `actualWordSize <= reservedWordSize`:
    - The module uses at most the reserved space.
    - Its slot size is fixed at `reservedWordSize`, regardless of small changes in declarations.
    - Later modules’ base addresses remain unchanged — the layout is stable and safe for live hot-swapping.
  - If `actualWordSize > reservedWordSize`:
    - The hint is exceeded; the module needs more space than its reserved headroom.
    - We set `slotWordSize = actualWordSize` (no error) and repack modules exactly as today.
    - The global layout may shift, and a full memory rebuild is acceptable in this “overflow” case.

### Compiler Integration

- `allocate` instruction:
  - Parsed like other instructions, recognised in `instructionCompilers`.
  - Emits no WASM code; it only records metadata, e.g. `context.namespace.minAllocatedWords`.
- `compileModule`:
  - After building `memoryMap` and computing `actualWordSize` via `calculateWordAlignedSizeOfMemory`:
    - Read `minAllocatedWords` from the namespace, defaulting to `0`.
    - Compute `slotWordSize = Math.max(actualWordSize, minAllocatedWords)`.
  - Set `module.wordAlignedSize = slotWordSize`.
  - Internal `DataStructure.byteAddress` / `wordAlignedAddress` remain contiguous within the module; the reserved slack is simply unused trailing space.
- `compileModules`:
  - Continues to use `module.wordAlignedSize` to advance the global `memoryAddress` as today.
  - With `allocate` in place, `wordAlignedSize` may be larger than strictly necessary, effectively creating per-module reserved headroom.
- `allocatedMemorySize`:
  - Still computed as “start of last module + its `wordAlignedSize`”, now including reserved slack.

## Runtime Behaviour and Live Coding

After each compile, we can compare:

- The previous `compiledModules` layout (per-module `byteAddress`, `wordAlignedAddress`, `wordAlignedSize`).
- The new layout produced with `allocate`.

If all modules’ base addresses and slot sizes are unchanged:

- The compile is **layout-compatible**.
- The runtime can:
  - Reuse the existing `WebAssembly.Memory` instance.
  - Swap out the code buffer and optionally re-run only necessary init code.
  - Preserve existing memory content, keeping audio buffers and state intact (no glitch).

If any module’s base address or `wordAlignedSize` changed:

- The compile is **layout-incompatible**.
- The runtime falls back to the current behaviour:
  - Rebuild and reinitialise memory.
  - A one-off audio hiccup is acceptable in this overflow case.

For performers:

- Use `allocate N` per module to reserve enough space for the variables/arrays you expect to add live.
- As long as you stay within that budget:
  - You can add/remove declarations without interrupting generative music playback.
- If you overflow the budget:
  - The compiler still works, but the change may cause a one-off glitch as memory is rebuilt — similar to the current behaviour.
