# Standard library

The 8f4e toolchain ships a small standard library of reusable 8f4e functions.
Standard library functions are included by source id, then called like ordinary functions.

## Include syntax

Add an `includes` block near the top of the project, after the `8f4e/v1` header and before entries or other document blocks.

```8f4e
8f4e/v1

includes
include std/math/clamp
include std/math/exp2
include std/math/fract
include std/math/lerp
include std/math/log2
include std/math/moveTowards
include std/math/normalize
include std/math/pow2
include std/math/smoothstep
include std/math/trig/advancePhase
include std/math/trig/cosine
include std/math/trig/saw
include std/math/trig/sine
include std/math/trig/triangle
include std/color/lerpRGB
include std/color/srgbByteToLinear
include std/color/linearToSrgbByte
include std/image/downsampleRGB2x
include std/bitwise/extractBit
include std/bitwise/extractBits
include std/bitwise/extractByte
include std/bitwise/extractNibble
include std/events/gateToTrigger
include std/events/risingEdge
include std/events/hasChanged
include std/events/triggerToGate
include std/random/lcg
include std/random/xorshift
include std/memory/addAt
include std/memory/advancePointer
include std/memory/loadAt
include std/memory/loadBitAt2D
include std/memory/nearestValue
include std/memory/readInterpolated
include std/memory/storeAt
include std/memory/storeBitAt2D
include std/memory/storeRGB
include std/memory/wrapPointer
include std/stack/dup
include std/stack/swap
includesEnd

entry main
module main
; ...
moduleEnd
entryEnd
```

Each `include` line accepts a source id, an optional exported function name, and an optional local name:

```8f4e
include <path> [exportedName [localName]]
```

- `include <path>` includes every public function under its exported name.
- `include <path> <exportedName>` selects that public function, keeping its exported name.
- `include <path> <exportedName> <localName>` selects that public function and names it locally.

For example, rename the standard-library sine function to `sin`:

```8f4e
includes
include std/math/trig/sine sine sin
includesEnd

; Inside a module or function:
push 0.5
call sin
```

Inside standard-library source files, `#export` marks functions that become public to the including project. The project
preparser consumes those markers before compilation, so they do not create WebAssembly exports. Non-exported functions in
an included source file are treated as private helpers and are renamed with an include-specific prefix.

An include source may export several distinct functions. Select them on separate lines using the same source id.
Selections use the names exposed by include-local `#export`, including any export aliases, and include every public
overload of the selected name. Missing exports and private helper names cannot be selected.

Repeated declarations of the same source, export, and local name are deduplicated. Each export has one local name per
including project or group; selecting the same export under different names is an error. This also applies when combining
the include-all form with a renamed selection. Each source is loaded once per resolution pass, and private helpers are
shared by all selections. Unselected exports remain private dependencies so calls inside included functions still work.

Composition renames selected function declarations and their include-local call targets after syntax validation.
Local names use the same overload and duplicate-signature rules as ordinary project functions, including when two exports
or an included function and a project function share a name. The include resolver does not inspect project declarations
or allocate alternative names to avoid collisions; ordinary namespace validation handles them.

Includes are resolved during project loading. The CLI loads the shipped standard library files from the installed
package, while browser-based tools load those same files lazily. The compiler receives the included source as ordinary
function blocks, so overload resolution, stack typing, and `call` behavior are the same as user-defined functions.

Some helpers call functions from other include sources. Include those prerequisites explicitly under their standard
exported names; source inclusion does not load dependencies recursively. Each helper's reference lists its prerequisites.
Renaming a prerequisite does not rewrite calls from a different include source.

## `std/stack/dup`

Provides `dup`, which duplicates the top stack value.

Available overloads:

- `dup(int value) -> int int`
- `dup(float value) -> float float`

Examples:

```8f4e
includes
include std/stack/dup
includesEnd

entry test
module dupExamples
push 42
call dup
; stack: 42, 42
moduleEnd
entryEnd
```

## `std/stack/swap`

Provides `swap`, which exchanges the top two stack values.

Available overloads:

- `swap(int first, int second) -> int int`
- `swap(int first, float second) -> float int`
- `swap(float first, int second) -> int float`
- `swap(float first, float second) -> float float`

Examples:

```8f4e
includes
include std/stack/swap
includesEnd

entry test
module swapExamples
push 1
push 2.5
call swap
; stack: 2.5, 1
moduleEnd
entryEnd
```

## `std/memory/wrapPointer`

Provides `wrapPointer`, which bidirectionally wraps a byte address into a circular buffer range.

Available overloads:

- `wrapPointer(int* pointer, int* buffer, int itemCount) -> int*`
- `wrapPointer(float* pointer, float* buffer, int itemCount) -> float*`

