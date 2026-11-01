# Memory instructions

For identifier prefixes and suffixes that expand memory identifiers, see [Identifier prefixes](../prefixes.md).

In functions, memory instructions require the `#impure` compiler directive. Even in impure functions, memory access must be address-driven: functions still cannot reference module memory identifiers by name or declare their own memory.

Memory access instructions are non-trapping for out-of-bounds addresses. When the compiler cannot prove that an address is within a safe memory range, it emits a runtime bounds guard. Guarded loads return `0` when the address is out of bounds, and guarded stores skip the write.

### load

The load instruction consumes an address from the stack and pushes the 32-bit integer value stored at that address.
If the address is out of bounds, it pushes `0` instead of trapping.

#### Examples

```
int input 42
push &input
load
```

### load8s

The load8s instruction consumes an address from the stack and loads an 8-bit signed integer from memory, sign-extending it to 32 bits.
If the address is out of bounds, it pushes `0` instead of trapping.

#### Examples

```
int8[] buffer 1 -1
push &buffer[0]
load8s
```

### load8u

The load8u instruction consumes an address from the stack and loads an 8-bit unsigned integer from memory, zero-extending it to 32 bits.
If the address is out of bounds, it pushes `0` instead of trapping.

#### Examples

```
int8[] buffer 1 127
push &buffer[0]
load8u
```

### load16s

The load16s instruction consumes an address from the stack and loads a 16-bit signed integer from memory, sign-extending it to 32 bits.
If the address is out of bounds, it pushes `0` instead of trapping.

#### Examples

```
int16[] buffer 1 -1
push &buffer[0]
load16s
```

### load16u

The load16u instruction consumes an address from the stack and loads a 16-bit unsigned integer from memory, zero-extending it to 32 bits.
If the address is out of bounds, it pushes `0` instead of trapping.

#### Examples

```
int16[] buffer 1 32000
push &buffer[0]
load16u
```

### loadFloat

The loadFloat instruction consumes an address from the stack and pushes the floating-point value stored there.
A typed `float64*` address loads an eight-byte `float64` value. Other addresses, including untyped integers, retain the existing four-byte `float` behavior.
If the complete value is out of bounds, it pushes zero of the matching floating-point type instead of trapping.

#### Examples

```
float input 1.25
push &input
loadFloat
```

```
float64 precise 1.0000000000000002f64
push &precise
loadFloat
```

### store

The store instruction consumes a value and an address from the stack and stores the value at the address.
If the address is out of bounds, the write is skipped instead of trapping.

#### Examples

```
int output
push &output
push 10
store
```

### storeBytes

The storeBytes instruction pops a destination address from the top of the stack, then pops `N` byte values and writes them contiguously to memory in pop order (first pop → `dst + 0`). Each value is truncated to a byte before storing.
Out-of-bounds byte writes are skipped instead of trapping. If only part of the range is in bounds, the in-bounds bytes are still written and the out-of-bounds bytes are skipped.

Stack layout before call: `... , byte1 , byte2 , ... , byteN , dstAddress`

#### Examples

```
int8[] buffer 8
push 72
push 101
push 108
push 108
push 111
push &buffer
storeBytes 5
```

### memoryCopy

The memoryCopy instruction takes a compile-time byte count argument, consumes a destination address and source address from the stack, then copies that many bytes within linear memory. Overlapping ranges are supported, matching WebAssembly `memory.copy` behavior.
If either source or destination range is out of bounds, the copy is skipped instead of trapping.

Stack layout before call: `... , dstAddress , srcAddress`

#### Examples

```
int[] source 5
int[] target 5
push &target
push &source
memoryCopy 20
```

### clampAddress

The clampAddress instruction consumes an address and clamps it to the tracked address range carried by that stack value.
It pushes the clamped address back onto the stack and marks it safe for the requested access width, so later load and store instructions can avoid emitting their own runtime guard.

The optional argument is the access width in bytes. If omitted, it defaults to the global alignment boundary, currently `4` bytes.
Supported access widths are `1`, `2`, `4`, and `8`; compile-time expressions such as `sizeof(buffer)` are accepted when they resolve to one of those widths.
The compiler reports an error if the input address does not carry address range metadata, because there is no known range to clamp against.

The last valid address is `rangeEnd - accessWidth`. If the tracked range is shorter than the requested access width, the compiler reports an error because there is no address in that range that can safely satisfy the requested access.

#### Examples

```
int[] buffer 32
push &buffer
push 1024
add
clampAddress
load
```

```
int8[] bytes 16
push &bytes
push 1024
add
clampAddress 1
load8u
```

### clampModuleAddress

The clampModuleAddress instruction consumes an address and clamps it to the current module memory range.
It is available inside modules and uses the same optional access-width argument as clampAddress, defaulting to the global alignment boundary.

#### Examples

```
push 999999
clampModuleAddress
load
```

### clampGlobalAddress

The clampGlobalAddress instruction consumes an address and clamps it to the whole WebAssembly linear memory.
It is useful when the address did not come from a tracked 8f4e memory declaration but should still be made non-trapping before a memory access.

The optional argument is the access width in bytes and defaults to the global alignment boundary. Supported widths are `1`, `2`, `4`, and `8`, including compile-time expressions such as `sizeof(buffer)` when they resolve to one of those values. The last valid start address is based on the current WebAssembly memory size at runtime.

#### Examples

```
push externalAddress
clampGlobalAddress
load
```
