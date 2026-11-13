# @8f4e/stdlib

`@8f4e/stdlib` contains standard-library `.8f4e` include source files.

The package exports:

- `./package.json`: package metadata for locating the source directory through Node's package resolution.
- `./std/*`: standard-library source files.

This is a source-only package with no build or generation step.

This package owns:

- Standard-library include source files.
- Stable include ids such as `std/math/clamp` and `std/memory/loadAt`.
- Marking every public include function with `#export`.

This package does not own:

- Project include resolution or file loading policy.
- Source parsing, semantic validation, memory planning, or code generation.
- Runtime host behavior.

Callers load the exported source files through their own environment-specific resolver. Include IDs follow source
paths without the `.8f4e` extension: `std/math/clamp` resolves to `@8f4e/stdlib/std/math/clamp.8f4e`. Browser consumers
can use `@8f4e/vite-plugin-sources` to discover the files and load their text on demand.

## Include exports

Stdlib source files must explicitly mark their public include functions with `#export`:

```8f4e
function clamp
#export
param int value
param int minValue
param int maxValue
; ...
functionEnd int
```

In stdlib include context, `#export` means "make this function available to the including project." It is consumed by
the project preparser and does not create a WebAssembly export. Private helper functions should omit `#export`; the
preparser prefixes those helper names when expanding the include.

## Floating-point math

`std/math/lerp`, `std/math/smoothstep`, and `std/math/fract` have both `float` and `float64` overloads. Interpolation
and easing retain the supplied precision. `fract` returns a signed fraction using truncation toward zero; its double
overload accepts the full finite double range without an integer conversion.

`std/math/log2` approximates the base-two logarithm for finite, strictly positive `float` and `float64` inputs,
including subnormals. See the [standard-library reference](../../docs/standard-library.md#stdmathlog2) for the input
contract and tested approximation bounds.

## RGB colors

`std/color/lerpRGB` blends two packed `0xRRGGBB` colors with a finite `float` or `float64` amount in `0..1`. It
interpolates stored channel values and rounds each result to the nearest byte value, with halfway values rounded
to even. Input high bytes are ignored, and the result's high byte is zero.

`std/color/srgbByteToLinear` decodes an sRGB byte into a linear-light float in `0..1`.
`std/color/linearToSrgbByte` clamps a finite linear float to `0..1`, encodes it, and rounds to a byte.
Both require explicit includes of `std/math/log2` and `std/math/exp2` under their standard exported names.
See the [conversion reference](../../docs/standard-library.md#stdcolorsrgbbytetolinear) for approximation bounds.

`std/memory/storeRGB` writes a packed color as three consecutive R, G, B bytes through an `int8u*` pointer. Supply
three writable bytes at any byte alignment. It carries `#impure` and leaves all other bytes unchanged.

## RGB downsampling

`std/image/downsampleRGB2x` resolves each 2x2 block of interleaved sRGB bytes to one RGB pixel in linear light.
Pass source and destination pointers, output width and height, source and destination row strides in bytes, and a
finite `float` amount in `0..1`. Zero selects the top-left sample, one averages all four, and intermediate amounts
blend in linear light. Supply non-overlapping buffers; source data and destination row padding are preserved.
Zero-sized outputs perform no memory access.

Include `std/color/srgbByteToLinear`, `std/color/linearToSrgbByte`, `std/math/lerp`, `std/math/log2`, and `std/math/exp2`
explicitly under their standard exported names. Includes do not load other sources recursively, and renaming a
prerequisite does not rewrite calls from another source. See the
[downsampling reference](../../docs/standard-library.md#stdimagedownsamplergb2x) for buffer sizes, strides, and an example.

## Pointer swaps

`std/memory/swapPointers` exchanges the addresses stored in two pointer variables of the same type. Pass their
addresses, such as `call swapPointers &display &drawing`. Overloads cover pointers to `int`, `int8`, `int8u`,
`int16`, `int16u`, `float`, and `float64`. Swapping a slot with itself is a no-op, and null pointer values are valid.

The helper carries `#impure` and only accesses the pointer slots, leaving the pointed-to data unchanged. It writes
the first slot and then the second with ordinary stores. See the
[standard-library reference](../../docs/standard-library.md#stdmemoryswappointers) for the full contract and an example.

## Byte buffers and grids

`std/memory/loadAt` and `std/memory/storeAt` accept both `int*` and `int8u*` buffers. Their index is an element
index; unsigned-byte loads return integers from 0 to 255, and byte stores retain the low eight bits of the value.

The following helpers support row-major byte buffers:

| Include | Signature | Behavior |
| --- | --- | --- |
| `std/grid/indexToXY` | `(index, width) -> x, y` | Converts a non-negative element index using a positive width. |
| `std/memory/loadAt2D` | `(buffer, width, height, x, y) -> value` | Reads an unsigned byte, returning zero for coordinates outside the grid. |

Grid dimensions must be non-negative, and the supplied buffer must hold `width * height` bytes. Memory helpers
perform IO and carry `#impure`; coordinate conversion is pure.

Use the built-in [fill instruction](../../docs/instructions/memory.md#fill) to initialize byte ranges directly.
Its stack order is destination address, byte value, then byte count. It uses WebAssembly `memory.fill` and repeats
the low eight bits of the value.

## Packed binary grids

These helpers address pixels in the texture runtime's `1bit` layout: pixels run from the most-significant bit to
the least-significant bit of each byte, and each row occupies `ceil(width / 8)` bytes. Dimensions are pixel counts,
must be non-negative, and require a buffer holding `ceil(width / 8) * height` bytes.

| Include | Signature | Behavior |
| --- | --- | --- |
| `std/memory/loadBitAt2D` | `(buffer, width, height, x, y) -> value` | Reads a pixel as 0 or 1; coordinates outside the grid return zero. |
| `std/memory/storeBitAt2D` | `(buffer, width, height, x, y, value)` | Zero clears a pixel and nonzero sets it; coordinates outside the grid do nothing. |

Both helpers accept `int8u*` buffers and carry `#impure`. Pixel writes preserve every other bit, including unused
bits at the end of a row. Padding bits are outside the grid and cannot be addressed through these helpers.

## Bit fields

`std/bitwise/extractBits` accepts `(word, offset, count)` and returns the selected bits in the low bits of an integer.
Offsets count from the least-significant bit. Callers provide `0 <= count <= 32` and `0 <= offset <= 32 - count`.
A count of zero returns zero; a count of 32 returns the original word, including its signed integer representation.
The function is pure and uses an unsigned right shift for fields narrower than 32 bits.
