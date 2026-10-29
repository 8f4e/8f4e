# Declarations and locals

### const

The const instruction declares a constant value that can be referenced elsewhere in the program.

The right-hand side can also be a constant expression with exactly one operator:
- `CONST+number`
- `CONST-number`
- `CONST*number`
- `CONST/number`

Use `round(...)`, `floor(...)`, or `ceil(...)` to convert a literal, constant, or one-operator expression explicitly to
an integer. `round(...)` resolves halfway values away from zero.

Rules:
- Left-hand side must be an existing constant identifier.
- Right-hand side must be a numeric literal.
- Only one `+`, `-`, `*`, or `/` operator is allowed per expression.

#### Examples

```
const MAX 120
const HALF_MAX MAX/2
const DOUBLE_MAX MAX*2
const SCALED_SIZE round(MAX*1.5)
int output
push &output
push MAX
store
```

### int

The int instruction declares a 32-bit integer in module memory. Use `int*` or `int**` to declare pointer types.

Anonymous scalar declarations are supported in three forms:
- **Bare implicit zero**: `int` allocates an anonymous `int` with default `0`
- **Anonymous literal/value**: `int 42` allocates an anonymous `int` with default `42`
- **Anonymous constant-style identifier**: `int FOO` allocates an anonymous `int` with default equal to constant `FOO`, where `FOO` is a declared `const`
- **Anonymous string literal**: `int "e"` allocates an anonymous `int` with default equal to the byte value of `"e"` (`101`)

This bare zero-initialized form applies to scalar declarations only (including pointer variants such as `int*`). Array declarations (`int[]`) still require an element count.

Default values can be specified as literals, constants, or memory references (using `&name` for start address or `name&` for end address).
Constant expressions are also supported with the same one-operator rule (`CONST+number`, `CONST-number`, `CONST*number`, or `CONST/number`).
Quoted string literals are supported for scalar defaults and use the same byte encoding as `push "..."`.
Single-character strings become their byte value. Multi-character strings are packed as split bytes; for example, `int "AB"` is equivalent to `int 0x41 0x42`.

A default value may also be expressed as a split-byte sequence: two to four adjacent byte-resolving tokens combined into a single 32-bit integer.
Bytes are combined left-to-right as most-significant to least-significant.
Missing trailing bytes are padded with `0` on the right to fill the 32-bit width.

Split-byte tokens may be:
- Integer literals in any numeric form (decimal `32`, hexadecimal `0x20`, etc.) as long as each resolves to an integer in the range `0–255`.
- Literal-only `*` or `/` expressions such as `16*2` or `0x40/2`, as long as each folds to an integer in the range `0–255`.
- Constants that resolve at compile time to an integer in the range `0–255`.
- String literals. Their bytes are flattened into the surrounding split-byte sequence.
- Mixed sequences of byte literals and byte-valued constants are also accepted.

Non-byte-resolving forms are rejected in split-byte mode. Examples:
- `1/2` is rejected because it folds to a non-integer value.
- `16*20` is rejected because it folds to `320`, which is outside the byte range.

A single byte literal or a single byte-valued constant does **not** trigger split-byte mode; only two or more consecutive byte-resolving tokens are treated as a split-byte sequence.

#### Reserved identifier rule

Memory allocation identifiers must **not** match constant-style naming conventions (all-uppercase, no lowercase letters). Constant-style names like `HI`, `MY_VALUE`, or `THRESHOLD` are reserved for `const` declarations. Attempting to use them as memory names is a compiler error.

This rule applies consistently regardless of how many arguments follow:
- `int MY_VAR` → error: constant-style name not declared as a constant
- `int MY_VAR 0` → error: constant-style name used in split-byte position is not a declared constant

When a constant-style identifier appears as the first argument and is declared as a constant, it is treated as an anonymous allocation:
- `int HI` → anonymous allocation, default = constant `HI`
- `int HI LO` → anonymous split-byte allocation, default = `HI` and `LO` packed left-to-right

#### Examples

```
const MAX 8
const HI 0xA8
const LO 0xFF
int
int count 4
int halfCount MAX/2
int*
int* ptr &count
int* endPtr count&
int colorARGB 0xA8 0xFF 0x00 0x00
int colorAR   0xA8 0xFF
int 0xA8 0xFF
int colorDecimal 32 64
int colorExpr 16*2 0x40/2
int letter "e"
int word "AB"
int 32 64
int 32
int "e"
int "AB"
int colorFromConst HI LO
int HI LO
```

### int8*

