# Allocation units

The memory planner uses a fixed 4-byte allocation grid, defined by `ALLOCATION_UNIT_BYTE_SIZE` from
`@8f4e/language-spec`. Declaration metadata describes this grid separately from typed element widths:

- `allocationUnitAddress` is the absolute address of the first element in allocation units. Multiply it by
  `ALLOCATION_UNIT_BYTE_SIZE` to obtain `byteAddress`.
- `allocationUnitCount` counts reserved units, including any leading alignment padding.
- For declarations, `allocatedByteLength` describes storage from the aligned `byteAddress`, excluding any leading
  alignment padding.
- `elementWordSize` is the byte width of one typed element. `elementByteLength` is the actual element data size,
  excluding padding. These names and meanings are unchanged.

For example, an aligned `float64` occupies two allocation units with an 8-byte element width. Four `int8[]` elements
occupy one allocation unit with a 1-byte element width. A `float64` declaration starting after an odd allocation-unit
offset needs one padding unit, which is included in its count but not its `allocatedByteLength`.

Module metadata exposes `allocationUnitCount` and `allocatedByteLength` for the complete module allocation; at the
module level, `allocatedByteLength` is `allocationUnitCount * ALLOCATION_UNIT_BYTE_SIZE`.
The `startingMemoryAllocationUnitAddress` compile option selects the first module's starting address in allocation
units; its default of `1` corresponds to byte address `4`.

## API migration

This is a breaking rename. Update callers and consumers of compiled memory metadata using this mapping:

| Previous name | Replacement |
| --- | --- |
| `GLOBAL_ALIGNMENT_BOUNDARY` | `ALLOCATION_UNIT_BYTE_SIZE` |
| `startingMemoryWordAddress` | `startingMemoryAllocationUnitAddress` |
| `wordAlignedAddress` | `allocationUnitAddress` |
| `wordAlignedSize` | `allocationUnitCount` |
| `wordAlignedByteLength` | `allocatedByteLength` |

The field renames also apply to editor/compiler-worker `MemoryValueChange` payloads. No compatibility aliases are
provided. Allocation, alignment, defaults, memory-access widths, and emitted WebAssembly are unchanged.