`itemCount` is the circular buffer length in elements. The first argument is a typed but potentially out-of-range
computed byte address. Its pointer type must match the buffer element type; the buffer and item count supply the
circular range. The returned pointer is wrapped into that range.

Examples:

```8f4e
includes
include std/memory/wrapPointer
includesEnd

entry test
module wrapPointerExamples
float[] buffer 4
float* pointer &buffer

push pointer
push count(buffer)
push sizeof(buffer)
mul
add
push &buffer
push count(buffer)
call wrapPointer
; stack: &buffer

push pointer
push sizeof(buffer)
sub
push &buffer
push count(buffer)
call wrapPointer
; stack: end(buffer)-sizeof(buffer)
moduleEnd
entryEnd
```

## `std/memory/advancePointer`

Provides `advancePointer`, which advances a mutable pointer by one element and wraps it within a circular buffer.

Available overloads:

- `advancePointer(int** pointer, int* buffer, int itemCount) -> void`
- `advancePointer(float** pointer, float* buffer, int itemCount) -> void`

`itemCount` is the circular buffer length in elements. The pointer argument is the address of the pointer variable to mutate.

Examples:

```8f4e
includes
include std/memory/advancePointer
includesEnd

entry test
module advancePointerExamples
float[] buffer 4
float* pointer &buffer

push &pointer
push &buffer
push count(buffer)
call advancePointer
; pointer is &buffer + sizeof(buffer)
moduleEnd
entryEnd
```

## `std/memory/decrementPointer`

Provides `decrementPointer`, which decrements a mutable pointer by one element and wraps it within a circular buffer.

Available overloads:

- `decrementPointer(int** pointer, int* buffer, int itemCount) -> void`
- `decrementPointer(float** pointer, float* buffer, int itemCount) -> void`

`itemCount` is the circular buffer length in elements. The pointer argument is the address of the pointer variable to mutate.

Examples:

```8f4e
includes
include std/memory/decrementPointer
includesEnd

entry test
module decrementPointerExamples
float[] buffer 4
float* pointer &buffer

push &pointer
push &buffer
push count(buffer)
call decrementPointer
; pointer is end(buffer)-sizeof(buffer)
moduleEnd
entryEnd
```

## `std/memory/swapPointers`

Provides `swapPointers`, which exchanges the addresses stored in two pointer variables of the same type.

Available overloads:

- `swapPointers(int** first, int** second) -> void`
- `swapPointers(int8** first, int8** second) -> void`
- `swapPointers(int8u** first, int8u** second) -> void`
- `swapPointers(int16** first, int16** second) -> void`
- `swapPointers(int16u** first, int16u** second) -> void`
- `swapPointers(float** first, float** second) -> void`
- `swapPointers(float64** first, float64** second) -> void`

Pass the addresses of valid, writable pointer variables. The function reads and writes the four-byte pointer slots;
it does not read or modify the pointed-to data. The slots may be the same, and null pointer values are preserved.
The first slot is written before the second using ordinary stores; the pair is not an atomic operation.

Examples:

```8f4e
includes
include std/memory/swapPointers
includesEnd

entry main
module buffers
int8u[] firstFrame 16
int8u[] secondFrame 16
int8u* display &firstFrame
int8u* drawing &secondFrame

call swapPointers &display &drawing
; display points to secondFrame; drawing points to firstFrame.
moduleEnd
entryEnd
```

## `std/memory/copy`

Provides `copy`, which copies the value pointed to by one memory pointer into another memory pointer of the same type.

Available overloads:

- `copy(int* source, int* dest) -> void`
- `copy(float* source, float* dest) -> void`

Examples:

```8f4e
includes
include std/memory/copy
includesEnd

entry test
module copyExamples
float source 12.5
float dest 0.0

push &source
push &dest
call copy
; dest is 12.5
moduleEnd
entryEnd
```

## `std/memory/addAt`

Provides `addAt`, which adds a value to the existing float at a buffer's element index.

Available overloads:

- `addAt(float* buffer, int index, float value) -> void`

`index` is zero-based and measured in elements. Callers supply a valid buffer index; the function does not wrap indices
or clamp them to the buffer length. Repeated calls accumulate into the same element.

Examples:

```8f4e
includes
include std/memory/addAt
includesEnd

entry test
module addAtExamples
float[] buffer 3 1.0 2.0 3.0

call addAt &buffer 1 0.5
call addAt &buffer 1 -0.25
; buffer[1] is 2.25
moduleEnd
entryEnd
```

## `std/memory/loadAt`

Provides `loadAt`, which reads a value from a buffer by element index.

Available overloads:

- `loadAt(int* buffer, int index) -> int`

Examples:

