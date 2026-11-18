# Control flow instructions

### block

The block instruction starts a new block. It takes no arguments.

#### Examples

```
block
 push 1
blockEnd int
```

### blockEnd

The blockEnd instruction ends a block and validates any expected result value for the block. It accepts an optional result type (`int` or `float`) to declare whether the block must leave a value on the stack. A bare `blockEnd` means the block produces no result.

#### Examples

```
block
 push 1.25
blockEnd float
```

### branch

The branch instruction performs an unconditional branch out of nested blocks. The depth argument indicates how many blocks to exit.

#### Examples

```
block
 block
  branch 1
 blockEnd
blockEnd
```

### branchIfTrue

The branchIfTrue instruction consumes an integer value from the stack and branches out of nested blocks if the value is non-zero. The depth argument indicates how many blocks to exit.

#### Examples

```
block
 block
  push 1
  branchIfTrue 1
 blockEnd
blockEnd
```

### exitIfTrue

The `exitIfTrue` instruction consumes an integer condition from the stack and exits the enclosing module immediately if the value is non-zero. Any values currently on the stack are dropped on the exit path. If the condition is zero, execution continues normally.

It can only be used inside a `module`.

#### Examples

```
push stopFlag
exitIfTrue

push 1
store
```

### else

The else instruction begins the else branch of the current if block.

#### Examples

```
push 1
if
 push 10
else
 push 20
ifEnd int
```

### if

The if instruction consumes an integer condition from the stack and begins a conditional block. The result type is declared on the closing `ifEnd` instruction.

#### Examples

```
push 1
if
 push 1
ifEnd int
```

### ifEnd

The ifEnd instruction ends an if or else block. It accepts zero or more result types (`int` or `float`) to declare the values the block must leave on the stack. A bare `ifEnd` means the block produces no result.

#### Examples

```
push 0
if
 push 1
else
 push 2
ifEnd int
```

```
push 1
if
 push 10
 push 20
else
 push 30
 push 40
ifEnd int int
```

### loop

The `loop` instruction begins a loop block. The body repeats until it reaches the iteration bound or a branch exits the loop.

An explicit bound can be a non-negative integer literal, constant, or constant expression, or a runtime integer value. The loop reads a runtime bound once on entry. A runtime bound of zero or less skips the body. An explicit bound takes precedence over `#loopCap`. With no argument, `loop` uses the current block's `#loopCap` or the built-in default of `1000`.

#### Examples

```
int counter
loop
 push counter
 push 10
 equal
 branchIfTrue 1
 push &counter
 push counter
 push 1
 add
 store
loopEnd
```

Loop with an explicit cap of 32 iterations:

```
int counter
loop 32
 push &counter
 push counter
 push 1
 add
 store
loopEnd
```

Loop with a constant cap:

```
use env

loop AUDIO_BUFFER_SIZE
 call main
loopEnd
```

Loop with a runtime bound from a function parameter:

```8f4e
function processNotes
param int noteCount
loop noteCount
 ; Process the note at loopIndex.
loopEnd
functionEnd
```

Loop cap set for loops in the block via the `#loopCap` prologue directive:

```
#loopCap 5000
loop
 ; uses 5000
loopEnd

loop 32
 ; uses 32 (explicit argument takes precedence)
loopEnd
```

### loopIndex

The `loopIndex` instruction pushes the current zero-based iteration index of the innermost active loop onto the stack.

It can only be used inside a `loop` block. On the first visible iteration it pushes `0`, then `1`, `2`, and so on.

#### Examples

```
loop
 loopIndex
 push 8
 equal
 branchIfTrue 1
loopEnd
```

Using it as an array index:

```
float[] buffer 16

loop
 push &buffer
 loopIndex
 add
 push 0.0
 store
loopEnd
```

### loopEnd

The loopEnd instruction ends a loop block and branches back to the start of the loop.

#### Examples

```
loop
 push 1
 branchIfTrue 1
loopEnd
```

### mapBegin

The `mapBegin` instruction opens a map block and declares the input type for the mapping operation. The input type must be `int`, `float`, or `float64`.

Between `mapBegin` and `mapEnd` only `map`, `default`, and `mapEnd` are valid instructions.

#### Examples

```
int key
push key
mapBegin int
  map 1 100
  map 2 200
mapEnd int
```

### map

The `map` instruction declares a single key→value row inside a map block. The key is matched against the input value, and if it matches (and no earlier row has already matched), the corresponding value becomes the result.

When `map` has one argument, that argument is the value and the key defaults to the zero-based index of the `map` row inside the current `mapBegin`/`mapEnd` block. Explicit and implicit rows can be mixed; the implicit key always uses the row's position among `map` rows.

Key type must match the input type declared in `mapBegin`. Value type is validated against the output type at `mapEnd`.
For `int` maps, single-character string literals are accepted for keys and values and are converted to ASCII integer codes (for example `"A"` → `65`). Multi-character strings are not allowed in `map`.

#### Examples

```
push key
mapBegin int
  map 1 10
  map 2 20
mapEnd int

mapBegin int
  map 10    ; key 0
  map 20    ; key 1
  map 30    ; key 2
mapEnd int

mapBegin int
  map 10    ; key 0
  map 9 99  ; explicit key 9
  map 30    ; key 2
mapEnd int
```

Character-literal usage in an `int` map:

```
push key
mapBegin int
  map "A" "B"
mapEnd int
```

### default

The `default` instruction declares an explicit fallback value inside a map block. It is returned when no `map` key matches the input. If omitted the implicit default is the typed zero (`0`, `0.0`, or `0.0f64` depending on output type).

The default value type must match the output type declared in `mapEnd`.

#### Examples

```
push key
mapBegin int
  map 1 100
  default 999
mapEnd int
```

### mapEnd

The `mapEnd` instruction closes a map block and declares the output type (`int`, `float`, or `float64`). It consumes the input value from the stack and pushes the mapped result.

Lowering uses branchless WebAssembly `select` instructions. Rows are emitted in reverse declaration order, so earlier source rows overwrite later matches and the first matching source row wins.

> **Note on float key precision**: key matching uses exact equality (`f32.eq` / `f64.eq`). Rounding and precision management is the user's responsibility.

#### Examples

```
int keycode
int output
push &output
push keycode
mapBegin int
  map 65 1
  map 66 2
  map 67 3
  default 0
mapEnd int
store
```

Mixed input/output types:

```
int keycode
float output
push &output
push keycode
mapBegin int
  map 0 0.5
  map 1 1.0
mapEnd float
store
```
