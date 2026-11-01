---
title: 'TODO: Add compiler peephole arithmetic strength reduction'
priority: Medium
effort: 1-2 days
created: 2026-05-12
issue: https://github.com/8f4e/8f4e/issues/654
status: Open
completed: null
---

# TODO: Add compiler peephole arithmetic strength reduction

## Problem Description

The compiler now has compile-time folding and stack-level integer metadata, but runtime arithmetic codegen still emits direct WebAssembly arithmetic operations even when the top stack operands prove a cheaper equivalent.

- Compile-time expressions such as `16*2`, `SIZE/2`, and `sizeof(samples)*4` are already folded during semantic normalization.
- `StackItem.knownValue` already tracks exact scalar values when the compiler can prove them.
- Integer arithmetic compilers preserve known values in stack metadata.
- The generated runtime bytecode is not reduced: `mul.ts` still emits `I32_MUL`, and `div.ts` still emits `I32_DIV_S`.

The remaining optimization work is to use existing metadata to rewrite emitted bytecode safely.

## Proposed Solution

Add a small codegen-level peephole optimization path for integer arithmetic.

- Track enough bytecode provenance on stack items to know whether a known constant came from compiler-emitted trailing `i32.const` bytecode.
- Add helper utilities that can remove or replace only proven-safe bytecode tails.
- Use those helpers in arithmetic instruction compilers for conservative integer-only rewrites.
- Leave `f32` and `f64` arithmetic unchanged unless a future benchmark and semantics review justify it.

## Anti-Patterns

- Do not add broad AST optimization for this first pass. By arithmetic codegen time, prior `push` instructions have already emitted bytecode.
- Do not treat `graphOptimizer.ts` as arithmetic optimization infrastructure; it sorts modules and constants by dependency.
- Do not optimize signed `x / 2^n` to `x >> n` without non-negative or unsigned proof metadata. `i32.div_s` truncates toward zero, while `i32.shr_s` rounds negative values differently.
- Do not remove bytecode for a runtime operand that may evaluate memory, locals, calls, or trapping behavior. Only remove compiler-emitted constants that are proven removable.

## Implementation Plan

### Step 1: Add bytecode provenance for stack constants
- Extend `StackItem` in `packages/compiler/packages/language-spec/src/semantic.ts` with narrow provenance metadata for compiler-emitted constants, such as `constantByteCodeLength` or a bytecode span.
- Set that metadata in `packages/compiler/src/instructionCompilers/push/handlers/pushLiteral.ts` for integer literals.
- Ensure locals, memory loads, calls, and non-folded arithmetic do not inherit removable-constant provenance accidentally.

### Step 2: Add peephole bytecode helpers
- Add a utility under `packages/compiler/src/utils/`, such as `peepholeByteCode.ts` or `arithmeticOptimization.ts`.
- Support removing the trailing bytecode for a proven top-stack constant.
- Support replacing that trailing bytecode with another `i32.const`.
- Support replacing two removable constant operands with one folded `i32.const`.

### Step 3: Implement low-risk integer rewrites
- `x * 1` -> `x`
- `x * 2^n` -> `x << n` for positive powers of two with `n` in `1..31`
- `x + 0` -> `x`
- `x - 0` -> `x`
- `x / 1` -> `x`
- Keep fallback bytecode unchanged when a pattern is not fully proven safe.

### Step 4: Add constant-result folding
- Fold removable literal-only runtime sequences to one `i32.const`.
- Cover `mul`, `add`, `sub`, `div`, and optionally `remainder`.
- Reuse existing overflow and division guard rules from known-value derivation.

### Step 5: Benchmark before broader rewrites
- Consider `drop; i32.const 0` rewrites for `x * 0` and `x & 0` only if measured runtime wins justify neutral or larger bytecode.
- Consider signed division by powers of two only after adding proof metadata for non-negative values or unsigned operands.