```8f4e
includes
include std/memory/loadAt
includesEnd

entry test
module loadAtExamples
int[] buffer 4 11 22 33 44

push &buffer
push 2
call loadAt
; stack: 33
moduleEnd
entryEnd
```

## `std/memory/loadBitAt2D`

Provides `loadBitAt2D`, which reads a pixel from a packed binary grid as `0` or `1`.

Available overloads:

- `loadBitAt2D(int8u* buffer, int width, int height, int x, int y) -> int`

Pixels are stored in the texture runtime's `1bit` layout: the leftmost pixel occupies the most-significant bit of
each byte, and every row starts on a byte boundary. A row occupies `ceil(width / 8)` bytes; unused bits at its end
are padding. Coordinates outside the pixel dimensions return zero, including coordinates that fall on padding bits.

Dimensions must be non-negative, and the buffer must hold `ceil(width / 8) * height` bytes. The helper performs
memory IO and carries `#impure`.

Example:

```8f4e
includes
include std/memory/loadBitAt2D
includesEnd

entry test
module packedPixelExample
int8u[] pixels 2 0x80 0x40
call loadBitAt2D &pixels 10 1 9 0
; stack: 1
moduleEnd
entryEnd
```

## `std/memory/nearestValue`

Provides `nearestValue`, which scans a buffer and returns the element whose value is closest to the supplied value. It returns the value itself, not its index or address. The buffer is read without being modified, and it does not need to be sorted.

Available overloads:

- `nearestValue(int value, int* buffer, int itemCount) -> int`
- `nearestValue(float value, float* buffer, int itemCount) -> float`

Pass the buffer address (for example, `&values`) and its element count (for example, `count(values)`). `itemCount` is measured in elements, not bytes. When two elements are equally close, the first matching value in buffer order is returned. If `itemCount` is zero or negative, the function returns a typed zero (`0` for the integer overload or `0.0` for the float overload); no buffer element is read in that case.

Examples:

```8f4e
includes
include std/memory/nearestValue
includesEnd

entry test
module nearestValueExamples
int[] intValues 5 -10 -2 4 11 20
float[] floatValues 4 -1.0 0.25 0.75 2.0
int[] ties 2 0 10

push 5
push &intValues
push count(intValues)
call nearestValue
assertEqual 4

push 0.6
push &floatValues
push count(floatValues)
call nearestValue
assertEqual 0.75

push 5
push &ties
push count(ties)
call nearestValue
assertEqual 0

push 5
push &intValues
push 0
call nearestValue
assertEqual 0

push 5
push &intValues
push -1
call nearestValue
assertEqual 0
moduleEnd
entryEnd
```

The integer example returns `4` for input `5` and buffer `[-10, -2, 4, 11, 20]`. The float example returns `0.75` for input `0.6` and buffer `[-1.0, 0.25, 0.75, 2.0]`. The tie example returns `0` because `0` appears before `10` in the buffer.

## `std/memory/readInterpolated`

Provides `readInterpolated`, which reads two adjacent circular-buffer samples and linearly interpolates between them.

Available overloads:

- `readInterpolated(int* pointer, int* buffer, int itemCount, float fraction) -> float`
- `readInterpolated(int16* pointer, int16* buffer, int itemCount, float fraction) -> float`
- `readInterpolated(float* pointer, float* buffer, int itemCount, float fraction) -> float`

`pointer` is a typed but potentially out-of-range computed byte address. Its pointer type must match the buffer element
type; the buffer and `itemCount` supply the circular range. `fraction` is the interpolation amount between the wrapped
sample at `pointer` and the next wrapped sample.

Examples:

```8f4e
includes
include std/memory/readInterpolated
includesEnd

entry test
module readInterpolatedExamples
float[] buffer 3 10.0 20.0 40.0
float* pointer &buffer

push pointer
push &buffer
push count(buffer)
push 0.5
call readInterpolated
; stack: 15.0
moduleEnd
entryEnd
```

## `std/memory/storeAt`

Provides `storeAt`, which stores a value into a buffer by element index.

Available overloads:

- `storeAt(int* buffer, int index, int value) -> void`

Examples:

```8f4e
includes
include std/memory/storeAt
includesEnd

entry test
module storeAtExamples
int[] buffer 4

push &buffer
push 2
push 99
call storeAt
; buffer[2] is 99
moduleEnd
entryEnd
```

## `std/memory/storeBitAt2D`

Provides `storeBitAt2D`, which sets or clears one pixel in a packed binary grid.

Available overloads:

- `storeBitAt2D(int8u* buffer, int width, int height, int x, int y, int value)`

