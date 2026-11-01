# Math helpers

### abs

The abs instruction computes the absolute value of an integer or floating-point value.

#### Examples

```
push -5
abs
```

### sqrt

The sqrt instruction computes the square root of a floating-point value.

#### Examples

```
push 9.0
sqrt
```

### round

The round instruction rounds a floating-point value to the nearest integer-valued float.

#### Examples

```
push 2.7
round
```

### ensureNonZero

The ensureNonZero instruction ensures a value is non-zero, replacing zero with a provided default (or 1/1.0).
Floating-point defaults are stored at the operand's float32 or float64 precision without additional decimal rounding.

#### Examples

```
push 0
ensureNonZero
```
