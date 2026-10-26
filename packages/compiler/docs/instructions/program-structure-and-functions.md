# Program structure and functions

## Block Instructions

Block instructions define the structure of your program. See detailed documentation in the `blocks/` folder:

- [Module blocks](./blocks/module.md) - `module` and `moduleEnd`
- [Prototype blocks](./blocks/prototype.md) - `prototype`, `prototypeEnd`, and `shape`
- [Function blocks](./blocks/function.md) - `function`, `param`, `paramShape`, and `functionEnd`
- [Constants blocks](./blocks/constants.md) - `constants` and `constantsEnd`

## Other Instructions

### expose

Inside a group, `expose <name> &<module>:<memory>` gives a direct child module's memory item a public name:

```8f4e
expose input &processor:input
```

The alias uses the backing declaration's type and allocates no additional memory. Editors derive control types and
connector direction from that declaration: pointers are inputs, and non-pointers are outputs.

### init

Inside a group, `init` overrides the default value of an exposed scalar memory item. Values can be numeric literals
or the start address of named memory in the group's immediate parent project:

```8f4e
entry main
module source
float output 0.5
moduleEnd

group synth
expose foo &processor:foo
expose gain &processor:gain
expose input &processor:input
init &foo 11
init &gain 0.5
init &input &source:output

module processor
int foo 3
float gain 0.25
float* input
moduleEnd
groupEnd
entryEnd
```

The syntax is `init &<exposed-memory> <number>` or `init &<exposed-memory> &<module>:<memory>`. The destination resolves
against this group's exposures and must refer to a scalar declaration, including a scalar inherited from a shape.
Arrays cannot be initialized as a whole through `init`.

Numeric values use ordinary literal syntax, including zero, negative numbers, hexadecimal, binary, and `f64` suffixes.
The backing declaration determines storage and conversion, just as for an ordinary declaration default. For example,
`init &foo 11.75` initializes an `int` item to `11`. Pointer declarations can also receive numeric defaults, such as `0`.

For address values, the source module or group name resolves in the immediate parent project. A source group can supply
one of its exposed memory items. For example, `init &input &source:output` inside `audio/synth` resolves its source to
`audio/source:output`, even if `synth` also contains a module named `source`. Sources use a single module/group name,
without a canonical path or ancestor search. Named constants, symbolic expressions, indexed slots, and end addresses
are not accepted.

An initializer overrides the backing declaration's default. Items without an initializer keep their declaration
defaults. Multiple initializers for the same backing memory item are an error, including when different exposed names
refer to it.

Initializers participate in `initDefaults()` and are ready before any entry's modules execute. Address initializers
also provide available pointee element counts to pointer analysis. Source declarations remain
unchanged, and an initializer allocates no additional memory.

`init` is valid only at group level. Root project scope, entry scope, and module/function bodies cannot contain it.

### call

The call instruction invokes a function by name, consuming its arguments from the stack and pushing its return values.

#### Examples

```
push 2
push 3
call add
```

Inline call arguments are emitted as `push` instructions immediately before the call:

```
call add 2 3
```

This is equivalent to the previous example. Inline arguments use normal `push` semantics, so literals, constants, locals, memory identifiers, pointers, and strings behave the same as if each value had been written on its own `push` line.

Calls can target 8f4e-defined functions, host-provided imported functions, or execution entries.

### Imported functions

Imported functions use the normal function block shape, with a `#import` directive in the function prologue:

```8f4e
function hostLog
#import log
param int value
functionEnd
```

The signature is declared with `param` and `functionEnd`, then calls work like any other function:

```8f4e
module main
push 42
call hostLog
moduleEnd
```

At instantiation time, the host must provide the matching WebAssembly import:

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

Imported functions can return values:

```8f4e
function addOne
#import "add.one"
param int value
functionEnd int

module main
push 41
call addOne
; stack now contains 42
moduleEnd
```

Only directives, `param`, and `functionEnd` are allowed in imported functions. They cannot contain executable 8f4e instructions because their implementation is supplied by the host.

See [Compiler directives](../directives.md#import) for the full `#import` rules and error cases.

### use

The use instruction imports constants from another namespace into the current one.

#### Examples

```
use math
push TAU
```

#### Notes

- Constants can be imported from both constants blocks and modules
- Multiple `use` statements can be used in sequence
- When the same constant name exists in multiple namespaces, the last `use` statement wins