The layout matches `loadBitAt2D`: pixels are MSB first, with `ceil(width / 8)` bytes per row. A zero value clears
the pixel; any nonzero value sets it. Writes preserve neighboring pixels and unused padding bits. Coordinates
outside the pixel dimensions do nothing, including coordinates on padding bits.

Dimensions must be non-negative, and the buffer must hold `ceil(width / 8) * height` bytes. The helper performs
memory IO and carries `#impure`.

Example:

```8f4e
includes
include std/memory/storeBitAt2D
includesEnd

entry test
module packedPixelExample
int8u[] pixels 4 0 0x3F 0x80 0x15
call storeBitAt2D &pixels 10 2 9 0 1
; pixels[1] is now 0x7F; padding is preserved.
call storeBitAt2D &pixels 10 2 0 1 0
; pixels[2] is now zero.
moduleEnd
entryEnd
```

## `std/memory/storeRGB`

Provides `storeRGB`, which writes a packed `0xRRGGBB` integer into three consecutive unsigned-byte elements.

Available overloads:

- `storeRGB(int8u* pixel, int color) -> void`

The destination must have at least three writable bytes and may have any byte alignment. The function writes red,
green, then blue using ordinary byte stores, ignores the color's high eight bits, and leaves every other byte and
the supplied pointer variable unchanged. It carries `#impure`.

```8f4e
includes
include std/memory/storeRGB
includesEnd

entry main
module pixelExample
int8u[] pixel 3
call storeRGB &pixel 0x123456
; pixel contains 0x12, 0x34, 0x56.
moduleEnd
entryEnd
```

## `std/math/clamp`

Provides `clamp`, which constrains a value to an inclusive minimum and maximum.

Available overloads:

- `clamp(int value, int minValue, int maxValue) -> int`
- `clamp(float value, float minValue, float maxValue) -> float`

Examples:

```8f4e
includes
include std/math/clamp
includesEnd

entry test
module clampExamples
push 7
push 0
push 5
call clamp
; stack: 5

push 0.25
push 0.5
push 1.0
call clamp
; stack: 0.5
moduleEnd
entryEnd
```

## `std/math/log2`

Provides `log2`, an approximation of the base-two logarithm for finite, strictly positive inputs.

Available overloads:

- `log2(float value) -> float`
- `log2(float64 value) -> float64`

Both overloads support their full positive finite range, including subnormal values. Callers must exclude zero,
negative values, infinities, and NaN. The result is exact for representable powers of two. Range reduction normalizes
the input to `[1, 2)`, followed by a truncated odd-power logarithm series.

Numerical regression tests cover every representable power of two, four mantissa samples at each exponent, and
8,193 evenly spaced inputs in `[1, 2]`. On those samples, the absolute error is below `1e-5` for `float` and `1.6e-10`
for `float64`, with a monotonic result across the dense mantissa grid. These are tested approximation bounds, not a
correct-rounding guarantee for every input.

```8f4e
includes
include std/math/log2
includesEnd

entry main
module logarithmExamples
call log2 8.0
; stack: 3.0
call log2 0.5f64
; stack: -1.0f64
moduleEnd
entryEnd
```

## `std/math/fract`

Provides `fract`, which returns the signed fractional part by subtracting the value truncated toward zero.

Available overloads:

- `fract(float value) -> float`
- `fract(float64 value) -> float64`

Inputs must be finite. For example, `3.25` returns `0.25`, while `-3.25` returns `-0.25`; this is truncation toward zero
rather than positive modulo wrapping. The `float` overload converts the integer part through a signed 32-bit integer,
so that part must fit in `int`. The `float64` overload uses floating-point rounding and accepts the full finite double
range, including large integral values and subnormal fractions.

Examples:

```8f4e
includes
include std/math/fract
includesEnd

entry test
module fractExamples
push 3.25
call fract
; stack: 0.25
moduleEnd
entryEnd
```

## `std/math/lerp`

Provides `lerp`, which linearly interpolates between two values at the supplied floating-point precision.

Available overloads:

- `lerp(float start, float end, float amount) -> float`
- `lerp(float64 start, float64 end, float64 amount) -> float64`

Examples:

```8f4e
includes
include std/math/lerp
includesEnd

entry test
module lerpExamples
push 10.0
push 20.0
push 0.5
call lerp
; stack: 15.0
moduleEnd
entryEnd
```

## `std/math/moveTowards`

Provides `moveTowards`, which moves a float value toward a target by at most a given step without overshooting.

Available overloads:

- `moveTowards(float current, float target, float maxStep) -> float`

The function returns the next value and leaves state management to the caller. A zero or negative `maxStep` returns
`current` unchanged. The step is a distance per call, so callers can supply a per-sample increment for ramps or slews.

Examples:

