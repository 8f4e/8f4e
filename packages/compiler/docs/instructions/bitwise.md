# Bitwise instructions

All binary bitwise instructions (`and`, `or`, `xor`, `shiftLeft`, `shiftRight`, and `shiftRightUnsigned`) accept
an optional right operand with the same value syntax as `push`. For example, `shiftRight 6` is equivalent to
`push 6` followed by `shiftRight`. Both operands must still be integers. Omitting the argument preserves the existing
form that takes two values from the stack.

```8f4e
push 256
shiftRight 6
and 3
; stack: [0]
```

### and

The "and" instruction retrieves two integers from the stack and performs a bitwise AND operation on them. Specifically, each bit of the resulting value is computed by performing a logical AND between the corresponding bits of the two operands. The resulting value is then stored back onto the stack. 

#### Examples

```
push 0b00001    ; stack: [ 0b00001 ]
push 0b00100    ; stack: [ 0b00001, 0b00100 ]
and             ; stack: [ 0b00000 ]

clearStack

push 0b00001    ; stack [ 0b00001 ]
push 0b00001    ; stack [ 0b00001, 0b00001 ]
and             ; stack [ 0b00001 ]
```

### or

The "or" instruction retrieves two integers from the stack and performs a bitwise OR operation on them. Specifically, each bit of the resulting value is computed by performing a logical OR between the corresponding bits of the two operands. The resulting value is then stored back onto the stack.

#### Examples

```
push 0b00001    ; stack: [ 0b00001 ]
push 0b00100    ; stack: [ 0b00001, 0b00100 ]
or              ; stack: [ 0b00101 ]

clearStack

push 0b00001    ; stack [ 0b00001 ]
push 0b00001    ; stack [ 0b00001, 0b00001 ]
or              ; stack [ 0b00001 ]
```

### shiftLeft

The "shiftLeft" instruction retrieves two integer operands from the stack. It shifts the bits of the first operand to the left by the number of positions specified by the second operand, and then stores the resulting value back onto the stack.

#### Examples

```
push 1
push 3
shiftLeft
```

### shiftRight

The "shiftRight" instruction retrieves two integer operands from the stack. It shifts the bits of the first operand to the right by the number of positions specified by the second operand, and then stores the resulting value back onto the stack. This instruction is typically used to perform bit shifting operations in a program, such as dividing an integer by a power of 2, or extracting specific bits from an integer. Note that if the second operand is greater than or equal to the number of bits in the first operand, the result will be 0.

#### Examples

```
push 16
push 2
shiftRight
```

### shiftRightUnsigned

The "shiftRightUnsigned" instruction retrieves two integer operands from the stack. It shifts the bits of the first operand to the right by the number of positions specified by the second operand, filling the leftmost bits with zeros, and then stores the resulting value back onto the stack. This instruction is similar to the "shiftRight" instruction, but treats the first operand as an unsigned integer. This means that no sign extension occurs during the shift, and the leftmost bits are always filled with zeros, even if the original leftmost bit was 1.

#### Examples

```
push 0b10000000
push 1
shiftRightUnsigned
```

### xor

The "xor" instruction retrieves two integers from the stack and performs a bitwise XOR (exclusive OR) operation on them. Specifically, each bit of the resulting value is computed by performing a logical XOR between the corresponding bits of the two operands. The resulting value is then stored back onto the stack.

#### Examples

```
push 0b0101
push 0b0011
xor
```
