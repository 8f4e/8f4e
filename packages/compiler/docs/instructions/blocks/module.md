# Module Block

## module

The module instruction begins a module block with the provided name.

### Examples

```
module demo
moduleEnd
```

### Usage

Modules are the primary unit of code organization in 8f4e. Each module:

- Has a name scoped to its project or group; the last enabled definition with that name wins
- Can contain memory declarations, constants, and executable code
- Has its own namespace that can be imported by other modules using `use`

### Example Module

```
module oscillator
const FREQUENCY 440.0
float phase 0.0
float increment 0.0

; Calculate phase increment
push increment
push FREQUENCY
push SAMPLE_RATE
castToFloat
div
store

; Update phase
push phase
push phase
load
push increment
load
add
store
moduleEnd
```

## Module overrides

When multiple modules have the same name in one project or group, the last enabled definition replaces the entire earlier module. Earlier definitions contribute no executable code, memory, or constants. The selected module executes once at its own position, in its own entry.

```8f4e
8f4e/v1
entry main
module oscillator
float out 0.25
moduleEnd

module oscillator
float out 0.5
moduleEnd

module output
float* input &oscillator:out ; Points to the selected module's out (0.5).
moduleEnd
entryEnd
```

Selection follows declaration order across all entries in the same scope. The editor serializes blocks from left to right, then top to bottom, so moving a module to the right makes it take precedence. A disabled definition does not hide earlier enabled definitions.

All memory references and `use` imports resolve against the selected module. Declarations from earlier versions are not merged; references to memory or constants absent from the selected version are errors. Modules in different groups remain independent even when they share a name.

The editor preserves live memory across implementation switches when the program's module set and memory layout remain unchanged. Changed defaults are applied without resetting other values; changing only the generated code size does not reset memory.

Every enabled definition is syntax-checked. Only selected definitions proceed to semantic resolution and compilation.

## moduleEnd

The moduleEnd instruction ends a module block.

### Examples

```
module demo
moduleEnd
```

### Notes

- Every `module` instruction must have a corresponding `moduleEnd`
- Code outside of module blocks is not allowed (except config and constants blocks)