```8f4e
includes
include std/math/moveTowards
includesEnd

entry test
module moveTowardsExamples
float value 0.0

push &value
call moveTowards value 1.0 0.25
store
; value: 0.25
moduleEnd
entryEnd
```

## `std/math/normalize`

Provides `normalize`, which loads an integer value through a typed pointer and maps it to a float audio/control range
based on the pointer type.

Available overloads:

- `normalize(int8* pointer) -> float`
- `normalize(int8u* pointer) -> float`
- `normalize(int16* pointer) -> float`
- `normalize(int16u* pointer) -> float`
- `normalize(int* pointer) -> float`

Signed pointer types map to `-1..1`; unsigned pointer types map to `0..1`. The integer type's maximum value is inferred
from pointer metadata.

Examples:

```8f4e
includes
include std/math/normalize
includesEnd

entry test
module normalizeExamples
int8 sample -64

push &sample
call normalize
; stack: roughly -0.5
moduleEnd
entryEnd
```

## `std/math/exp2`

Provides `exp2(float x) -> float`, a 32-bit float approximation of `2^x` for finite inputs.
Inputs are clamped to `[-24.0, 6.0]`, so values outside that range return `2^-24` or `64.0` respectively.
This helper uses range reduction and a sixth-order polynomial, followed by integer power reconstruction.
It is independent of any synthesizer or envelope implementation.

A sweep of 122,881 evenly spaced float inputs (step `1/4096`) across the supported range measured a maximum relative
error of approximately `2.16e-7` against `2^x`. The numerical regression test allows `3e-7` on that grid; this is a
measured approximation error rather than a correctly rounded result for every float input.

```8f4e
includes
include std/math/exp2
includesEnd

entry test
module exp2Example
push -1.0
call exp2
; stack: 0.5
moduleEnd
entryEnd
```

Unlike `exp2`, `std/math/pow2` takes an integer exponent and returns an integer.

## `std/math/pow2`

Provides `pow2`, which raises 2 to an integer exponent.

Available overloads:

- `pow2(int exponent) -> int`

Examples:

```8f4e
includes
include std/math/pow2
includesEnd

entry test
module pow2Examples
push 5
call pow2
; stack: 32
moduleEnd
entryEnd
```

## `std/math/smoothstep`

Provides `smoothstep`, which maps a floating-point amount to a cubic eased curve. It is commonly used for fades and modulation
shaping.

Available overloads:

- `smoothstep(float amount) -> float`
- `smoothstep(float64 amount) -> float64`

The usual input range is `0..1`, where `0` returns `0`, `0.5` returns `0.5`, and `1` returns `1`. Both overloads evaluate
`amount * amount * (3 - 2 * amount)` directly without clamping.

Examples:

```8f4e
includes
include std/math/smoothstep
includesEnd

entry test
module smoothstepExamples
push 0.5
call smoothstep
; stack: 0.5
moduleEnd
entryEnd
```

## `std/math/trig/advancePhase`

Provides `advancePhase`, which advances a mutable float phase by one sample and preserves overshoot when wrapping across
`PI`.

Available overloads:

- `advancePhase(float* phase, float frequency, int sampleRate) -> float`

The phase increment is `TAU * frequency / sampleRate`, where `TAU` is a full cycle in radians. When the advanced phase
exceeds `PI`, the helper subtracts one `TAU`, preserving the fractional cycle and the oscillator's tuning. It performs one
wrap per call. The `sampleRate` argument is cast to float inside the helper. The updated phase is stored through the
`phase` pointer and returned on the stack.

Examples:

```8f4e
includes
include std/math/trig/advancePhase
includesEnd

entry test
module advancePhaseExamples
float phase -3.141592653589793

push &phase
push 440.0
push 48000
call advancePhase
; stack: next phase
moduleEnd
entryEnd
```

## `std/math/trig/sine`

Provides `sine`, a float approximation for phases in `[-PI, PI]`.

Available overloads:

- `sine(float x) -> float`

`sine` uses a 7th-order Taylor polynomial with folding to `[-PI/2, PI/2]`.

Examples:

```8f4e
includes
include std/math/trig/sine
includesEnd

entry test
module sineExamples
push 0.0
call sine
; stack: 0.0
moduleEnd
entryEnd
```

## `std/math/trig/cosine`

Provides `cosine`, a float approximation for phases in `[-PI, PI]`.

Available overloads:

- `cosine(float x) -> float`

`cosine` uses a self-contained 6th-order Taylor polynomial with folding to `[-PI/2, PI/2]`. Include sources are resolved independently, so this helper does not require `sine`.

Examples:

```8f4e
includes
include std/math/trig/cosine
includesEnd

entry test
module cosineExamples
push 0.0
call cosine
; stack: about 1.0
moduleEnd
entryEnd
```

## `std/math/trig/triangle`

