# WASM Bytecode to LLVM IR Bridge

Date: 2026-05-25

This note captures an early idea for compiling 8f4e-generated WebAssembly bytecode into LLVM IR so 8f4e programs can be linked into native C/C++ programs or embedded firmware.

This is not yet a concrete implementation plan. There are still open questions about the right lowering strategy, target model, ABI, runtime assumptions, and whether LLVM IR is the best first bridge compared with C output.

## Short version

8f4e should keep WebAssembly bytecode as its native compiler output.

That keeps the main compiler simple and fast for the live editor. The editor can continue compiling directly to browser-ready WebAssembly without pulling in LLVM concepts or native toolchain concerns.

Separately, 8f4e could grow a converter:

```text
8f4e source
  -> 8f4e compiler
  -> 8f4e-flavored WebAssembly bytecode
  -> WebAssembly bytecode to LLVM IR bridge
  -> LLVM object file
  -> linked C/C++ program or firmware image
```

The bridge would not try to support arbitrary WebAssembly. It would target the subset 8f4e actually emits.

## Why this is interesting

LLVM IR could make 8f4e programs easier to integrate into native programs:

- C or C++ code could call exported 8f4e functions through a stable ABI.
- 8f4e-generated code could call host shim functions declared by the native program.
- LLVM could lower 8f4e code to native object files for supported targets.
- Embedded programs could link 8f4e logic into normal firmware builds without embedding a WebAssembly runtime.

The motivating case is not “run any WebAssembly module everywhere.” It is more specific:

> Take bytecode emitted by the 8f4e compiler, convert that known subset into LLVM IR, then use the native toolchain to link it with other code.

That distinction matters because 8f4e's WebAssembly subset is much smaller than full WebAssembly.

## Why not emit LLVM IR directly?

Direct LLVM output from the main 8f4e compiler might eventually be useful, but it would pull native-code concerns into the compiler's hot path.

The current WebAssembly-first shape has a clear benefit:

- fast live-editor compilation
- compact compiler implementation
- one native output format for the browser runtimes
- simpler compiler testing around bytecode output

A separate bytecode-to-LLVM bridge preserves that boundary. The main compiler can stay focused on WebAssembly, while native linking becomes an optional downstream workflow.

## Why this might work for 8f4e

8f4e does not need to handle the full WebAssembly platform in this bridge.

Useful simplifying constraints:

- fixed linear memory
- no `memory.grow`
- no tables
- no general dynamic linking model
- no requirement to accept arbitrary third-party WebAssembly modules
- target memory limits can be checked before generating native code

That makes the bridge closer to a backend for a known compiler output than a general WebAssembly decompiler.

## Possible lowering shape

The bridge could map the supported WebAssembly concepts into LLVM IR like this:

```text
WASM function      -> LLVM function
WASM export        -> externally visible C ABI symbol
WASM import        -> LLVM declaration for a host shim
WASM local         -> LLVM value or stack slot
WASM operand stack -> temporary SSA values during lowering
linear memory      -> fixed LLVM global byte array
load/store         -> address calculation plus LLVM loads/stores or explicit byte operations
call               -> direct LLVM call
branch/block       -> LLVM basic blocks
```

Fixed memory might become an LLVM global:

```llvm
@memory = internal global [1024 x i8] zeroinitializer
```

Then a host C program could declare exported 8f4e functions:

```c
#include <stdint.h>

extern uint32_t eightfour_update(uint32_t tick);
```

The exact ABI is still an open design point.

## C output is still a competing bridge

LLVM IR is not the only possible bridge.

A WebAssembly-bytecode-to-C converter could be attractive because C compilers exist for more embedded targets than LLVM backends do.

Possible C bridge:

```text
8f4e bytecode -> generated C -> target C compiler -> object file
```

Possible LLVM bridge:

```text
8f4e bytecode -> LLVM IR -> llc/clang -> object file
```

The tradeoff is not settled:

- C output may be easier to integrate with vendor and microcontroller toolchains.
- LLVM IR may offer better optimization and a cleaner compiler-style backend.
- C output may be more inspectable.
- LLVM IR may be less portable when the target relies on GCC-only or vendor-only tooling.

This note should not assume LLVM is definitely the final answer.

## Embedded target questions