## Validation Checkpoints

- Run `npx nx run compiler:test -- mul.test.ts div.test.ts add.test.ts sub.test.ts remainder.test.ts`.
- Run `npx nx run compiler:typecheck`.
- Add bytecode-level tests that assert opcodes, not only runtime output.

## Success Criteria

- [ ] `push x; push 2; mul` emits `i32.const 1` plus `I32_SHL` instead of `i32.const 2` plus `I32_MUL`.
- [ ] `push x; push 4; mul` emits `i32.const 2` plus `I32_SHL`.
- [ ] `push x; push 1; mul` removes both the trailing constant and multiplication.
- [ ] `push x; push 0; add` removes both the trailing constant and addition.
- [ ] `push x; push 0; sub` removes both the trailing constant and subtraction.
- [ ] `push x; push 1; div` removes both the trailing constant and division.
- [ ] `push 2; push 4; mul` emits one `i32.const 8`.
- [ ] Signed division by powers of two remains unoptimized unless correctness proof metadata is added.
- [ ] Existing compiler tests continue to pass.

## Affected Components

- `packages/compiler/packages/language-spec/src/semantic.ts` - Stack item bytecode provenance metadata.
- `packages/compiler/src/instructionCompilers/push/handlers/pushLiteral.ts` - Mark removable integer constants.
- `packages/compiler/src/utils/knownIntegerValue.ts` - Reuse existing known-value helpers and guards.
- `packages/compiler/src/utils/compilation.ts` or a new utility file - Safe bytecode-tail rewrite helpers.
- `packages/compiler/src/instructionCompilers/mul.ts` - Identity, constant folding, and power-of-two shift replacement.
- `packages/compiler/src/instructionCompilers/div.ts` - Identity and safe constant folding only.
- `packages/compiler/src/instructionCompilers/add.ts` - Identity optimization and constant folding.
- `packages/compiler/src/instructionCompilers/sub.ts` - Identity optimization and constant folding.
- `packages/compiler/src/instructionCompilers/remainder.ts` - Optional constant folding.
- `packages/compiler/src/instructionCompilers/*.test.ts` and `packages/compiler/tests/instructions/` - Bytecode and behavior coverage.

## Risks & Considerations

- **Signed division correctness**: `i32.div_s` and arithmetic shifts differ for negative dividends. Keep division-by-power-of-two unoptimized until proof metadata exists.
- **Evaluation preservation**: Removing runtime operand bytecode can remove memory-load or call behavior. Only rewrite compiler-emitted constants that are proven safe to remove.
- **Bytecode-size tradeoffs**: Some rewrites, especially `drop; i32.const 0`, may reduce runtime cost but not bytecode size. Benchmark before adding them.
- **Breaking Changes**: None expected. Optimizations should be transparent except for smaller or different generated bytecode.

## Related Items

- **Supersedes remaining work from**: `docs/todos/archived/055-strength-reduction-compiler-optimization.md`
- **Related**: `packages/compiler/docs/compiler-design.md` documents semantic normalization as the owner of compile-time folding.
- **Related**: `packages/compiler/src/graphOptimizer.ts` sorts module dependencies, not arithmetic bytecode.
- **Related**: `docs/todos/384-add-compiler-algorithmic-regression-metrics.md`

## References

- [WASM instruction reference](https://webassembly.github.io/spec/core/appendix/index-instructions.html)
- [Compiler optimization techniques](https://en.wikipedia.org/wiki/Strength_reduction)

## Notes

- Start with multiplication by a top-of-stack positive power of two.
- Compiler flags are probably unnecessary for the initial conservative pass if tests assert stable bytecode.

## Archive Instructions

When this TODO is completed:
1. Update the front matter to set `status: Completed` and provide the `completed` date
2. Move it to the `todo/archived/` folder to keep the main todo directory clean and organized
3. Update the `todo/_index.md` file to move the TODO from active to completed