Provides `triangle`, which maps a phase in `[-PI, PI]` to a triangle waveform in `[-1, 1]`.

Available overloads:

- `triangle(float x) -> float`

Examples:

```8f4e
includes
include std/math/trig/triangle
includesEnd

entry test
module triangleExamples
push 0.0
call triangle
; stack: 1.0
moduleEnd
entryEnd
```

## `std/math/trig/saw`

Provides `saw`, which maps a phase in `[-PI, PI]` to a sawtooth ramp in `[-1, 1]`.

Available overloads:

- `saw(float x) -> float`

Examples:

```8f4e
includes
include std/math/trig/saw
includesEnd

entry test
module sawExamples
push 0.0
call saw
; stack: 0.0
moduleEnd
entryEnd
```

## `std/color/lerpRGB`

Provides `lerpRGB`, which interpolates the channels of two packed `0xRRGGBB` colors and returns a packed color.

Available overloads:

- `lerpRGB(int start, int end, float amount) -> int`
- `lerpRGB(int start, int end, float64 amount) -> int`

The interpolation amount must be finite and in `0..1`. An amount of zero returns the start color, and one returns
the end color. Only the low 24 bits of each color are used; the returned high byte is zero. Interpolation operates
directly on the stored RGB channel values at the amount's floating-point precision. Each channel is rounded to the
nearest integer, with halfway values rounded to even. The function is pure.

```8f4e
includes
include std/color/lerpRGB
includesEnd

entry main
module colorExample
call lerpRGB 0xff0000 0x0000ff 0.5f64
; stack: 0x800080
moduleEnd
entryEnd
```

## `std/color/srgbByteToLinear`

Provides `srgbByteToLinear(int channel) -> float`, which decodes an sRGB channel byte into linear light.

The channel must be in `0..255`. The pure function divides by 255, then applies the sRGB transfer function:
`encoded / 12.92` at or below `0.04045`, otherwise `((encoded + 0.055) / 1.055)^2.4`.
The result is in `0..1`. The nonlinear branch uses the standard-library logarithm and exponential approximations.
Across all 256 byte inputs, tests require absolute error below `1e-6` against the reference formula and monotonic output.

Include `std/math/log2` and `std/math/exp2` explicitly under their standard exported names:

```8f4e
includes
include std/math/log2
include std/math/exp2
include std/color/srgbByteToLinear
includesEnd

; Inside a module or function:
call srgbByteToLinear 128
; stack: about 0.21586
```

## `std/color/linearToSrgbByte`

Provides `linearToSrgbByte(float linear) -> int`, which encodes linear light as an sRGB channel byte.

Supply a finite float. The pure function clamps it to `0..1`, then applies the sRGB transfer function:
`linear * 12.92` at or below `0.0031308`, otherwise `1.055 * linear^(1/2.4) - 0.055`.
The encoded value is scaled to `0..255`, clamped, and rounded to the nearest integer, with halfway values rounded to even.
The nonlinear branch uses logarithm and exponential approximations. A monotonic sweep of 65,537 evenly spaced linear
inputs is tested within one byte level of the reference formula; all 256 decoded sRGB bytes round-trip exactly.

Include `std/math/log2` and `std/math/exp2` explicitly under their standard exported names:

```8f4e
includes
include std/math/log2
include std/math/exp2
include std/color/linearToSrgbByte
includesEnd

; Inside a module or function:
call linearToSrgbByte 0.5
; stack: 188
```

## `std/image/downsampleRGB2x`

Provides a linear-light 2x2 downsampler for interleaved sRGB byte buffers:

```8f4e
downsampleRGB2x(int8u* source, int8u* destination, int width, int height,
                int sourceStride, int destinationStride, float amount)
```

`width` and `height` are non-negative output dimensions in pixels. The source contains `2 * width` by `2 * height`
pixels, each stored as consecutive R, G, B bytes. Both strides are in bytes and may include row padding independently:
`sourceStride >= 6 * width` and `destinationStride >= 3 * width`. Buffers may start at any byte alignment.

The finite `amount` must be in `0..1`. Zero copies the top-left sample of each 2x2 block. One decodes all four samples,
averages their channels in linear light, and encodes the result back to sRGB. Intermediate values blend from the
top-left sample toward that average in linear light. The destination always has half the source width and height.

Supply non-overlapping buffers with enough storage. For nonzero dimensions, the source needs at least
`(2 * height - 1) * sourceStride + 6 * width` bytes, and the destination needs at least
`(height - 1) * destinationStride + 3 * width` bytes. Dimensions, strides, and computed offsets must fit signed 32-bit
integers, and the resulting addresses must be valid. A zero width or height performs no reads or writes.
The helper carries `#impure`; it preserves source bytes, destination padding, and all bytes outside the output pixels.

