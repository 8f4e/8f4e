---
title: 'TODO: Split StackItem into value and address variants'
priority: Medium
effort: 1-2d
created: 2026-05-26
issue: https://github.com/8f4e/8f4e/issues/713
status: Cancelled
completed: 2026-09-07
---

# TODO: Split StackItem into value and address variants

## Problem Description

`StackItem` in `packages/compiler/packages/language-spec/src/semantic.ts` currently represents every stack value with one broad interface:

- numeric value type facts (`isInteger`, `isFloat64`)
- optional address metadata (`address`)
- optional pointee metadata (`pointeeBaseType`, `isPointingToPointer`, pointee memory fields)
- optional numeric facts (`isNonZero`, `knownValue`)

That makes the compiler rely on optional chaining in places where a previous phase already knows what kind of stack item it has. For example, memory access code repeatedly falls back with `address.address?.memoryIndex ?? 0` even though memory operations should consume an address-shaped stack item after stack analysis.

The current shape also blurs two separate semantic states:

- an ordinary value on the stack
- a value known to be an address, optionally carrying pointee metadata for dereference behavior

The runtime representation can still be an integer in WebAssembly. The refactor is about compiler type safety and narrowing, not changing the emitted value representation.

## Proposed Solution

Replace the broad `StackItem` interface with a discriminated union:

```ts
export type StackItem = StackValue | StackAddress;

export interface StackValue {
	kind: 'value';
	valueType: 'int' | 'float' | 'float64';
	isNonZero?: boolean;
	knownValue?: number;
}

export interface StackAddress {
	kind: 'address';
	valueType: 'int';
	address: AddressMetadata;
	pointsTo?: PointeeMetadata;
	isNonZero?: boolean;
	knownValue?: number;
}
```

`pointsTo` should replace the current loose pointee fields on stack items. Suggested shape:

```ts
export interface PointeeMetadata {
	baseType: DataStructure['pointeeBaseType'];
	memoryIndex: number;
	memoryRegionName?: string;
	isPointer: boolean;
}
```

The key rule: use `kind: 'address'` when the compiler knows the stack value is an address. Use `kind: 'value'` for ordinary numeric values. Do not create a separate `pointer` stack kind; pointer-ness is address metadata.

## Anti-Patterns

- Do not keep `isInteger` / `isFloat64` as the primary discriminant.
- Do not add `kind` while leaving all old optional fields active indefinitely.
- Do not create separate `address` and `pointer` top-level stack kinds; pointers are addresses with `pointsTo` metadata.
- Do not preserve compatibility aliases for old stack item fields. This project is not released yet.
- Do not paper over narrowing with `as StackAddress` at memory codegen sites. Prefer validator/narrowing helpers that prove the shape.

## Implementation Plan

### Step 1: Introduce the discriminated stack types

- Update `packages/compiler/packages/language-spec/src/semantic.ts`.
- Add `StackValue`, `StackAddress`, and `PointeeMetadata`.
- Change `StackItem` to the union.
- Add small constructors/narrowing helpers if they reduce repeated object literals.

### Step 2: Convert stack item producers

- Update stack analysis helpers in `packages/compiler/src/stackAnalysis/analyzeInstruction.ts`.
- Update push-related helpers in `packages/compiler/src/instructionCompilers/push/` and `packages/compiler/src/utils/pushValueKind.ts`.
- Ensure address-producing literals and memory references create `StackAddress`.
- Ensure arithmetic, constants, function returns, and locals without address metadata create `StackValue`.

### Step 3: Convert memory consumers

- Update load/store/storeBytes/memoryCopy/clamp codegen paths to require narrowed `StackAddress` operands.
- Replace optional chains such as `address.address?.memoryIndex ?? 0` with direct `address.address.memoryIndex` after narrowing.
- Add an explicit compiler error path if an impossible non-address value reaches memory codegen.

### Step 4: Convert pointer metadata

- Move stack-item pointee fields into `StackAddress.pointsTo`.
- Update dereference helpers in `packages/compiler/src/utils/memoryData.ts` and `packages/compiler/src/utils/functionValueType.ts`.
- Keep memory declaration metadata on `DataStructure`; only stack-carried metadata should move.

### Step 5: Remove legacy fields and casts

- Remove old stack fields from `StackItem` producers and consumers.
- Search for old field names and optional-chain fallbacks.
- Update tests and fixtures directly.

## Validation Checkpoints

- `rg -n "isInteger|isFloat64|pointeeBaseType|isPointingToPointer|address\\?\\.|pointeeMemoryIndex|pointeeMemoryRegionName" packages/compiler/packages/language-spec/src/semantic.ts packages/compiler/src -g '*.ts'`
- `npx nx run @8f4e/language-spec:typecheck`
- `npx nx run compiler:typecheck`
- `npx nx run compiler:test`
- `npx nx run @8f4e/editor-state:typecheck`

## Success Criteria

- [ ] `StackItem` is a discriminated union with `kind: 'value' | 'address'`.
- [ ] Address metadata is required on `StackAddress`.
- [ ] Ordinary values no longer expose address or pointee fields.
- [ ] Pointer/dereference metadata is represented as `StackAddress.pointsTo`.
- [ ] Memory codegen uses direct address metadata after narrowing instead of optional-chain defaults.
- [ ] Old compatibility fields and aliases are removed.
- [ ] Compiler and editor-state typechecks pass.

## Affected Components

- `packages/compiler/packages/language-spec/src/semantic.ts` - stack item public contracts.
- `packages/compiler/src/stackAnalysis/analyzeInstruction.ts` - stack item production and narrowing.
- `packages/compiler/src/instructionCompilers/` - codegen consumers of analyzed stack operands.
- `packages/compiler/src/utils/memoryData.ts` - pointer and dereference metadata helpers.
- `packages/compiler/src/utils/functionValueType.ts` - function parameter/return stack metadata.
- `packages/editor/packages/editor-core/packages/editor-state/` - any tooltip or analysis display code that reads stack item facts.

## Risks & Considerations

- **Broad type fallout**: `StackItem` is shared across language-spec, compiler, and editor-state. Expect many compile errors during the migration.
- **Runtime semantics should not change**: Addresses remain integer values in emitted WebAssembly. The stricter types should only change compiler metadata and narrowing.
- **Stack analysis is the boundary**: Prefer fixing stack analysis to produce precise items over adding defensive codegen fallbacks.
- **No compatibility layer**: The project is not released yet, so update consumers directly instead of keeping old optional fields.

## Related Items

- **Related**: `docs/todos/404-refactor-address-metadata-into-first-class-shape.md`
- **Related**: `docs/todos/412-expose-compiler-stack-analysis-results.md`
- **Related**: `docs/todos/424-rename-layout-words-to-allocation-units.md`

## Notes

- This came from reviewing compiler helpers that defaulted through optional address metadata. The desired end state is that a memory operation consumes a statically narrowed `StackAddress`, making those defaults unnecessary.