The bridge could make embedded targets more realistic, but only if target limits are first-class.

For example, an AVR target profile might need to specify:

```text
target: avr-atmega328p
ram: 2048 bytes
max-linear-memory: 1024 bytes
trap-mode: unchecked | error-flag | abort
host-shims: digitalWrite, readAdc, ...
```

The bridge or surrounding build tool should reject programs whose fixed memory requirements exceed the target.

The interesting question is where this information belongs:

- command-line flags
- a runtime profile file
- project config
- metadata embedded in compiled output
- a future package-level native build system

## ABI questions

The C/native boundary needs careful design before this becomes a TODO.

Open ABI questions:

- How are exported 8f4e function names mapped to native symbols?
- Should symbols be prefixed to avoid collisions?
- Which 8f4e value types can cross the boundary?
- Are all exported values represented as fixed-width C integer/float types?
- How does host code access or inspect 8f4e linear memory?
- Should the bridge generate a C header?
- How are host imports declared and validated?
- Can host shims be target-specific without making bytecode target-specific?

The ABI probably matters more than the initial lowering mechanics, because it determines whether generated code is pleasant to link into real programs.

## Memory questions

Fixed linear memory simplifies the problem, but it does not remove every memory decision.

Open memory questions:

- Is linear memory always emitted as one LLVM global array?
- Should memory be internal, exported, or supplied by the host?
- Should the host be able to pass a memory pointer into an 8f4e instance?
- How are multiple compiled 8f4e programs isolated from each other?
- How should initial memory contents and passive data segments be represented?
- Should loads/stores use native LLVM integer loads or explicit byte-by-byte little-endian operations?
- What should happen on out-of-bounds memory access?

The safest first bridge may keep memory internal and expose only functions, then add explicit host memory access later.

## Trap and safety questions

WebAssembly has defined traps. Small embedded targets often do not want a heavyweight trap mechanism.

Possible policies:

- reject bytecode that may trap unless statically proven safe
- emit checks and call a host trap function
- set an error flag and return
- omit checks in an unchecked embedded mode

This should probably be target-configurable rather than hardcoded.

## Toolchain questions

Not every C compiler accepts LLVM IR.

The likely LLVM path is:

```text
generated.ll -> LLVM tools -> generated.o
C/C++ compiler -> host.o
link generated.o and host.o
```

For AVR, that might look like:

```text
generated.ll -> llc -march=avr -> generated.o
host.c -> avr-gcc -> host.o
avr-gcc links generated.o and host.o
```

But this depends on LLVM's target support and object compatibility with the rest of the target toolchain. That needs research before promising AVR support specifically.

## Possible first experiment

A useful spike could be intentionally tiny:

- take one 8f4e-generated Wasm module with one exported function
- support only `i32` constants, locals, arithmetic, calls, and returns
- emit LLVM IR by string-building or a tiny IR builder
- compile it on the host machine with LLVM tools
- link it with a C harness
- call the exported function from C

That would answer several practical questions without committing to the whole architecture.

## Open questions

- Is LLVM IR the right first native bridge, or should C output come first?
- Should the bridge consume raw WebAssembly bytecode, a decoded wasm-utils representation, or compiler metadata plus bytecode?
- How much of WebAssembly's validation should the bridge redo?
- Should the bridge live under `compiler/`, a future native tooling package, or a CLI package?
- Should generated LLVM IR preserve WebAssembly-like stack structure or aggressively reconstruct SSA/control flow?
- What is the minimum useful 8f4e subset for native linking?
- How should target profiles be described and validated?
- Should the bridge produce LLVM IR text, bitcode, object files, C headers, or some combination?
- Can LLVM-generated object files reliably link with AVR and other embedded C toolchains?
- What should be documented as stable ABI versus experimental ABI?

## Main takeaway

The promising idea is not to make LLVM replace WebAssembly as 8f4e's native compiler output.

The promising idea is a separate bridge from 8f4e's known WebAssembly subset to a native-linking format. LLVM IR is one strong candidate for that bridge, especially if the goal is object-file linking and optimization. C output remains a serious competing path, especially for embedded targets with non-LLVM toolchains.

This should stay as a brainstorming note until the ABI, target profile, memory model, trap policy, and first spike scope are clearer.
