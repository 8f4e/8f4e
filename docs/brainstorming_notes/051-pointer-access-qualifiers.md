# Pointer Access Qualifiers

Date: 2026-10-14

This note explores distinguishing read-only, write-only, and read/write pointers in 8f4e. The syntax and rules below
are a proposal, not implemented language behavior or a finalized implementation plan.

## Motivation

Pointer access modes could express the direction of data flow in module connections and function parameters:

- input buffers permit reading;
- output buffers permit writing;
- internal state permits both reading and writing.

The compiler could reject accidental writes to inputs and accidental reads from outputs. The access mode describes
what a particular pointer permits; it does not imply that the underlying memory is immutable or exclusively owned.

## Proposed Syntax

Attach a short access qualifier directly to each pointer marker: `*r`, `*w`, or `*rw`.

| Type | Access through the pointer |
| --- | --- |
| `float*r` | Read-only |
| `float*w` | Write-only |
| `float*rw` | Read and write |

The type stays in one token, fitting the existing declaration instructions and the type arguments to `param` and
`local`:

```8f4e
float*r input &source:samples
float*w output &destination:samples
float*rw state &buffer

local int*r cursor
```

Suggested default: an unqualified `*` means `*rw`, preserving the meaning of existing pointer declarations. Explicit
qualifiers would be encouraged on function parameters and module connections.

The qualifier applies to the pointee, not to the pointer binding. A read-only pointer can still be advanced or
reassigned, provided the new value satisfies its declared type and access requirements.

## Function Parameters

Function parameters use the same notation:

```8f4e
function copySample
#impure
param float*r source
param float*w destination

push destination
push source
loadFloat
store
functionEnd
```

Loading through `destination` or storing through `source` would be a compile-time error. Reading a pointer value with
`push destination` remains allowed: obtaining the address is different from reading the memory it points to.

## Access Rules

- Loads, including typed loads and inline dereferencing, require read permission at the level being dereferenced.
- Stores require write permission at the destination level.
- Bulk operations apply the same rules: copying requires a readable source and a writable destination.
- Pointer arithmetic preserves the access mode.
- A read/write pointer can supply read-only or write-only access to the same pointee type at the outermost level.
- A restricted pointer cannot implicitly gain additional permissions.
- Pointer values must retain their access mode through stack operations, locals, parameters, returns, and storage.

Access qualifiers alone do not provide Rust-style borrowing, lifetime checks, or exclusive access. Other aliases may
still modify memory reached through a read-only pointer.

## Multiple Pointer Levels

Each `*` owns its qualifier. The rightmost pointer marker is the outermost level:

```8f4e
int*r*rw pointers
```

Reading from right to left, this is a read/write pointer to a slot containing a read-only pointer to an integer.
Reading or replacing the pointer in that slot is allowed; writing the integer through the retrieved pointer is not.

Conversions involving inner pointer levels need separate rules. Weakening access on an inner pointer must not allow
an alias to replace a pointer slot with a value that violates another alias's declared permissions. The simple
outermost permission reduction rule should not automatically apply recursively.

## Precedents

- [C/C++ pointer-to-const types](https://learn.microsoft.com/en-us/cpp/cpp/const-cpp) distinguish read-only access
  (`const T*`) from read/write access (`T*`).
- [Zig pointers](https://ziglang.org/documentation/master/#Pointers) similarly distinguish `*const T` from `*T`.
- [Rust references](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) distinguish shared `&T`
  references from exclusive `&mut T` references, with borrowing restrictions beyond access permissions.
- [GLSL memory qualifiers](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#memory-qualifiers)
  provide `readonly` and `writeonly` access to images and shader storage buffers. These are resource qualifiers
  rather than general pointer types, but they are a precedent for strictly write-only access.

## Open Questions

- Should bare `*` retain read/write access, or should access qualifiers eventually become mandatory?
- How should taking the address of a qualified pointer slot preserve permissions at every level?
- How should parameter matching and overload resolution handle permission reduction?
- Which multi-level pointer conversions are safe, and which should require an exact inner type match?
- How should raw integer addresses and explicit pointer conversions interact with access permissions?
- Should qualifiers also inform the editor's visual representation of module inputs and outputs?

The raw-address question connects this proposal to [Pointer-Typed Memory Access](047-pointer-typed-memory-access.md).
If restricted pointers can be converted to integers and reconstructed with unrestricted access, the access contract
needs a defined escape boundary.
