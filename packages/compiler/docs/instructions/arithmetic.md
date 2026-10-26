# Arithmetic instructions

### add

The "add" instruction operates on two numbers of the same type that are retrieved from the stack. It performs addition on these numbers and then stores the result back onto the stack.

Adding an integer byte offset to an address, in either operand order, produces an address with the same pointee type. The compiler tracks whether the resulting address remains in a proven-safe memory range separately from its pointee type; memory access through an unproven address receives a runtime bounds check. Adding two addresses is invalid.

#### Examples

```
push 1    ; stack: [ 1 ]
push 2    ; stack: [ 1, 2 ]
add       ; stack: [ 3 ]

push 0.5    ; stack: [ 3, 0.5 ]
push 0.7    ; stack: [ 3, 0.5, 0.7 ]
add         ; stack: [ 3, 1.2 ]

float[] samples 4
push &samples
push sizeof(samples)
add         ; typed float address for samples[1]
```

### div

The "div" instruction retrieves two numbers of the same type from the stack and divides the first number by the second. The resulting quotient is then stored back onto the stack.

#### Examples

```
push 8
push 2
div

push 9.0
push 3.0
div
```

### mul

The "mul" instruction retrieves two numbers of the same type from the stack, multiplies them together, and then stores the result back onto the stack.

#### Examples

```
push 1    ; stack: [ 1 ]
push 2    ; stack: [ 1, 2 ]
mul       ; stack: [ 2 ]

push 0.5    ; stack: [ 2, 0.5 ]
push 0.7    ; stack: [ 2, 0.5, 0.7 ]
mul         ; stack: [ 2, 0.35 ]
```

### min

The "min" instruction retrieves two numbers of the same type from the stack and stores the smaller value back onto the stack.

#### Examples

```
push 10
push 3
min       ; stack: [ 3 ]

push 0.5
push 0.7
min       ; stack: [ 0.5 ]
```

### max

The "max" instruction retrieves two numbers of the same type from the stack and stores the larger value back onto the stack.

#### Examples

```
push 10
push 3
max       ; stack: [ 10 ]

push 0.5
push 0.7
max       ; stack: [ 0.7 ]
```

### remainder

The `remainder` instruction consumes a signed integer dividend followed by a signed integer divisor and pushes their remainder. A nonzero result has the same sign as the dividend: `-10` remainder `3` is `-1`, while `10` remainder `-3` is `1`.

The compiler must be able to prove that the divisor is nonzero. A zero literal, an expression known to produce zero, or a value loaded from mutable memory without a nonzero guarantee is rejected at compile time with `Possible division by zero. (14)`. A nonzero memory initializer alone does not establish that guarantee, because the value can change at runtime.

For a dynamic divisor, use `ensureNonZero` immediately before `remainder`. It preserves nonzero values and replaces zero with `1` by default, or with a supplied nonzero integer fallback. This sanitizes the divisor; it does not make `remainder` return a special value for division by zero. The compiler emits WebAssembly `i32.rem_s`, whose zero-divisor trap is prevented by this compile-time requirement.

Unlike signed integer division, `-2147483648` remainder `-1` does not overflow or trap; its result is `0`.

#### Examples

```
push 10
push 3
remainder    ; stack: [ 1 ]
```

An unguarded dynamic divisor is rejected:

```
module unguardedRemainder
int divisor 3
push 10
push divisor
remainder    ; compile-time error: Possible division by zero. (14)
moduleEnd
```

Sanitize the loaded divisor to handle zero at runtime:

```
module guardedRemainder
int divisor 0
push 10
push divisor
ensureNonZero 3
remainder    ; stack: [ 1 ], because zero was replaced with 3
moduleEnd
```

### sub

The "sub" instruction operates on two numbers of the same type that are retrieved from the stack. It subtracts the second operand from the first operand, and then stores the result back onto the stack.

Subtracting an integer byte offset from an address preserves its pointee type, while safety-range facts are narrowed or discarded independently. Subtracting one address from another produces a plain integer byte difference. Subtracting an address from an integer is invalid.

#### Examples

```
push 1    ; stack: [ 1 ]
push 2    ; stack: [ 1, 2 ]
sub       ; stack: [ -1 ]

push 0.5    ; stack: [ -1, 0.5 ]
push 0.7    ; stack: [ -1, 0.5, 0.7 ]
sub         ; stack: [ -1, -0.2 ]
```
