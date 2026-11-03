# Compiler Directives

Compiler directives are special instructions prefixed with `#` that control compilation behavior instead of emitting ordinary stack instructions. They are processed during compilation and do not appear as executable 8f4e instructions in the function or module body.

Compiler directives are block prologue metadata. In a `module`, module-scoped directives must appear immediately after the `module` line and before declarations or executable instructions. In a `function`, function-scoped directives must appear immediately after the `function` line and before `param`, `local`, or executable instructions. Blank lines and comments are ignored by parsing, so they can still appear around prologue directives.

## Module-Scoped Directives

### `#skipExecution`

Marks a module to skip execution in the cycle dispatcher while preserving normal compilation and memory initialization behavior.

**Scope:** Module blocks only

**Usage:**
```8f4e
module myModule
#skipExecution
int counter 0
; ... module code ...
moduleEnd
```

**Behavior:**
- The module is compiled normally (AST, memory map, inter-module references preserved)
- Module memory defaults and initialization still run during the init/memory-init phase
- The module's cycle function is not called from the global cycle dispatcher
- Multiple prologue `#skipExecution` directives in the same module are idempotent (same effect)

**Use Cases:**
- Temporarily disable a module during development without removing it
- Create dormant modules that provide memory/data but don't execute
- Selectively enable/disable module execution for testing or debugging

**Errors:**
- Using `#skipExecution` outside of a module block (e.g., in `constants` or `function` blocks) will result in a `COMPILER_DIRECTIVE_INVALID_CONTEXT` error
- Placing `#skipExecution` after a declaration or executable instruction will result in a `COMPILER_DIRECTIVE_MUST_BE_PROLOGUE` syntax error

**Example:**

```8f4e
; Active module that executes every cycle
module activeModule
int value 0
push value
push value
load
push 1
add
store
moduleEnd

; Disabled module - memory is initialized but cycle code doesn't run
module disabledModule
#skipExecution
int data 42
moduleEnd

; Another module can still reference the disabled module's memory
module consumer
use disabledModule
push disabledModule:data
load
; ... use the value ...
moduleEnd
```

In this example:
- `activeModule` executes every cycle, incrementing its value
- `disabledModule` does not execute, but its memory is initialized with `data = 42`
- `consumer` can access `disabledModule:data` even though `disabledModule` doesn't execute

## Function-Scoped Directives

### `#impure`

Marks the current function as allowed to perform explicit memory IO.

**Scope:** Function blocks only

**Usage:**
```8f4e
function writeSample
#impure
param float* dst
param float value
push dst
push value
store
functionEnd
```

**Behavior:**
- Enables `load`, `load8s`, `load8u`, `load16s`, `load16u`, `loadFloat`, `store`, `storeBytes`, and pointer dereference forms such as `push *ptr` and `push **ptr` inside the current function
- Only permits address-driven memory access
- Allows explicit intermodular addresses such as `&source:value` and target metadata such as `count(source:buffer)`
- Does not allow unqualified module memory identifiers inside functions
- Does not allow memory declarations inside functions

**Errors:**
- Using `#impure` outside a function block results in an `IMPURE_DIRECTIVE_INVALID_CONTEXT` error
- Using memory IO in a function without `#impure` results in an `IMPURE_DIRECTIVE_REQUIRED_FOR_MEMORY_IO` error
- Placing `#impure` after params, locals, or executable instructions results in a `COMPILER_DIRECTIVE_MUST_BE_PROLOGUE` syntax error

### `#import`

Declares that the current function is provided by the WebAssembly host instead of by 8f4e code.

**Scope:** Function blocks only

**Syntax:** `#import <field-name>`

The field name can be an identifier or a string literal. Use a string literal when the host import field name contains characters that are not valid 8f4e identifiers. Imported functions use the WebAssembly import module namespace `host`.

**Usage:**
```8f4e
function hostLog
#import log
param int value
functionEnd
```

String-literal field name:
```8f4e
function addOne
#import "add.one"
param int value
functionEnd int
```

