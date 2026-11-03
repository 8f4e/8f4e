---
title: 'TODO: Consolidate syntax-related logic into syntax-rules package'
priority: Medium
effort: 2-3 days
created: 2025-12-25
status: Superseded
completed: 2025-12-25
superseded_by: 152-compiler-subpath-syntax-exports.md
---

# TODO: Consolidate syntax-related logic into syntax-rules package

**Note:** This TODO has been superseded by TODO 152. The syntax helpers are now integrated directly into the `@8f4e/compiler` package and exposed via the `@8f4e/compiler/syntax` subpath export. The standalone `@8f4e/syntax-rules` package has been removed.

## Problem Description

Currently, syntax-related validation and parsing logic is scattered across multiple packages:
- The `@8f4e/compiler` package contains syntax validation logic that is tightly coupled to compilation
- The `@8f4e/editor-state` package contains syntax parsing logic that is used for editor features
- The newly created `@8f4e/syntax-rules` package currently only contains the `isConstantName` utility

This creates several issues:
- The editor is indirectly coupled to the compiler through shared syntax logic
- Syntax validation rules cannot be easily reused across packages
- Makes it harder to swap out the compiler in the future
- Duplicated or inconsistent syntax handling across packages

## Proposed Solution

Move all syntax-related logic from the compiler and editor packages into the `@8f4e/syntax-rules` package. This includes:
- Variable naming validation rules
- Instruction parsing utilities
- Syntax token recognition
- Identifier validation functions
- Keyword validation
- Any other syntax-related validation or parsing logic

Both the compiler and editor packages should then depend on and import from `@8f4e/syntax-rules` for all syntax-related operations.

## Implementation Plan

### Step 1: Audit existing syntax logic
- Review `@8f4e/compiler` package for syntax validation functions
- Review `@8f4e/editor-state` package for syntax parsing/validation functions
- Document all syntax-related functions and their dependencies
- Identify shared vs package-specific logic

### Step 2: Design syntax-rules API
- Design the public API for the syntax-rules package
- Determine which functions should be exported
- Plan the internal structure (separate files for different concerns)
- Define TypeScript interfaces/types for syntax rules

### Step 3: Move syntax logic incrementally
- Move syntax validation functions from compiler to syntax-rules
- Move syntax parsing functions from editor-state to syntax-rules
- Update imports in compiler and editor-state packages
- Ensure all moved functions have proper tests

### Step 4: Update package dependencies
- Add syntax-rules as a dependency to packages that need it
- Remove duplicate/redundant syntax logic
- Update import statements across all affected packages

### Step 5: Verify and test
- Run all tests for affected packages
- Verify no regression in functionality
- Update documentation to reflect the new architecture
- Perform integration testing

## Success Criteria

- [x] All syntax-related logic is consolidated in `@8f4e/syntax-rules` package
- [x] Compiler package imports syntax logic from syntax-rules (no duplication)
- [x] Editor-state package imports syntax logic from syntax-rules (no duplication)
- [x] All existing tests pass
- [x] Package dependency graph shows proper separation of concerns
- [x] Documentation is updated to reflect the new architecture

## Affected Components

- `@8f4e/syntax-rules` - Will contain all syntax logic
- `@8f4e/compiler` - Will remove syntax logic, import from syntax-rules
- `@8f4e/editor-state` - Will remove syntax logic, import from syntax-rules
- Package dependency graph - New dependency relationships

## Risks & Considerations

- **Risk 1**: Breaking changes if syntax logic API changes
  - Mitigation: Carefully design the API before moving code
  - Mitigation: Use incremental approach to minimize disruption
  
- **Risk 2**: Circular dependencies between packages
  - Mitigation: Ensure syntax-rules has no dependencies on compiler or editor
  - Mitigation: Review dependency graph before and after changes

- **Dependencies**: The `isConstantName` utility has already been moved (completed)
- **Breaking Changes**: Internal refactoring should not affect public APIs

## Related Items

- **Completed**: Initial creation of syntax-rules package with `isConstantName` utility (PR #197)
- **Depends on**: None
- **Related**: Editor/compiler decoupling efforts

## References

- [PR #197](https://github.com/8f4e/8f4e/pull/197) - Initial syntax-rules package creation
- Current `@8f4e/syntax-rules` package structure
- Compiler package structure
- Editor-state package structure

## Notes

- The `isConstantName` utility has already been successfully moved to syntax-rules as a proof of concept
- This TODO was created as a follow-up to PR #197 to track the larger refactoring effort
- Consider creating a syntax grammar definition that can be shared across all packages
- May want to include lexer/parser utilities in syntax-rules for consistency

## Completion Summary

**Completed on 2025-12-25**

Successfully consolidated all syntax-related logic into the `@8f4e/syntax-rules` package:

### Functions Moved from Compiler:
- `instructionParser` - Regex for parsing instruction lines
- `parseArgument` - Parse arguments (literals vs identifiers)
- `isComment` - Check if a line is a comment
- `isValidInstruction` - Validate instruction syntax
- `ArgumentType`, `Argument`, `ArgumentLiteral`, `ArgumentIdentifier` types

### Functions Moved from Editor-State:
- `getBlockType` - Detect block type (module/config/function/unknown)
- `getModuleId` - Extract module identifier
- `getFunctionId` - Extract function identifier
- `CodeBlockType` type

### Changes Made:
- Created comprehensive test suite for all moved functions (70 tests)
- Maintained backward compatibility through re-exports in compiler and editor-state
- Updated all imports to use @8f4e/syntax-rules
- All tests passing (compiler: 289 tests, editor-state: 419 tests, syntax-rules: 70 tests)
- Added README.md documentation for the package

### Benefits Achieved:
- Eliminated code duplication between packages
- Proper separation of concerns (syntax rules independent of compilation and editing)
- Editor is no longer indirectly coupled to compiler through syntax logic
- Easier to maintain and extend syntax rules in the future
- Foundation for potential future compiler swapping

## Archive Instructions

When this TODO is completed:
1. Update the front matter to set `status: Completed` and provide the `completed` date
2. Move it to the `todo/archived/` folder to keep the main todo directory clean and organized
3. Update the `todo/_index.md` file to:
   - Move the TODO from the "Active TODOs" section to the "Completed TODOs" section
   - Add the completion date to the TODO entry