The `int8*` / `int8**` and `int8u*` / `int8u**` instructions declare pointer types whose pointee is an 8-bit integer. The `int8u` variants use unsigned pointee semantics.

The pointer slot itself occupies 4 bytes (one word), identical to `int*` in allocation width. The pointee width is 1 byte.

Dereferencing with `push *name` emits a signed 8-bit load (`i32.load8_s`) for `int8*` and an unsigned 8-bit load (`i32.load8_u`) for `int8u*`.

Pointer-aware metadata reflects the 1-byte pointee type and tracked pointee count:
- `sizeof(*name)` returns `1` for `int8*` and `int8u*` (pointee element word size)
- `min(*name)` returns `-128` for `int8*` and `0` for `int8u*` (pointee minimum value)
- `max(*name)` returns `127` for `int8*` and `255` for `int8u*` (pointee maximum value)
- `count(*name)` returns the target element count when the pointer is initialized from a known memory start address, or `1` without tracked count metadata

#### Examples

```
int8[] samples 64 0
int8* ptr &samples
push *ptr        ; loads a signed 8-bit value, sign-extended to i32

int8u[] unsignedSamples 64 0
int8u* unsignedPtr &unsignedSamples
push *unsignedPtr ; loads an unsigned 8-bit value, zero-extended to i32

int8** pptr &ptr
push *pptr       ; pushes the address stored in ptr
push **pptr      ; loads a signed 8-bit value through the double pointer

push sizeof(*ptr) ; 1 — pointee element word size
push min(*ptr)    ; -128 — pointee minimum value
push count(*ptr)  ; 64 — tracked pointee element count
```

### int16*

The `int16*` / `int16**` and `int16u*` / `int16u**` instructions declare pointer types whose pointee is a 16-bit integer. The `int16u` variants use unsigned pointee semantics.

The pointer slot itself occupies 4 bytes (one word), identical to `int*` in allocation width. The pointee width is 2 bytes.

Dereferencing with `push *name` emits a signed 16-bit load (`i32.load16_s`) for `int16*` and an unsigned 16-bit load (`i32.load16_u`) for `int16u*`.

Pointer-aware metadata reflects the 2-byte pointee type and tracked pointee count:
- `sizeof(*name)` returns `2` for `int16*` and `int16u*` (pointee element word size)
- `min(*name)` returns `-32768` for `int16*` and `0` for `int16u*` (pointee minimum value)
- `max(*name)` returns `32767` for `int16*` and `65535` for `int16u*` (pointee maximum value)
- `count(*name)` returns the target element count when the pointer is initialized from a known memory start address, or `1` without tracked count metadata

#### Examples

```
int16[] samples 64 0
int16* ptr &samples
push *ptr        ; loads a signed 16-bit value, sign-extended to i32

int16u[] unsignedSamples 64 0
int16u* unsignedPtr &unsignedSamples
push *unsignedPtr ; loads an unsigned 16-bit value, zero-extended to i32

int16** pptr &ptr
push *pptr       ; pushes the address stored in ptr
push **pptr      ; loads a signed 16-bit value through the double pointer

push sizeof(*ptr) ; 2 — pointee element word size
push min(*ptr)    ; -32768 — pointee minimum value
push count(*ptr)  ; 64 — tracked pointee element count
```

### float

The float instruction declares a 32-bit floating-point value in module memory. Use `float*` or `float**` to declare pointer types.

A bare `float` (no arguments) allocates an anonymous `float` with default `0`. This zero-initialized form applies to scalar declarations only (including pointer variants such as `float*`).

Default values can be specified as literals, constants, or memory references (using `&name` for start address or `name&` for end address).
Constant expressions are also supported with the same one-operator rule (`CONST+number`, `CONST-number`, `CONST*number`, or `CONST/number`).

#### Examples

```
const MAX_GAIN 2
float
float gain 0.75
float halfGain MAX_GAIN/2
float[] samples 4 0.0 0.25 0.5 0.75
float*
float* ptr &samples
float* endPtr samples&
```

### float64

The float64 instruction declares a 64-bit floating-point value in module memory. A scalar `float64` occupies 8 bytes
and defaults to `0`. Use `float64*` or `float64**` to declare pointer types; each pointer slot occupies 4 bytes.

