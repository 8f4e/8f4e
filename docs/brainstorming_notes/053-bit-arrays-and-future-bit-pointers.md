# Bit Arrays and Future Bit Pointers

Date: 2026-11-12

Status: Draft

Introduce `bit[]` for packed, one-dimensional arrays of binary values. The first iteration provides indexed reads
and writes against named arrays, logical element counts, and an explicit view of their backing bytes. Ordinary
integers continue to carry values on the stack, and addresses remain byte addresses. First-class bit pointers are
a possible later extension with their own representation and access rules. All new syntax below is proposed.

## Motivation

A packed 256 by 256 binary image for [Rule 110](../../packages/examples/src/projects/visuals/rule110.8f4e) needs
8,192 data bytes, compared with 65,536 bytes for one unsigned byte per pixel. The existing
[byte-buffer and grid helpers](../../packages/compiler/packages/stdlib/README.md#byte-buffers-and-grids), together
with explicit bit operations, support that representation through byte pointers and dimensions.

A language-level array could also express the logical data: a collection of bits rather than a collection of
bytes whose meaning is maintained by convention. This would let the compiler retain the bit count, check indexed
access against that count, pack initializers, and expose individual values to editor and CLI tools. Masks, flags,
sequencers, and cellular automata are potential consumers.

The existing helpers remain useful for externally supplied buffers and explicit grid layouts. The proposal adds
declared bit arrays while preserving those byte-oriented APIs.

## First iteration

The initial feature includes:

- Module-owned `bit[]` declarations, including declarations expanded from prototype shapes.
- Integer values on the stack: reads produce 0 or 1; writes normalize zero to 0 and any nonzero integer to 1.
- Indexed operations whose source operand identifies a declared bit array.
- Packed defaults, logical bounds, memory metadata, and editor and CLI support.
- Byte views for bulk operations, existing stdlib functions, texture uploads, and host interoperability.

Scalar `bit` declarations, `bit*` and `bit&` types, dynamically selected bit-array parameters, bit slices, atomic
bit operations, and built-in two-dimensional array declarations are outside this iteration.

## Declarations and indexed access

Use the existing array declaration shape:

```8f4e
bit[] flags 10
bit[] pattern 10 1 0 1
```

The count is a compile-time integer in `0..2147483647`, so it remains representable by the language's signed
32-bit integer values and metadata queries. Initializers follow the existing prefix rule: the supplied values
initialize the first elements, and the remaining elements start at zero. Each initializer is an integer,
normalized with the same zero/nonzero rule as a runtime write. Excess initializers and unrepresentable storage
sizes are compile-time errors. An empty array is allowed.

Proposed instructions:

| Instruction | Stack before | Stack after |
| --- | --- | --- |
| `loadBit flags` | `..., index` | `..., value` |
| `storeBit flags` | `..., index, value` | `...` |

The source operand resolves to a bit-array declaration through the existing memory scope rules. Within a module
it can be a local name; another module uses a qualified name such as `state:flags`. Indices and stored values must
be integers. Using a byte array or scalar as the instruction target is a compile-time error.

```8f4e
8f4e/v1

entry main
module state
bit[] flags 10 1 0 1

push 9
push 42
storeBit flags

push 9
loadBit flags
; stack: 1
moduleEnd
entryEnd
```

These instructions resolve the declaration directly; they do not produce or consume a bit-reference value.
Unqualified scalar-style reads such as `push flags` are rejected. Indexed value shorthand can be considered
separately after the explicit instructions establish the semantics.

Functions performing bit reads or writes require `#impure`. They can target explicitly qualified module memory,
consistent with the existing restriction on unqualified module-memory reads inside functions:

```8f4e
function isEnabled
#impure
param int index
push index
loadBit state:flags
functionEnd int
```

This first iteration does not pass an array identity as a runtime argument. Generic functions continue to receive
a byte pointer and an explicit logical count or grid dimensions, as the packed-grid stdlib functions do today.

## Packing and initialization

For a logical count `N`, the backing data occupies `B = ceil(N / 8)` bytes. Element zero uses the most-significant
bit of the first byte. For a valid index `i`:

```text
byte offset = floor(i / 8)
bit position = 7 - (i modulo 8)
mask = 1 << bit position
```

For example, `bit[] pattern 10 1 0 1` has ten logical elements and backing bytes `0xA0, 0x00`. The low six bits of
the final byte are padding, outside the logical array.

Declarations retain the normal [four-byte allocation grid](../../packages/compiler/docs/allocation-units.md).
Storage bytes and reserved allocation bytes are distinct:

| Logical bits | Data bytes | Reserved bytes on the allocation grid |
| --- | --- | --- |
| 0 | 0 | 0 |
| 1 | 1 | 4 |
| 10 | 2 | 4 |
| 20 | 3 | 4 |
| 65,536 | 8,192 | 8,192 |

Separate declarations do not share a partially occupied byte. This preserves independent declaration boundaries
and leaves the global allocation unit unchanged.

`initDefaults()` clears the declared memory range and restores packed initializer bytes through the existing
passive-data mechanism. Packing combines initializers that share a byte before emitting data segments. Omitted
elements and padding bits are zero after initialization, including after a repeated reset. Runtime bit writes
preserve padding; byte-view writes may change it, and a later reset restores its default value.

## Bounds and write behavior

Logical bounds are `0 <= index < count(array)`. They exclude both padding in the final data byte and padding on
the allocation grid.

- An out-of-bounds `loadBit` consumes the index and returns zero.
- An out-of-bounds `storeBit` consumes the index and value and performs no write.
- A valid store changes only its selected bit, preserving every other bit of the containing byte.

The compiler may remove checks when it proves the index valid, or fold a known invalid access to its specified
result. Dynamic indices retain logical bounds checks. These rules also apply when optional linear-memory guards
are disabled: an array's element boundary is part of the operation's semantics. Existing raw byte operations keep
their current guard policy.

Bit stores use a byte read-modify-write sequence and are non-atomic. Concurrent writers to different bits of the
same byte can overwrite each other's changes. Shared-memory ownership therefore needs to cover the containing
byte. Atomic bit manipulation would require a separate language and memory-ordering design.

## Byte addresses and metadata queries

The existing [metadata queries](../../packages/compiler/docs/prefixes.md) keep their units explicit. For
`bit[] flags 10`:

| Expression | Proposed result |
| --- | --- |
| `count(flags)` | 10 logical elements |
| `min(flags)` / `max(flags)` | 0 / 1 |
| `&flags` | An `int8u*` view of the backing bytes, starting at the declaration's byte address |
| `end(flags)` | The exclusive byte address after its two data bytes, excluding allocation padding |
| `sizeof(flags)` | A compile-time error: a logical element has no whole-byte size |

`sizeof` continues to mean element size in bytes. Assigning a bit element a size of zero, one, or a fraction
would make existing byte-offset calculations misleading. This iteration does not add a universal bit-size query.

Taking an indexed address, such as `&flags[3]`, is rejected. No bit can yet be addressed independently through a
pointer. Taking `&flags` exposes the whole backing byte sequence, with byte element metadata:

```8f4e
bit[] flags 10
int8u* bytes &flags

; count(flags) is 10.
; count(*bytes) is 2.
; sizeof(*bytes) is 1.

push bytes
push 0
push count(*bytes)
fill
```

The byte view's tracked count and range must describe `B` bytes, rather than reusing the logical count `N`.
Arithmetic on this view uses the existing byte-address rules. A raw byte write can update several logical bits
at once; subsequent bit reads observe those changes.

For bit arrays, the generic formula `end = start + count * sizeof` is replaced by `end = start + ceil(count / 8)`.
Code that needs physical spans must use the layout metadata or a byte view, rather than assuming every element
has a whole-byte stride.

## Binary textures and row padding

A bit array is a flat sequence. It carries no image width, height, or row stride. The
[texture runtime's `1bit` format](../../packages/editor/plugins/texture-runtime/README.md) instead starts every
image row on a byte boundary. These layouts coincide when the image width is a multiple of eight.

For the current Rule 110 dimensions, this declaration would use the existing texture layout directly:

```8f4e
bit[] pixels 65536
; @textureUpload &pixels 1bit 256 256
; @texture &pixels 2 256 256
```

For a 10 by 2 image, twenty densely packed bits occupy three bytes, while the texture requires four bytes. A
compatible flat array can reserve 32 bits: row zero starts at index 0, row one starts at index 16, and each row
has ten visible pixels. The extra positions are ordinary array elements; the grid API supplies the stricter
pixel bounds and treats the remaining row positions as padding.

The existing `loadBitAt2D` and `storeBitAt2D` functions already implement that pixel-boundary policy through a
byte view. A future grid declaration could capture the dimensions and stride explicitly, but this proposal does
not infer them from texture directives or change array layout when a view is added.

## Compiler and host contracts

The [memory contracts](../../packages/compiler/packages/language-spec/src/memory.ts) currently describe a whole
byte width per element. Packed arrays need an explicit layout distinction between ordinary byte-sized elements
and packed bits. The contract must retain:

- Logical element count and logical element width of one bit.
- MSB-first packing and the physical data-byte length `B`.
- Byte start and exclusive byte end addresses.
- Reserved allocation units and allocation padding independently of data bytes.

The packed layout must not invent an `elementWordSize` value that makes byte-oriented consumers appear compatible.
A discriminated layout should require consumers to handle packing explicitly. The exact TypeScript shape belongs
in the implementation design; changing the existing public metadata contract may require a breaking release.

The compiler stages would own the work as follows:

| Owner | Required behavior |
| --- | --- |
| Language spec and tokenizer | Recognize `bit[]`, array-target operands, and the two indexed instructions. |
| Semantic resolution | Resolve bit-array targets and counts, reject invalid types and queries, and classify memory effects. |
| Memory planning and defaults | Plan packed spans and allocation alignment; encode packed initializer bytes. |
| Stack analysis | Require integer indices and values, retain logical bounds, and record proven access facts. |
| Wasm lowering | Emit guarded bit extraction and byte read-modify-write operations. |

All hosts continue to use the same shared, byte-addressed `host.memory` import. The first iteration adds no
WebAssembly value type and changes no function calling convention. Memory-plan consumers need explicit handling:

- Editor watches display logical values as 0 or 1 and resolve logical indices to a byte plus a bit position.
- Generic byte views and texture uploads use physical byte spans.
- CLI `run --dump` reads logical element values; JSON array writes normalize integer values.
- CLI raw capture and binary loading operate on packed data bytes, excluding allocation padding.
- Group exposures, prototype expansion, and pointer count propagation preserve the appropriate logical or byte
  view instead of multiplying the logical count by a fabricated byte width.

These updates must land together before exposing the declaration in normal projects. Source compatibility for
existing array types and byte-oriented instructions remains unchanged.

## Performance and adoption

Packing reduces data size and upload size relative to one byte per value. It does not guarantee faster per-element
execution: a bit write includes a read-modify-write, and several writes can target the same byte.

Byte views remain useful for programs such as Rule 110, which generates eight cells from neighboring bytes and
stores a complete byte at a time. Adopting a bit-array declaration should preserve that option. Compiler
optimizations that combine individual bit operations must preserve observable reads and writes.

An initial implementation should establish declarations, defaults, indexed operations, and metadata in compiler
fixtures; then update editor and CLI consumers; then exercise both individual-bit access and packed-byte access
in examples. The current stdlib helpers provide reference behavior for grid bounds and bit order.

## Possible bit pointer extension

First-class bit references would become useful when functions need to accept an arbitrary logical bit location,
return a location, or traverse bit arrays while retaining logical bounds. A later proposal could introduce `bit*`
and allow `&flags[index]` to construct one.

That design would need to settle:

- Representation: a byte address plus bit offset, or an encoded bit address with a defined address-range limit.
- Arithmetic units, bounds provenance, equality, casts, storage, and function parameter and return conventions.
- The relationship between `load`/`store` and the explicit indexed bit instructions.
- Element-size queries when the pointee occupies less than one byte.
- Access permissions, including the internal byte read needed for a bit write, alongside
  [Pointer Access Qualifiers](051-pointer-access-qualifiers.md).
- Atomic operations and synchronization when concurrent writers share a byte.

The first iteration's `&flags` remains a byte-storage view. Adding indexed bit addresses later must not silently
change the meaning of that existing expression or implicitly reinterpret byte pointers as bit pointers. This
boundary should also be reviewed alongside [Pointer-Typed Memory Access](047-pointer-typed-memory-access.md).

## Alternatives and open questions

Keeping all packed data in stdlib functions remains a viable alternative. It avoids a new declaration kind, while
callers continue to carry logical counts and tools continue to see byte arrays. The language feature becomes
worthwhile when logical introspection and compiler-known bounds serve several projects beyond one texture demo.

Immediate general bit pointers would provide more flexible function composition, but would also require the
representation, ABI, and permission decisions listed above. The named-array operations give a smaller first step.

Before implementation, review these choices:

- Are `loadBit array` and `storeBit array` the preferred surface syntax, or should indexed value syntax be part
  of the initial feature?
- Is rejecting `sizeof(bitArray)` sufficient, or is a general element-bit-width query needed at the same time?
- Does passing bit-array views between functions justify a bounded view type before general `bit*` pointers?
- Should a later grid type capture row stride, or should row padding remain entirely in stdlib and consumers?

## Validation requirements

- Verify counts 0, 1, 7, 8, 9, and larger arrays across byte and allocation boundaries.
- Check prefix initializers, nonzero normalization, sparse defaults, padding, and repeated `initDefaults()` calls.
- Check first and last valid indices, negative and oversized indices, and logical guards with linear guards both
  enabled and disabled.
- Prove stores preserve neighboring bits, trailing data-byte padding, allocation padding, and adjacent declarations.
- Check metadata queries, rejected element addresses, and the byte view's physical count, size, and end boundary.
- Exercise qualified access from impure functions, prototype expansion, group exposures, and effect diagnostics.
- Verify editor and CLI logical reads and writes alongside byte capture, loading, and bulk fills.
- Verify texture compatibility for byte-aligned widths and explicitly padded odd widths.
- Compare Rule 110's rendered pixels with the existing byte-based reference while retaining its packed-byte
  generation path.
