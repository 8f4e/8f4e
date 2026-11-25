# ADR-008: Provide a Syntax-Only Compiler Entry Point for Tooling

**Date**: 2026-03-16

**Status**: Accepted

## Context

Not every consumer of the compiler package needs full semantic compilation or WebAssembly emission. Some consumers only need lightweight syntax services, such as parsing, token-shape validation, identifier helpers, or editor-oriented tooling support.

Using the full compiler package for these cases would:

1. Pull in more compiler functionality than necessary.
2. Tighten coupling between tooling use cases and semantic compilation internals.
3. Make it harder to reuse syntax logic in environments that only need lightweight validation.
4. Blur the architectural boundary between syntax services and full compilation.

The repository already exposes a distinct syntax surface from `compiler/src/syntax` and publishes it as a subpath export.

## Decision

We provide a **syntax-only compiler entry point** as a supported package boundary:

- Main API: `@8f4e/compiler`
- Syntax-only API: `@8f4e/compiler/syntax`

The syntax-only entry point is intended for consumers that need syntax parsing and validation helpers without depending on the full compiler pipeline.

The syntax surface is kept separate from semantic compilation logic so that tooling and editor integrations can depend on a smaller, phase-appropriate API.

## Consequences

### Positive

1. **Cleaner package boundaries**: Tooling consumers can depend on syntax helpers without importing semantic compilation APIs.
2. **Supports lightweight integrations**: Editor and validation workflows can use syntax logic directly.
3. **Reinforces compiler phase separation**: Syntax code remains an explicit subsystem rather than an internal convenience layer.
4. **Improves maintainability**: Syntax helpers can evolve with a clearer contract for non-compiler consumers.

### Negative

1. **Public API surface expands**: The syntax subpath becomes a maintained contract.
2. **Boundary discipline is required**: Syntax exports should not gradually absorb semantic dependencies.
3. **Documentation burden increases**: Contributors need to understand when to use the syntax API instead of the main compiler API.

## Alternatives Considered

### 1. Expose Syntax Helpers Only as Internal Files

Rejected because it would encourage deep imports, weaken API stability, and make tooling integration more fragile.

### 2. Put Syntax and Semantic APIs Behind a Single Entry Point

Rejected because it obscures the distinction between lightweight syntax consumers and full compiler consumers.

### 3. Duplicate Syntax Helpers in Tooling Packages

Rejected because it would create divergence and duplicate parser-related logic across the repo.

## Related Decisions

- [ADR-005: Separate Syntax and Semantic Compiler Errors](005-separate-syntax-and-semantic-compiler-errors.md)
