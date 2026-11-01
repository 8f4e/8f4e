# Introduction to 8f4e

8f4e is a stack oriented programming language with a visual code editor that I created to perform generative music at algorave events.

Its primary target is the WebAssembly virtual machine, as I wanted an efficient yet portable tool for real time audio signal generation and processing.

## Table of Contents

- [Self-Hosting The 8f4e Editor](self-hosting.md)
- [Stack Oriented Execution Model](#stack-oriented-execution-model)
- [Instruction Reference](#instruction-reference)
- [Memory Access and Pointers](#memory-access-and-pointers)
- [Endless Execution Loop](#endless-execution-loop)
- [Memory Layout and Allocation](#memory-layout-and-allocation)
- [Modules and Execution Order](#modules-and-execution-order)
- [Live Variable Editing](#live-variable-editing)
- [Visibility and Memory Safety](#visibility-and-memory-safety)

## Stack Oriented Execution Model

Stack oriented programming means that, instead of using registers, instructions take their operands from a stack and push their results back onto the same stack for the next instruction.

I chose this programming paradigm because the WebAssembly virtual machine is itself a stack machine.

Staying native to this execution model avoids costly abstractions and makes it possible to build a simpler and faster compiler.

```
push 2
push 3
; Pushing values 2 and 3 onto the stack
add
; After executing the add instruction,
; the stack will contain the value 5

push 10
mul
; Now the stack will contain the value 50

push 10
div
; Now 5 again
```

The full instruction set reference lives alongside the compiler docs. See [Instruction Reference](../packages/compiler/docs/instructions.md).

## Memory Access and Pointers

It is also possible to take values from the stack and store them in memory.
For identifier prefixes and suffixes that expand memory identifiers, see [Identifier prefixes](../packages/compiler/docs/prefixes.md).

The language uses C style pointer notation.

```
int result

push &result
push 42
store
; The store instruction takes two values:
; a memory address and the value to store
```

## Endless Execution Loop

Programs in 8f4e run inside an endless loop. This reflects how real time audio systems operate, where processing consists of continuously reading from and writing to audio buffers.

8f4e removes this control flow boilerplate and allows programs to focus purely on signal generation and transformation.

## Memory Layout and Allocation

8f4e programs run inside a sandboxed, contiguous memory space. All variables are laid out sequentially within this space, so variables declared one after another occupy adjacent memory locations.

```
int a 1
int b 1
; Memory address of b is a + word size
int c 1
; Memory address of c is b + word size
```

Memory addresses are determined entirely at compile time — dynamic memory allocation is not supported. Developers must plan their program's memory needs up front during coding.

Because all addresses are known at compile time, the compiler can inline them directly into memory operation instructions, avoiding any runtime address resolution overhead.

## Modules and Execution Order

The code is organized into modules, each containing variable declarations and a sequence of commands.

Within each execution entry, modules and groups share declaration order. A group calls its own `main` entry, when present,
where the group is declared: `rootA`, `synth { voiceA, voiceB }`, `rootB` runs as
`rootA -> synth/voiceA -> synth/voiceB -> rootB`. The same rule applies inside nested groups. Other named entries run when called, while child `init` entries join the
parent initialization entry. Groups without `main` perform no automatic main work. In the editor, spatial position
defines declaration order at each project level. A memory reference does
not reorder execution: if a module reads a producer's memory, the producer is not moved earlier. See the
[compiler documentation](../packages/compiler/README.md) for recursive composition details.

Execution order is separate from memory layout. Modules are allocated in alphabetical order by qualified id, but address order does not choose which module executes first.

For example, this complete project puts the consumer before the producer in the `main` entry:

```8f4e
8f4e/v1

entry main
module zConsumer
int result

push &result
push &aProducer:value
load
store
moduleEnd

module aProducer
int value

push &value
push 7
store
moduleEnd
entryEnd
```

The producer's `value` starts at zero. After `initDefaults()` and one `main()` call, `zConsumer:result` is `0`: the consumer runs first. After a second `main()` call, it is `7`, because the producer's first call stored `7`. `aProducer` is allocated before `zConsumer` because its qualified id sorts first, but that memory order does not change execution order.

```8f4e
module foo

int a 10
int b 20
int result

push &result
push a
push b
add
store
moduleEnd
```

In the visual editor, **Open group** enters a project's nested group and **Go back** returns to its parent.
The editor remembers each level's viewport position, including the root, and restores it when you return or reopen
a visited group. Remembered positions take precedence over `@home`. On the first visit, it uses the group's `@home`
block or the origin. Positions stay only in browser memory and are excluded from saved projects and session storage.
The editor also restores each level's last selected block when you return. Remembered selections stay in browser
memory too. Loading another project clears both.

## Live Variable Editing

8f4e supports real time manual modification of variable values while the program is running, without requiring recompilation. This is made possible by the deterministic allocation strategy: because memory addresses are fixed at compile time, the compiler can provide the exact address of every memory item, allowing the editor to locate and update any variable directly in memory without restarting or recompiling the program.

```
int foo 10
; You can change these values in the editor
; while the program is running
int bar 20
; The editor traces them back in memory
; and updates their values without restarting
; or recompiling the program
```

Selecting a `call` instruction in the editor shows the resolved function signature, including parameter names and
types followed by return types, such as `call mix (a: float b: float -- float)`. The signature follows the selected
overload and includes the pointer parameters generated by `paramShape`, which expands a prototype's fields into
parameters. Long signatures wrap across tooltip lines. Until resolved compiler metadata is available, the tooltip shows the generic call signature.

## Visibility and Memory Safety

All variables in 8f4e are public. There is no concept of variable visibility.

Memory safety is optional. Raw pointers can reference any location within the program's memory space, the visual wires help developers see where pointers are pointing.

When you want checked addressing, use address-aware values such as `&foo`, keep pointer arithmetic within the proven safe range, or explicitly clamp the address with `clampAddress`, `clampModuleAddress`, or `clampGlobalAddress` before loading or storing.

The compiler tracks proven safe address ranges where it can. Load and store instructions can omit runtime guards when the address is known to be safe; otherwise they emit guarded memory access. 

Memory items are allocated on a 32-bit grid — every memory item starts at an address that is a multiple of 4 bytes.

```
int* pointer

push &pointer
push pointer
push 4
add
store

; pointer will iterate through all
; possible memory addresses
```
