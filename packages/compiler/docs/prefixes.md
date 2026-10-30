# Identifier prefixes and metadata queries

8f4e supports a small set of identifier prefixes/suffixes that expand memory identifiers into derived values, and function-style metadata queries.

## Memory reference

- `&name` pushes the start address (byte address) of the memory item.
- `&*name` pushes the byte address currently stored in a pointer-typed memory item, without loading the pointee value. It is only valid for pointer-typed identifiers.
- `name&` pushes the start address (byte address) of the final 4-byte allocation unit covering the memory item.
- `&this` pushes the start byte address of the current module.
- `this&` pushes the byte address of the current module's final allocation unit.

These work in both `push` instructions and declaration initializers (e.g., `int* ptr &buffer` or `int* endPtr buffer&`) with the same address semantics.

Examples:

```
int value 1
push &value

int8[] buffer 4
push &buffer[0]

int* moduleStart &this
int* moduleEnd this&

```

## Pointer dereference

- `*name` dereferences a pointer memory item once (via `push`).
- `**name` dereferences a pointer memory item twice (via `push`).
- The pointer depth comes from the declared type (`int*`, `float*`, `int**`, `float**`).
- The number of leading `*` characters in the `push` argument is the requested dereference depth. It must not exceed the declared pointer depth.

Example:

```
int target 123
int* ptr &target
push &ptr    ; address of the pointer slot
push &*ptr   ; address stored in ptr (the start of target)
push *ptr    ; value loaded from target

int** pptr &ptr
push *pptr    ; pushes the address stored in ptr
push **pptr   ; loads target
```

## Element count

- `count(name)` pushes the element count for a buffer (or 1 for scalars).
- `count(*name)` pushes the known element count of the value pointed to by a pointer-typed memory item when the pointer is initialized from a tracked memory start address. Known counts of zero and one are preserved, including through group initializers.
- If the pointer has no tracked pointee element count, `count(*name)` raises `POINTEE_ELEMENT_COUNT_UNKNOWN`. An end-address initializer does not establish a count; pass the length explicitly instead.
- Metadata queries currently support one leading `*`. For double pointers, `count(*name)` describes the intermediate pointer slot. `count(**name)` is not supported yet.

Example:

```
int[] buffer 4
push count(buffer)

int* ptr &buffer
push count(*ptr) ; 4
```

## Element word size

- `sizeof(name)` pushes the element word size (in bytes) for a buffer (or 4 for scalars).

Example:

```
int16[] samples 8 0
push sizeof(samples)
```

## Pointee element word size

- `sizeof(*name)` pushes the element word size (in bytes) of the value pointed to by a pointer-typed memory item.
- Only valid for pointer identifiers (`int*`, `int8*`, `int8u*`, `int16*`, `int16u*`, `float*`, `float64*`, etc.).
- On a non-pointer memory identifier, current compiler behavior resolves `sizeof(*name)` to `0`.
- Metadata queries currently support one leading `*`. For double pointers, `sizeof(*name)` describes the intermediate pointer slot. `sizeof(**name)` is not supported yet.

Examples:

| Declaration         | `sizeof(name)` | `sizeof(*name)` |
|---------------------|----------------|-----------------|
| `int* ptr`          | 4              | 4               |
| `int8* ptr`         | 4              | 1               |
| `int8u* ptr`        | 4              | 1               |
| `int16* ptr`        | 4              | 2               |
| `int16u* ptr`       | 4              | 2               |
| `float* ptr`        | 4              | 4               |
| `float64* ptr`      | 4              | 8               |
| `int** ptr`         | 4              | 4               |
| `float64** ptr`     | 4              | 4               |

```
int* ptr &someInt
push sizeof(ptr)    ; 4  — size of the pointer slot itself
push sizeof(*ptr)   ; 4  — size of the int it points to

float64* fptr &someFloat64
push sizeof(fptr)   ; 4  — size of the pointer slot itself
push sizeof(*fptr)  ; 8  — size of the float64 it points to
```