Use the [`f64` suffix](stack.md#push) for float64 literals. Unsuffixed floating-point literals are float32. To convert
an existing integer or float32 value, use [`castToFloat64`](conversion.md#casttofloat64).

Pointer metadata distinguishes the pointer slot from its pointee: `sizeof(pointer)` is `4`, while
`sizeof(*pointer)` is `8` for a `float64*`. See [pointee element word size](../prefixes.md#pointee-element-word-size)
for metadata query details.

#### Examples

```
float64
float64 precise 1.2345678901234567f64
float64* ptr &precise
float64** pptr &ptr

push sizeof(precise) ; 8 — the scalar's storage size
push sizeof(ptr)    ; 4 — the pointer slot's storage size
push sizeof(*ptr)   ; 8 — the float64 pointee's element size
```

This complete example can be compiled and run by the test runner without reading through a float64 pointer:

```text
8f4e/v1
; @config testRuntime.enabled true

entry test
module values
float64 precise 1.2345678901234567f64
float64* precisePtr &precise
push precise
assertEqual 1.2345678901234567f64
push sizeof(precise)
assertEqual 8
push sizeof(precisePtr)
assertEqual 4
push sizeof(*precisePtr)
assertEqual 8
moduleEnd
entryEnd
```

### int[]

The int[] instruction declares a buffer of integers in module memory. Variants include `int8[]`, `int8u[]`, `int16[]`, `int16u[]`, `int32[]`, `int*[]`, and `int**[]`.

Unsigned variants (`int8u[]`, `int16u[]`) interpret values as unsigned integers (0-255 for int8u, 0-65535 for int16u) in debuggers, plotters, and when using min/max prefixes.
Buffer size arguments also support constant expressions with exactly one operator (`CONST+number`, `CONST-number`, `CONST*number`, or `CONST/number`). Fractional results can be converted explicitly with `round(...)`, `floor(...)`, or `ceil(...)`.
The element count must resolve to a finite nonnegative whole number. Zero length arrays are allowed and whole numbers written as `1.0` are valid. This applies to all array declaration variants.
Trailing values initialize array elements from index 0 onward. Omitted elements remain zero-initialized, and the initializer list must not be longer than the declared element count.
The compiler may encode these initializer values sparsely in WebAssembly passive data segments; this does not change the runtime memory image after `initDefaults()`.

#### Examples

```text
int[] values 4 48 50 53
int[] halfValues SIZE/2
int[] scaledValues round(SIZE*1.5)
int8u[] unsignedBytes 256
int16u[] unsignedShorts 128
```

### float[]

The float[] instruction declares a buffer of floating-point values in module memory. Variants include `float*[]` and `float**[]`.
Trailing values initialize array elements from index 0 onward, matching `int[]`.

#### Examples

```text
float[] samples 4 0.0 0.25 0.5 0.75
```

### float64[]

The float64[] instruction declares an array of 64-bit floating-point values. Each element occupies 8 bytes, so an
array with `N` elements reserves `N * 8` bytes. Arrays default every element to zero; trailing initializer values
start at index zero, and omitted elements retain their zero defaults. The initializer list must not exceed the declared
count.

Use the [`f64` suffix](stack.md#push) for float64 initializer values. Pointer arrays can also be declared as
`float64*[]` or `float64**[]`; their elements are 4-byte pointer slots, not 8-byte float64 values. For pointer
metadata such as `sizeof(*ptr)` and `count(*ptr)`, see [identifier prefixes](../prefixes.md#element-count).

#### Examples

```
float64[] samples 4 1.5f64 2.5f64
float64[] zeroFilled 3
float64*[] pointers 2 0 0
float64**[] pointerPointers 2 0 0
```

`samples` has values at indexes 0 and 1, while indexes 2 and 3 remain `0`. `sizeof(samples)` is `8` (the element
size), and `count(samples)` is `4`; the total data allocation is 32 bytes.

### local

The local instruction declares a local variable inside a module or function (`local int name`, `local float name`, or a pointer type such as `local int16u* cursor`).

Local variable names must not collide with any memory declaration identifier in the same namespace. Declaring a local whose name is already used by a `int`, `float`, `int[]`, or any other memory allocation is a compiler error.

#### Examples

```
local int temp
local int16u* cursor
```

### localSet

The localSet instruction consumes a value from the stack and stores it in a local variable.

Floating-point assignments must match the destination local or parameter's declared width: `float` accepts float32 values and `float64` accepts float64 values. Mixed-width assignments are compiler errors; no implicit widening or narrowing is performed. Use `castToFloat64` to explicitly promote a float32 value before assigning it to a float64 local.

Pointer assignments must exactly match the destination's pointee base type and pointer depth. A raw `int`, a different
pointer type, or a pointer assigned to an `int` local is a compiler error.

#### Examples

```
local int temp
push 5
localSet temp
```