Include both color conversions, `std/math/lerp`, and the conversions' math prerequisites explicitly under their
standard exported names:

```8f4e
includes
include std/math/log2
include std/math/exp2
include std/math/lerp
include std/color/srgbByteToLinear
include std/color/linearToSrgbByte
include std/image/downsampleRGB2x
includesEnd

entry main
module downsampleExample
int8u[] samples 12 255 0 0 0 255 0 0 0 255 255 255 255
int8u[] output 3
call downsampleRGB2x &samples &output 1 1 6 3 1.0
; output: 188, 188, 188
moduleEnd
entryEnd
```

## `std/bitwise/extractBit`

Provides `extractBit`, which extracts one bit from a 32-bit integer.

Available overloads:

- `extractBit(int word, int bitIndex) -> int`

`bitIndex` is `0..31`, where `0` is the least-significant bit. The result is `0` or `1`.

Example:

```8f4e
includes
include std/bitwise/extractBit
includesEnd

entry test
module extractBitExample
push 0b10100100
push 2
call extractBit
; stack: 1
moduleEnd
entryEnd
```

## `std/bitwise/extractBits`

Provides `extractBits`, which extracts a bit field from a 32-bit integer into the low bits of the result.

Available overloads:

- `extractBits(int word, int offset, int count) -> int`

Offsets count from the least-significant bit. Callers provide `0 <= count <= 32` and `0 <= offset <= 32 - count`.
A count of zero returns zero, and a count of 32 returns the original word with its signed integer representation.
Narrower fields are extracted with an unsigned shift and return non-negative integers. The helper is pure.

Example:

```8f4e
includes
include std/bitwise/extractBits
includesEnd

entry test
module extractBitsExample
call extractBits 0x89ABCDEF 4 12
; stack: 0xCDE
moduleEnd
entryEnd
```

## `std/bitwise/extractByte`

Provides `extractByte`, which extracts one byte from a 32-bit integer.

Available overloads:

- `extractByte(int word, int byteIndex) -> int`

`byteIndex` is `0..3`, where `0` is the least-significant byte.

Example:

```8f4e
includes
include std/bitwise/extractByte
includesEnd

entry test
module extractByteExample
push 0x12345678
push 1
call extractByte
; stack: 0x56
moduleEnd
entryEnd
```

## `std/bitwise/extractNibble`

Provides `extractNibble`, which extracts four bits from a 32-bit integer as a value in `0..15`.

Available overloads:

- `extractNibble(int word, int nibbleIndex) -> int`

`nibbleIndex` is `0..7`, where `0` is the least-significant nibble. Extraction uses an unsigned shift, including for negative words.

Example:

```8f4e
includes
include std/bitwise/extractNibble
includesEnd

entry test
module extractNibbleExample
call extractNibble 0x89ABCDEF 7
; stack: 0x8
moduleEnd
entryEnd
```

## `std/events/risingEdge`

Provides `risingEdge`, which compares the current value with a stored previous value, stores the current value, and returns `1` only when the current value is greater than the previous value.

Available overloads:

- `risingEdge(int currentValue, int* previousValue) -> int`
- `risingEdge(float currentValue, float* previousValue) -> int`

The second argument must be an address for the previous value state. This function writes the current value through that pointer before returning.

Example:

```8f4e
includes
include std/events/risingEdge
includesEnd

entry main
module triggerDetector
int* trigger
int previousTrigger
int out

push &out
push 0
store

push *trigger
call risingEdge &previousTrigger
if
 push &out
 push 1
 store
ifEnd
moduleEnd
entryEnd
```

## `std/events/gateToTrigger`

Provides `gateToTrigger`, which compares the current gate value with a stored previous value, stores the current value,
and returns a one-sample trigger when the current value is greater. Any increase qualifies; this is not limited to a
zero-to-positive transition.

Available overloads:

- `gateToTrigger(int gate, int* previousGate) -> int`
- `gateToTrigger(float gate, float* previousGate) -> int`

The second argument must be the address of persistent state, such as `&previousGate`. The function compares against the
value currently stored there, then writes `gate` through that pointer before returning. Equal or decreasing values
return `0`; an increase returns `1`, including an increase between two nonzero values or from a negative value to zero.

Example:

```8f4e
8f4e/v1

includes
include std/events/gateToTrigger
includesEnd

entry main
module gateToTriggerExample
int previousGate

push 0
call gateToTrigger &previousGate
assertEqual 0

push 1
call gateToTrigger &previousGate
assertEqual 1

push 2
call gateToTrigger &previousGate
assertEqual 1

push 2
call gateToTrigger &previousGate
assertEqual 0

push -1
call gateToTrigger &previousGate
assertEqual 0

push 0
call gateToTrigger &previousGate
assertEqual 1
moduleEnd
entryEnd
```