**Behavior:**
- The function signature is still declared with `param` and `functionEnd`
- The function can be called with the normal `call` instruction
- Imported functions are emitted in the WebAssembly import section
- Imported functions do not emit a local WebAssembly function body
- Imported functions are treated as impure
- Imported functions may return values, and those values are pushed onto the stack like any other function call

**Valid imported function body shape:**
```8f4e
function hostRead
#import read
param int address
functionEnd int
```

Only supported function prologue directives, `param` and `paramShape` declarations, and `functionEnd` are allowed in an imported function. Executable instructions such as `push`, `load`, `store`, or `call` are invalid because the implementation lives in the host.

**Host imports:**
```ts
const { instance } = await WebAssembly.instantiate(codeBuffer, {
	host: {
		memory,
		log(value: number) {
			console.log(value);
		},
	},
});
```

**Errors:**
- Using `#import` outside a function block results in a syntax error
- Declaring more than one `#import` in the same function results in a `DUPLICATE_FUNCTION_IMPORT` syntax error
- Combining `#import` and `#export` in the same function results in an `IMPORT_EXPORT_CONFLICT` syntax error
- Adding executable body instructions to an imported function results in an `IMPORTED_FUNCTION_BODY` syntax error
- Placing `#import` after params, locals, or executable instructions results in a `COMPILER_DIRECTIVE_MUST_BE_PROLOGUE` syntax error

## Module- and Function-Scoped Directives

### `#loopCap`

Sets the default loop cap for `loop` blocks in the current module or function block. The loop cap limits the maximum number of iterations to prevent infinite loops at runtime.

**Scope:** Module and function blocks

**Syntax:** `#loopCap <non-negative integer>`

**Usage:**
```8f4e
module myModule
#loopCap 5000
; ... loops after this line use a cap of 5000 ...
moduleEnd
```

**Behavior:**
- Sets the ambient loop cap for `loop` instructions in the same module or function body
- A per-loop explicit argument (`loop <int>`) takes precedence over the ambient `#loopCap`
- When no `#loopCap` is present and no per-loop argument is given, the built-in default of `1000` applies
- The cap value `0` is valid and causes the loop guard to exit immediately on the first guard check
- Multiple prologue `#loopCap` directives in the same block are allowed; the last prologue value becomes the ambient default

**Precedence order (highest to lowest):**
1. Explicit `loop <int>` argument
2. Current ambient `#loopCap <int>` value
3. Built-in fallback `1000`

**Use Cases:**
- Raise the cap for modules with legitimately long-running loops (e.g., audio processing)
- Lower the cap during debugging to surface runaway loops earlier
- Set a function-local cap for pure computational functions with deep iterations

**Examples:**

Module-scoped cap:
```8f4e
module demo
#loopCap 5000

loop
  ; uses 5000
loopEnd

loop 32
  ; uses 32 (explicit argument overrides #loopCap)
loopEnd
moduleEnd
```

Function-scoped cap:
```8f4e
function int:int slowPath
#loopCap 2048
param int input
; loops inside this function default to 2048
push input
functionEnd
```

**Errors:**
- Using `#loopCap` outside of a module or function block (e.g., in `constants` blocks or at the top level before any `module`) will result in a `COMPILER_DIRECTIVE_INVALID_CONTEXT` error
- Placing `#loopCap` after params, declarations, locals, or executable instructions will result in a `COMPILER_DIRECTIVE_MUST_BE_PROLOGUE` syntax error
- Providing a non-integer, float, or negative integer argument is a syntax error detected by the tokenizer

## Error Handling

If an unknown compiler directive is encountered, the tokenizer will throw an `UNRECOGNISED_INSTRUCTION` syntax error.

If a module-scoped directive like `#skipExecution` is used outside of a module block, the compiler will throw a `COMPILER_DIRECTIVE_INVALID_CONTEXT` error.

If `#loopCap` is used outside of a module or function block, the compiler will throw a `COMPILER_DIRECTIVE_INVALID_CONTEXT` error.

If a compiler directive appears after the block prologue has ended, the tokenizer will throw a `COMPILER_DIRECTIVE_MUST_BE_PROLOGUE` syntax error.