## Element max value

- `max(name)` pushes the maximum finite value for the element type of a memory item.

For signed integers:
- `int32` / `int` / `int[]`: 2,147,483,647
- `int16` / `int16[]`: 32,767
- `int8` / `int8[]`: 127

For unsigned integers:
- `int8u[]`: 255
- `int16u[]`: 65,535

For floats:
- `float` / `float[]`: 3.4028234663852886e+38 (max finite float32)

Example:

```
int16 value 0
push max(value)

int8u[] unsignedBuffer 10 0
push max(unsignedBuffer)
```

## Pointee element max value

- `max(*name)` pushes the maximum finite value for the type pointed to by a pointer-typed memory item.
- Only valid for pointer identifiers (`int*`, `int8*`, `int8u*`, `int16*`, `int16u*`, `float*`, `float64*`, etc.).
- On a non-pointer memory identifier, current compiler behavior resolves `max(*name)` to `0`.
- `max(name)` keeps its existing meaning (max of the memory item's own element type).
- Metadata queries currently support one leading `*`. For double pointers, `max(*name)` describes the intermediate pointer slot. `max(**name)` is not supported yet.

Examples:

| Declaration         | `max(name)`         | `max(*name)`                       |
|---------------------|---------------------|------------------------------------|
| `int* ptr`          | 2,147,483,647       | 2,147,483,647                      |
| `int8* ptr`         | 2,147,483,647       | 127                                |
| `int8u* ptr`        | 2,147,483,647       | 255                                |
| `int16* ptr`        | 2,147,483,647       | 32,767                             |
| `int16u* ptr`       | 2,147,483,647       | 65,535                             |
| `float* ptr`        | 2,147,483,647       | 3.4028234663852886e+38             |
| `float64* ptr`      | 2,147,483,647       | 1.7976931348623157e+308            |
| `float64** ptr`     | 2,147,483,647       | 2,147,483,647                      |

```
int* ptr &someInt
push max(ptr)    ; 2,147,483,647  — max of the pointer slot type (i32)
push max(*ptr)   ; 2,147,483,647  — max of the int it points to

float64* fptr &someFloat64
push max(fptr)   ; 2,147,483,647  — max of the pointer slot type (i32)
push max(*fptr)  ; 1.7976931348623157e+308  — max of the float64 it points to
```

## Element min value

- `min(name)` pushes the lowest finite value (most negative) for the element type of a memory item.
- `min(*name)` pushes the lowest finite value for the type pointed to by a pointer-typed memory item.
- On a non-pointer memory identifier, current compiler behavior resolves `min(*name)` to `0`.
- `min(name)` keeps its existing meaning (min of the memory item's own element type).
- Metadata queries currently support one leading `*`. For double pointers, `min(*name)` describes the intermediate pointer slot. `min(**name)` is not supported yet.

For signed integers:
- `int32` / `int` / `int[]`: -2,147,483,648
- `int16` / `int16[]`: -32,768
- `int8` / `int8[]`: -128

For unsigned integers:
- `int8u[]`: 0
- `int16u[]`: 0
- `int8u*` pointees: 0
- `int16u*` pointees: 0

For floats:
- `float` / `float[]`: -3.4028234663852886e+38 (lowest finite float32)

Example:

```
int8[] buffer 10 0
push min(buffer)

int8u[] unsignedBuffer 10 0
push min(unsignedBuffer)

int8* ptr &buffer
push min(ptr)    ; -2,147,483,648  — min of the pointer slot type (i32)
push min(*ptr)   ; -128            — min of the int8 it points to

int8u* unsignedPtr &unsignedBuffer
push min(*unsignedPtr) ; 0          — min of the int8u it points to
```

---

## Compile-time arithmetic expressions

Compile-time expressions combine two compile-time-resolvable operands with a single arithmetic operator.
They are evaluated at compile time and produce a constant value; they do not generate any runtime instructions.

Supported operators:

| Operator | Meaning        | Example       |
|----------|----------------|---------------|
| `+`      | Addition       | `SIZE+2`      |
| `-`      | Subtraction    | `SIZE-2`      |
| `*`      | Multiplication | `SIZE*2`      |
| `/`      | Division       | `SIZE/2`      |
| `^`      | Exponentiation | `2^16`        |

Each side can be a numeric literal or a constant name. In memory-aware operands such as `push` arguments and memory declaration arguments, each side can also be a supported metadata query such as `sizeof(name)`, `sizeof(*name)`, `count(name)`, `count(*name)`, `max(name)`, `max(*name)`, `min(name)`, or `min(*name)`.
`const` declarations are resolved in the constant namespace and should use literals and constants only.
Exactly one operator is allowed; chained forms like `2^3^4` or `SIZE*2/4` are not valid.

The result can be converted explicitly to an integer with `round(...)`, `floor(...)`, or `ceil(...)`. Each helper accepts
either one compile-time operand or one supported compile-time expression. `round(...)` selects the nearest integer and
rounds exact halfway values away from zero; `floor(...)` rounds toward negative infinity; `ceil(...)` rounds toward
positive infinity. The conversion is part of compile-time folding and emits no runtime instructions. Rounding helpers
cannot be nested.

**Note**: `^` means exponentiation in compile-time expressions, not bitwise XOR (which is the runtime `xor` instruction).

Examples:

```
const WIDTH  2^16          ; 65536
const TOTAL  SIZE^2        ; SIZE squared
const HALF   SIZE/2        ; integer or float division
const DOUBLE SIZE*2        ; multiplication
const NEAREST round(SIZE/3)
const LOWER   floor(SIZE/3)
const UPPER   ceil(SIZE/3)

int[] buffer round(SIZE*1.5) ; allocate an explicitly rounded number of elements
push sizeof(buf)^2         ; push element word size squared
push 2^EXP                 ; push 2 raised to EXP
```

All of the address and metadata forms above have intermodular counterparts that reference memory declared in a different module. The module name and the memory name (or index) are separated by a colon.

### Module base address

- `&module:` — start byte address of the module's memory allocation.
- `module:&` — byte address of the final allocation unit in the module's memory allocation.

```
module targetModule
int* start &sourceModule:
int* end   sourceModule:&
moduleEnd
```

### Named memory item address

- `&module:name` — start byte address of a named memory item in another module.
- `module:name&` — byte address of the final allocation unit of a named memory item in another module.

```
module targetModule
int* ptr    &sourceModule:buffer
int* endPtr sourceModule:buffer&
moduleEnd
```

### Nth memory item address

- `&module:N` — start byte address of the Nth memory item (0-indexed, by declaration order) within another module.

`&module:0` is equivalent to `&module:` — both resolve to the module's base address. Each subsequent index N steps to the next declared memory item regardless of its size.

```
module sourceModule
int  a 0      ; item 0
int  b 0      ; item 1
int[] c 10    ; item 2 — the whole array counts as one slot
moduleEnd

module targetModule
int* ptrA &sourceModule:0   ; same as &sourceModule:a
int* ptrB &sourceModule:1   ; same as &sourceModule:b
int* ptrC &sourceModule:2   ; same as &sourceModule:c
moduleEnd
```

### Intermodular metadata queries

The `count`, `sizeof`, `max`, and `min` queries all accept a `module:name` pair:

- `count(module:name)` — element count of a memory item in another module.
- `sizeof(module:name)` — element word size (bytes) of a memory item in another module.
- `max(module:name)` — maximum finite value for the element type of a memory item in another module.
- `min(module:name)` — minimum finite value for the element type of a memory item in another module.

```
module targetModule
push count(sourceModule:buffer)
push sizeof(sourceModule:buffer)
push max(sourceModule:buffer)
push min(sourceModule:buffer)
moduleEnd
```