## `std/events/triggerToGate`

Provides `triggerToGate`, which turns a positive trigger into a gate held for a specified number of calls. A positive
trigger resets the stored countdown to `duration`, including when the previous call also had a positive trigger. If the
countdown is positive, the function decrements it and returns `1`; otherwise it returns `0`.

Available overloads:

- `triggerToGate(int trigger, int duration, int* remainingSamples) -> int`
- `triggerToGate(float trigger, int duration, int* remainingSamples) -> int`

The third argument must be the address of persistent state, such as `&remainingSamples`. The duration is counted in
calls. When called once per sample, it therefore represents samples, and the triggering call is included in the
duration. For example, with an initially zero `remainingSamples`, duration `3`, and trigger inputs `1, 0, 0, 0`, the
gate outputs are `1, 1, 1, 0`. A later positive trigger restarts the countdown, even on consecutive calls.

Example:

```8f4e
8f4e/v1

includes
include std/events/triggerToGate
includesEnd

entry main
module triggerToGateExample
int remainingSamples

; Inputs 1, 0, 0, 0 produce gates 1, 1, 1, 0.
push 1
push 3
call triggerToGate &remainingSamples
assertEqual 1
push 0
push 3
call triggerToGate &remainingSamples
assertEqual 1
push 0
push 3
call triggerToGate &remainingSamples
assertEqual 1
push 0
push 3
call triggerToGate &remainingSamples
assertEqual 0

; A positive trigger restarts the duration, including consecutively.
push 1
push 3
call triggerToGate &remainingSamples
assertEqual 1
push 1
push 3
call triggerToGate &remainingSamples
assertEqual 1
push 0
push 3
call triggerToGate &remainingSamples
assertEqual 1
moduleEnd
entryEnd
```

## `std/events/hasChanged`

Provides `hasChanged`, which compares the current value with a stored previous value, stores the current value, and returns `1` when the values differ.

Available overloads:

- `hasChanged(int currentValue, int* previousValue) -> int`
- `hasChanged(float currentValue, float* previousValue) -> int`

The second argument must be an address for the previous value state. This function writes the current value through that pointer before returning.

Example:

```8f4e
includes
include std/events/hasChanged
includesEnd

entry main
module valueChangeDetector
float* input
float previousInput
int changed

push &changed
push *input
call hasChanged &previousInput
store
moduleEnd
entryEnd
```

## `std/random/lcg`

Provides `lcg`, which advances a 16-bit linear congruential generator seed and returns the next integer.

Available overloads:

- `lcg(int* seed) -> int`

The argument must be an address for the seed state. The function normalizes the stored seed modulo `65536`, computes `(seed * 26125 + 62303) % 65536`, writes that value back through the pointer, and returns it. The result is always an integer in `0..65535`.

Because the seed is updated in place, successive calls advance one stream rather than restarting it. Pass `&seed`, keep the seed in memory between calls, and the same starting value always produces the same sequence. `lcg` does not take a seed by value and does not return a normalized float.

Example:

```8f4e
includes
include std/random/lcg
includesEnd

entry main
module lcgExample
int seed 69420
int value

push &value
push &seed
call lcg
store
; value: 16539

push &value
push &seed
call lcg
store
; value: 64830

push &value
push &seed
call lcg
store
; value: 33669
moduleEnd
entryEnd
```

Starting from `69420`, the first three calls return `16539`, `64830`, and `33669`, and the seed holds the returned value after each call.

## `std/random/xorshift`

Provides `xorshift`, which advances a signed 32-bit XORShift seed and returns the next integer value.

Available overloads:

- `xorshift(int* seed) -> int`

The argument must be an address for the seed state. The function applies a left shift of `13`, an unsigned right shift of `17`, and a left shift of `5`, in that order, exclusive-or-ing each result into the stored seed, and returns the final bit pattern as a signed 32-bit integer. Results can therefore be negative.

As with `lcg`, the seed is updated in place, so repeated calls advance one stream and identical starting state reproduces the same sequence. A seed of `0` stays `0`: every shift and exclusive-or of zero is zero, so the generator cannot leave that state on its own.

Example:

```8f4e
includes
include std/random/xorshift
includesEnd

entry main
module xorshiftExample
int seed 69420
int value

push &value
push &seed
call xorshift
store
; value: 494363678

push &value
push &seed
call xorshift
store
; value: -814792604

push &value
push &seed
call xorshift
store
; value: -887510667
moduleEnd
entryEnd
```

Starting from `69420`, the first three calls return `494363678`, `-814792604`, and `-887510667`.
