# Comparison

### equal

The equal instruction retrieves two values from the stack, checks if they are equal, and then pushes 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 5
push 5
equal
```

### notEqual

The notEqual instruction retrieves two values from the stack, checks if they are not equal, and then pushes 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 5
push 4
notEqual
```

### equalToZero

The equalToZero instruction retrieves a value from the stack, verifies if it equals zero, and then pushes a 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 0
equalToZero
```

### notZero

The notZero instruction retrieves a value from the stack, verifies if it is not zero, and then pushes a 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 1
notZero
```

### greaterOrEqual

The greaterOrEqual instruction obtains two values from the stack, checks if the first value is greater than or equal to the second value, and then pushes 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 5
push 4
greaterOrEqual
```

### greaterOrEqualUnsigned

The greaterOrEqualUnsigned instruction retrieves two unsigned values from the stack, checks if the first value is greater than or equal to the second value without considering their signs, and then pushes 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 0b1111
push 0b0111
greaterOrEqualUnsigned
```

### greaterThan

The greaterThan instruction retrieves two values from the stack, checks if the first value is strictly greater than the second value, and then pushes 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 5
push 4
greaterThan
```

### lessOrEqual

The lessOrEqual instruction takes two values from the stack, checks if the first value is less than or equal to the second value, and then pushes 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 4
push 4
lessOrEqual
```

### lessThan

The lessThan instruction retrieves two values from the stack, checks if the first value is strictly less than the second value, and then pushes 1 onto the stack if it is true, or 0 if it is false.

#### Examples

```
push 3
push 4
lessThan
```
