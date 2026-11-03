# Prototype Block

Prototype blocks define reusable module memory shapes. A prototype contains memory declarations and their default values;
it does not allocate storage or contain executable instructions. A module expands a prototype with `shape`, receiving its
own declarations and storage.

## prototype

`prototype <name>` starts a prototype block. It is a top-level block and takes one name. Use ordinary scalar and array
declarations inside it to describe the fields that consuming modules should receive.

## prototypeEnd

`prototypeEnd` ends the current prototype block. A prototype may contain declarations only; executable instructions are
not allowed between `prototype` and `prototypeEnd`.

## shape

`shape <prototypeName>` expands a prototype into the current module. The expansion copies the prototype's declarations
and defaults into that module. Each consuming module receives independent storage, so changing one module's fields does
not change another module's fields.

`shape` is a module-level instruction. Fields are inserted at the position of the instruction, relative to local
declarations before and after it.

### Complete example

This project uses one prototype in two modules. Both modules receive `phase` with its default value of `0` and
`frequency` with its default value of `440`. `oscA` expands the shape first, so its local field follows the shape;
`oscB` declares its local field first, so the shape follows that field. The address comparisons demonstrate both layout
orders and the final comparison demonstrates independent storage.

```8f4e
8f4e/v1

note
; @config testRuntime.enabled true
noteEnd

prototype oscillatorState
float phase
float frequency 440
prototypeEnd

entry test
module oscA
shape oscillatorState
int localA 11

push phase
assertEqual 0.0
push frequency
assertEqual 440.0
push localA
assertEqual 11
push &phase
push &frequency
lessThan
assertEqual 1
push &frequency
push &localA
lessThan
assertEqual 1
moduleEnd

module oscB
int localB 22
shape oscillatorState

push localB
assertEqual 22
push phase
assertEqual 0.0
push frequency
assertEqual 440.0
push &localB
push &phase
lessThan
assertEqual 1
push &phase
push &oscA:phase
notEqual
assertEqual 1
moduleEnd
entryEnd
```

The assertions verify that `phase` defaults to `0`, `frequency` defaults to `440`, each module retains its local
default, fields appear at the expected position, and `&oscB:phase` is different from `&oscA:phase`.

### Local overrides

A module can declare a field with the same name as an inherited field. The local declaration overrides the inherited
field's effective default and addressable declaration. Repeated local declarations currently use last-local-declaration-
wins behavior.

```8f4e
8f4e/v1

note
; @config testRuntime.enabled true
noteEnd

prototype baryon
int foo 1
int he 2
int bar 3
prototypeEnd

entry test
module tau
shape baryon
int he 10
int bar 44
int bar 8
int bar 16

push foo
assertEqual 1
push he
assertEqual 10
push bar
assertEqual 16
moduleEnd

module boson
int* test2 &tau:foo
int* test1 &tau:bar
int* test3 &tau:he

push *test2
assertEqual 1
push *test1
assertEqual 16
push *test3
assertEqual 10
moduleEnd
entryEnd
```

In `tau`, `foo` remains `1`, `he` resolves to the local default `10`, and `bar` resolves to the final local
declaration's default `16`. In `boson`, intermodule references likewise resolve to the inherited `foo`, the final
local `bar`, and the overriding local `he`. These are declarations in `tau`; an override does not write to shared
prototype storage because prototype storage is never shared.

## Placement and behavior

- `prototype` and `prototypeEnd` are top-level and cannot be nested in modules or functions.
- A prototype is a reusable description, not a module and not an executable block.
- `shape` is valid in a module and expands fields at the instruction's position.
- A module can use a prototype once or multiple modules can use the same prototype.
- Fields inherited from a shape participate in normal address and intermodule reference resolution.
- Function-side `paramShape` and `pushShape` are separate features and are not covered here.
