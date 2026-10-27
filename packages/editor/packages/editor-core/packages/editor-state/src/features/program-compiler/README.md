# Program Compiler Feature

## Purpose

Compiles 8f4e code blocks into executable WASM bytecode. Coordinates with the compiler callback, manages compilation options, maps errors back to source blocks, and handles memory initialization.

## Key Behaviors

- **Code Flattening**: Converts code blocks into separate modules and functions arrays, sorted by `creationIndex`
- **Compiler Invocation**: Calls `compileCode` callback with source and options
- **Compilation Options**: Sets compiler entry-point options
- **Error Mapping**: Maps compilation errors back to specific code blocks and line numbers
- **Memory Management**: Tracks compiler-derived memory usage and handles memory recreation events
- **Performance Tracking**: Measures and logs compilation time
- **Auto Compilation**: Recompiles the project when its compiler input revision advances
- **Recompile Debounce**: Defaults to 500ms and can be configured with `; @config recompileDebounceDelay <ms>`

## Compiler Options

```typescript
{
  startingMemoryAllocationUnitAddress: 0,
  includeStackAnalysis: true,
  enableAssertions: hasTestEntry(project),
}
```

Assertions are enabled when the project contains an enabled `test` entry, including nested test modules or a root function exported as `test`. Existing editor instances provide inert assertion callbacks so compilation and normal execution continue to work; this does not execute tests or collect assertion results.

**Note**: The compiler derives the required memory size from its allocation plan and returns the effective page-rounded size. Environment constants are provided via an auto-managed `constants env` block, with runtime-owned lines contributed by the selected runtime.

## Block Type Handling

- **Modules**: Includes `module` and `constants` block types
- **Functions**: Includes `function` block types
- **Excluded**: `note` and `unknown` blocks are not passed to WASM compiler

## Subscriptions & Callbacks

### Compiler input revision

`state.compilerInputRevision` starts at zero and advances after source edits, block creation/deletion/paste,
execution or disabled-state toggles, regenerated environment constants, saved control defaults, memory connection
removal, and project loading (including undo/redo loads). Group operations and multi-block paste advance it once
after updating all affected blocks. It remains monotonic across project loads and is not stored in project files.

Selection, caret movement, block/project navigation, dragging, favorites, and visual grouping metadata do not
advance the revision. No-op edit operations leave it unchanged. Text edits conservatively advance it without
attempting to compare compiler output, so incomplete source and changes that affect diagnostics are covered.

Call `incrementCompilerInputRevision(store)` after updating compiler inputs and their derived state. The compiler
subscribes to this revision independently of the selected block or the target of a programmatic edit.

`selectedCodeBlockForProgrammaticEdit` is the shared target for refreshing a block and saving programmatic
updates, including drag-end position changes. Setting it does not schedule compilation; source-changing
operations also advance the compiler input revision.

### Subscriptions

- `compilerInputRevision` - Schedules debounced compilation when compiler inputs change

### Callbacks Used

- `state.callbacks.compileCode(modules, options, functions)` - Returns compilation result with bytecode and memory info

### State Touched

- `state.compiler.isCompiling` - Boolean flag during compilation
- `state.compiler.compiledModules` - Compiled module bytecode
- `state.compiler.compiledFunctions` - Compiled function bytecode
- `state.compiler.byteCodeSize` - Total bytecode size in bytes
- `state.compiler.requiredMemoryBytes` - Bytes required by the compiler's static memory plan
- `state.compiler.allocatedMemoryBytes` - Actual WebAssembly memory capacity allocated by the host
- `state.compiler.compilationTime` - Compilation duration in ms
- `state.compiler.lastCompilationStart` - Timestamp of compilation start
- `state.codeErrors.compilationErrors` - Array of compilation errors

## Integration Points

- **Memory Consumers**: Publishes memory plans used by plugins to resolve current memory targets
- **Runtime**: Runtime selection affects environment constants
- **Runtime**: Compiled modules are consumed by runtime implementations and editor widgets

## Error Handling

Compilation errors include:
- Block ID and line number
- Error message and type
- Mapped from compiler output to source blocks

## Memory Actions

The compiler reports memory state:
- **`recreated`**: WASM memory was newly created or resized
- **`reused`**: Existing memory was reused

The binary-assets plugin observes `state.compiler.memoryPlan` and reloads its retained bytes into current targets
when a new plan is published. The compiler feature stores no binary asset metadata.

## References

- Compiler callback contract: Defined in state types

## Notes & Limitations

- Compilation is synchronous from the effect's perspective but callback may be async
- Blocks are compiled in `creationIndex` order
- Memory capacity changes require runtime restart
- Environment constants are provided via auto-managed `constants env` block
