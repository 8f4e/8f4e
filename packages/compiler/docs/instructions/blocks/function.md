# Function Block

## function

The function instruction begins a function block with the provided name.

### Examples

```
function add
param int x
param int y
push x
push y
add
functionEnd int
```

### Usage

Functions are reusable code blocks that:
- Can accept parameters using the `param` instruction
- Can return values (specified in `functionEnd`)
- Can be called from modules or other functions using the `call` instruction
- Can call execution entries using the `call` instruction
- Are pure by default
- Can opt into explicit address-driven memory IO with `#impure`
- Can be exported to the host WebAssembly ABI with `#export` or `#export <exportedName>`
- Can be declared as host-provided WebAssembly imports with `#import <fieldName>`
- Do not have direct access to module memory identifiers by name
- Cannot declare their own memory

### Overloads

Functions may share the same source name when each version has a distinct parameter signature:

```
function convert
param int value
push value
functionEnd int

function convert
param float value
push value
functionEnd float
```

Calls still use the source name:

```
push 12
call convert

push 1.5
call convert
```

Overload resolution is an exact match against the stack operand types. Return types do not distinguish overloads, and scalar types are not implicitly converted.

Overload sets must use the same positive arity. A zero-parameter function name can only have one implementation. Duplicate parameter signatures are rejected, even when the return types differ.

Pointer overloads require pointer type metadata. Known addresses such as `push &samples` carry their pointee type, but raw integer addresses are treated as integers.

Overloaded functions cannot be exported directly. Use a uniquely named wrapper function when a host-visible export needs to call an overloaded helper.

### `#impure`

Use `#impure` inside a function to allow explicit memory reads and writes through addresses already on the stack or passed via params/locals.

```
function fillBlepBuffer
#impure
param float* dst
param float* src
param float gain

push dst
push src
loadFloat
push gain
mul
store
functionEnd
```

### `#export`

Use `#export` inside a function to export it from the generated WebAssembly module under the function name.
Use `#export <exportedName>` to provide a different host-visible name.

```
function onMidiCC
#export
param int channel
param int controller
param int value
functionEnd
```

Host code calls exported functions with positional numeric arguments:

```ts
(instance.exports.onMidiCC as CallableFunction)(channel, controller, value);
```

Argument mapping:

- `int` maps to Wasm `i32` and a JavaScript `number`
- `float` maps to Wasm `f32` and a JavaScript `number`
- `float64` maps to Wasm `f64` and a JavaScript `number`

Export names must be unique and must not reuse built-in exports such as `initDefaults` or an execution entry name.
Each function may declare `#export` once. Repeating the directive within one function is a syntax error; duplicate export
names across different functions are checked during semantic validation.
Overloaded functions cannot use `#export`; export a uniquely named wrapper instead.
Functions that read from or write to memory still need `#impure`.

### `#import`

Use `#import <fieldName>` inside a function to declare that the function is provided by the WebAssembly host.

```
function hostLog
#import log
param int value
functionEnd
```

Imported functions still declare their signature with `param` and `functionEnd`, and callers use the normal `call` instruction:

```
push 42
call hostLog
```

The host must provide a matching import when instantiating the module:

```ts
await WebAssembly.instantiate(codeBuffer, {
	host: {
		memory,
		log(value: number) {
			console.log(value);
		},
	},
});
```

Use string literals when the WebAssembly import field name is not a plain 8f4e identifier:

```
function addOne
#import "add.one"
param int value
functionEnd int
```

Imported functions cannot contain executable 8f4e body instructions, cannot also use `#export`, and are treated as impure.

Function compiler directives are prologue metadata: place `#impure`, `#export`, `#import`, and `#loopCap` directly after the `function` line and before params, locals, or executable instructions.

### Example Function

```
function calculateDistance
param float x1
param float y1
param float x2
param float y2
local float dx
local float dy

; dx = x2 - x1
push x2
push x1
sub
localSet dx

; dy = y2 - y1
push y2
push y1
sub
localSet dy

; dx * dx
push dx
push dx
mul

; dy * dy
push dy
push dy
mul

; dx*dx + dy*dy
add

; sqrt(dx*dx + dy*dy)
sqrt

functionEnd float
```

## param

The param instruction declares a function parameter (`param int name`, `param float name`, or a pointer type such as `param int8u* bytes`). Parameters must be declared before any other function body instructions. A `param` or `paramShape` after a local declaration or executable instruction produces a `PARAM_AFTER_FUNCTION_BODY` syntax error.

### Examples

```
function double
param int x
push x
push 2
mul
functionEnd int

function readUnsignedByte
#impure
param int8u* bytes
push *bytes
functionEnd int
```

Callers can provide arguments on the stack or inline after the function name:

```
push 21
call double

call double 21
```

Inline call arguments are compiled as `push` instructions before the call, so they follow the same value rules as `push`.

### Notes

- Parameters must be declared immediately after the function declaration
- Parameter names must be unique within the function
- Parameters can be accessed using `push` and modified using `localSet`

## paramShape

The `paramShape` instruction expands a prototype's scalar memory declarations into typed pointer parameters. It takes
one prototype name and must appear with the other parameter declarations, before locals or executable instructions. Fields
are expanded in prototype declaration order. Each scalar field becomes a pointer parameter with the same name and base type;
read a field with `push *<field>` inside an impure function.

The prototype and the function can be defined independently of the consuming module:

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
```

In a module, `shape` materializes the prototype fields and `pushShape` pushes their addresses in the same order. The
function receives pointers, not copied field values, so `sumMixer` returns `6.5` here:

```8f4e
entry main
module mixer
shape mixerState
pushShape mixerState
call sumMixer
; stack: 6.5
moduleEnd
entryEnd
```

Explicit parameters and `paramShape` share one positional signature and preserve source order. For example, with
`param int base`, `paramShape mixerState`, and `param int tail`, callers push `base`, then `pushShape mixerState`, then
`tail` before `call`; the shape pointers occupy the middle positions.

The module's effective fields are used when a shape is overridden locally. Replacing the materialized fields with
`int a 8` and `float b 1.5` makes the same `pushShape mixerState` and `call sumMixer` return `9.5`.

## functionEnd

The functionEnd instruction ends a function block and declares the return types (`functionEnd int float` or pointer types such as `functionEnd int16u*`).

### Examples

```
function getFortyTwo
push 42
functionEnd int
```

### Return Values

Functions can return zero or more values:

```
; No return value
function doSomething
; code here
functionEnd

; Single int return
function getNumber
push 42
functionEnd int

; Single float return
function getFloat
push 3.14
functionEnd float

; Multiple returns
function getCoordinates
push 10
push 20
functionEnd int int
```

### Notes

- The stack must exactly match the declared return signature when reaching `functionEnd`; raw integers and pointer
  types are not interchangeable, and pointer base types and depths must match
- Return types are specified as space-separated type names after `functionEnd`
- Signature types include `int`, `float`, `float64`, and pointer types over `int`, `int8`, `int8u`, `int16`, `int16u`, `float`, and `float64`, with one or two `*` suffixes.
