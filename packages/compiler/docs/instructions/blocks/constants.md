# Constants Block

## constants

The constants instruction begins a constants block with the provided namespace name. Constants blocks contain `const` declarations and `use` imports and must be defined at project or group scope (outside of modules and functions).

### Examples

```
constants math
const PI 3.14159
const TAU 6.28318
const FLAGS 0b1011001
const MASK 0xff
constantsEnd
```

### Usage

Constants blocks provide a way to organize related constants into named namespaces:
- Must be defined at project or group scope (not inside modules or functions)
- Can contain `const` declarations and `use` imports
- Blocks with the same name in one scope merge in declaration order
- Can be imported into modules using `use`

Constant values support the same literal forms as other numeric arguments, including:
- Decimal: `const VALUE 42`
- Binary: `const FLAGS 0b1011001`
- Hexadecimal: `const MASK 0xff`

### Example Constants Block

```
constants audioConstants
const SAMPLE_RATE 48000
const BUFFER_SIZE 128
const MAX_CHANNELS 2
constantsEnd

module audio
use audioConstants
; Now SAMPLE_RATE, BUFFER_SIZE, MAX_CHANNELS, and other constants from audioConstants are available
float samplePosition 0.0
moduleEnd
```

## constantsEnd

The constantsEnd instruction ends a constants block.

### Examples

```
constants physics
const GRAVITY 9.81
const SPEED_OF_LIGHT 299792458
constantsEnd
```

## Usage with Modules

Constants from a constants block can be imported into modules using the `use` instruction:

```
constants math
const PI 3.14159
const TAU 6.28318
constantsEnd

module circleCalc
use math
int radius 5
float circumference 0.0
push circumference
push radius
castToFloat
push TAU
mul
store
moduleEnd
```

## Last-Wins Semantics

Repeated constants blocks in the same project or group scope contribute to one namespace. Later declarations override matching names; constants they do not redefine remain available:

```8f4e
constants preset
const RATIO 1.0
const LEVEL 0.5
constantsEnd

constants preset
const RATIO 2.0
constantsEnd

module oscillator
use preset
float ratio RATIO ; 2.0
float level LEVEL ; 0.5
moduleEnd
```

The last block in source order takes precedence. The editor serializes blocks from left to right, then top to bottom, so moving a preset block to the right makes its matching values win. Disabled blocks do not contribute.

Imports receive the fully merged namespace regardless of where the importing block is declared. A later block can reference constants from earlier blocks of the same namespace without `use`. Expressions are evaluated at their declaration: redefining a constant does not change values previously derived from it.

Repeated `const` declarations within a block also use the latest value from that point onward. A constants block cannot share its namespace name with a module, an external namespace, or a name passed from its parent.

When multiple namespaces are used, constants with the same name also use last-applied wins semantics:

```
constants first
const VALUE 10
constantsEnd

constants second
const VALUE 20
constantsEnd

module example
use first
use second
; VALUE will be 20 (from second namespace)
moduleEnd
```

## Notes

- Constants blocks can be declared in projects and groups, but not inside modules, functions, or other constants blocks
- Constants blocks provide namespace isolation for constants
- Multiple constants blocks can be defined in a project
- Constants defined in modules can also be imported using `use`
