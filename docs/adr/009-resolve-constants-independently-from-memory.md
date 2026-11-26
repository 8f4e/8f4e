# ADR-009: Resolve Constants Independently From Memory

**Date**: 2026-10-14

**Status**: Accepted

## Context

Allowing `const` declarations to resolve memory addresses or metadata creates a dependency cycle between constant
resolution and memory planning. Constants need memory declarations and layout to exist, while memory declarations
can use constants for sizes and defaults.

Examples of memory-dependent constant values include `sizeof(buffer)`, `count(buffer)`, and `&buffer`. Supporting
these forms in the constant resolver couples otherwise simple compile-time values to allocation order, element
metadata, and pointer provenance.

The compiler needs a clear boundary between resolving constants and resolving expressions that depend on memory.

## Decision

Resolve constants in a dedicated, memory-independent compiler phase **before memory planning**.

The constant resolver accepts:

- numeric literals;
- already-resolved constants, including constants imported through supported namespace mechanisms;
- supported single-operator compile-time expressions whose operands are numeric literals or resolved constants.

The resolver receives no memory namespace, memory layout, addresses, element metadata, or pointer provenance. It
does not interpret memory-dependent forms, including:

- local, intermodule, and module start/end addresses;
- memory metadata queries such as `sizeof(...)`, `count(...)`, `min(...)`, and `max(...)`;
- equivalent queries through pointers or across modules.

These forms fail in `const` declarations through the normal unresolved constant-value path. Do not introduce a
special deny-list or separate validation branches for each memory form. The tokenizer can classify their syntax,
but the constant resolver has no machinery to evaluate them.

Memory-aware resolution belongs to later compiler stages. Supported memory expressions outside `const`, such as
`push sizeof(buffer)` and memory-dependent declaration defaults, remain available through those stages.

For example, code that previously cached memory metadata in a constant:

```8f4e
const SIZE sizeof(buffer)
push SIZE
```

must instead query it at its use site:

```8f4e
push sizeof(buffer)
```

This decision concerns constant resolution only. It does not change module execution order, pointer wiring, or the
general memory layout policy.

## Consequences

### Positive

- **Clear phase ordering**: Memory planning consumes resolved constants, without constants depending on memory.
- **Smaller resolver contract**: Constant resolution depends only on source constants and their namespaces.
- **Centralized ownership**: Later memory-aware stages own address and metadata resolution.
- **Consistent failures**: Unsupported constant values use the normal resolution error rather than feature-specific
  rejection rules.

### Negative

- **Language compatibility changes**: Existing memory-dependent `const` declarations must be rewritten.
- **Some expressions are repeated**: Programs can no longer use `const` to name a memory address or metadata query;
  they must use those expressions where the value is needed.
- **Boundary discipline is required**: New compile-time features must preserve the separation between constant-only
  and memory-aware resolution.

## Alternatives Considered

### 1. Resolve Constants and Memory Together

Rejected because it retains the dependency cycle and requires repeated coordination between constant resolution
and memory planning.

### 2. Keep a Memory-Aware Resolver With a Deny-List for Constants

Rejected because it leaves constant resolution coupled to memory capabilities and requires new rejection rules
whenever another memory-dependent form is added.

## Implementation

The decision was implemented on 2026-06-15 in commit `6c77b8fb8335ff6add01c2e4c617dcd9f3edd43c`,
`fix(compiler)!: decouple constants from memory layout`. This ADR records the existing architecture.

The current implementation is reflected in:

- [Constant resolver](../../compiler/packages/sub-program/packages/constant-resolver/src/index.ts), which
  evaluates literals and constant operands and reports unresolved constant values;
- [Compiler orchestration](../../compiler/packages/sub-program/src/compileSubProgram.ts), which resolves
  constants before planning memory;
- [Resolver tests](../../compiler/packages/sub-program/packages/constant-resolver/src/index.test.ts), which
  cover rejection of memory-dependent constants and preservation of memory operands for later stages.

## Related Documents

- [Original brainstorming note: Decouple Constants From Memory](../brainstorming_notes/archived/049-decouple-constants-from-memory.md)
- [Compiler Design](../../compiler/docs/compiler-design.md)
