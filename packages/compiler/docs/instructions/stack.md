# Stack instructions

### push

The push instruction pushes a literal, constant, local, memory value, or address onto the stack.
For identifier prefixes and suffixes that expand memory identifiers, see [Identifier prefixes](../prefixes.md).

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

### pushShape

The `pushShape` instruction takes one prototype name and pushes the addresses of the current module's effective fields
for that shape. The module must declare the shape with `shape <prototypeName>`. Addresses are pushed in prototype
declaration order; field values are not copied. This is the module-side counterpart to
[`paramShape`](blocks/function.md#paramshape).

```8f4e
prototype mixerState
int a 2
float b 4.5
prototypeEnd

function sumMixer
#impure
paramShape mixerState
push *a
castToFloat
push *b
add
functionEnd float

entry main
module mixer
shape mixerState
pushShape mixerState
call sumMixer
; stack: 6.5
moduleEnd
entryEnd
```

`pushShape` supplies one pointer argument per prototype field, so it must be paired with a matching `paramShape` call
signature. If explicit parameters surround `paramShape`, push them in the same source order. For example, a function with
`param int base`, `paramShape mixerState`, and `param int tail` is called with `push base`, `pushShape mixerState`, and
`push tail`, followed by `call`.

The addresses come from the module's effective shape fields. A local declaration override such as `int a 8` and
`float b 1.5` changes the addresses pushed by the same `pushShape mixerState`; it does not change the function signature,
and the example call then reads the overridden values and returns `9.5`.

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
