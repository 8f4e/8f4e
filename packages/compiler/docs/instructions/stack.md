# Stack instructions

### push

The push instruction pushes a literal, constant, local, memory value, or address onto the stack.
For a [fixed reference slot](declarations-and-locals.md#fixed-reference-slots), `push slot` pushes its compile-time
target address and `push *slot` reads the current target value with one load. For `int*&`, `int16*&`, and
`float*&`, that first load returns a pointer, and `push **slot` follows the pointer and reads the selected value.
For identifier prefixes and metadata queries that expand memory identifiers, see [Identifier prefixes](../prefixes.md).

Float64 literals use the `f64` suffix; unsuffixed float literals default to float32.
For constants, `push` also supports compile-time expressions with exactly one operator:
- `CONST+number`
- `CONST-number`
- `CONST*number`
- `CONST/number`

Compile-time values can be converted explicitly to integers with `round(...)`, `floor(...)`, or `ceil(...)`. Each helper
accepts either one compile-time operand or one supported one-operator expression.

A quoted string literal is expanded at compile time into one `i32.const` per byte (in source order).
Supported escape sequences: `\"`, `\\`, `\n`, `\r`, `\t`, `\xNN`.

#### Local reads

`push <local>` is the canonical form for reading a local variable onto the stack.
It preserves the complete stack metadata for the local type including `float64` precision.

**Identifier resolution rule**: when a plain identifier appears as the argument to `push`, locals are
checked before module memory. If the name is a declared local it is treated as a local read even if a
module memory item with the same name exists. This makes `push <local>` unambiguous within function
and module scope.

#### Examples

```
const SIZE 8
push 1
push 2.5
push 3.14f64
push 1e-10f64
push "hello"
push "line1\nline2"
push "\x41\x42"
push SIZE/2
push round(SIZE/3)
local int temp
push temp
local float64 x
push x           ; pushes x as float64, preserving full precision
```

### drop

The drop instruction removes the top value from the stack.

#### Examples

```
push 1
drop
```

### clearStack

The clearStack instruction removes all values from the stack.

#### Examples

```
push 1
push 2
clearStack
```
