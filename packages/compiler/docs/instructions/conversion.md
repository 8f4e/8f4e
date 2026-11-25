# Conversion

### castToFloat

The castToFloat instruction takes an integer from the stack, converts it to a floating-point number, and then places the resulting value back onto the stack.

#### Examples

```
push 3
castToFloat
```

### castToInt

The castToInt instruction takes a value from the stack, converts it to an integer, and then places the resulting integer back onto the stack.
Finite values truncate toward zero, so nonzero fractions between `-1` and `1` convert to `0`.
The conversion is non-trapping: `NaN` converts to `0`, values above the signed 32-bit integer range saturate to `2147483647`, and values below the signed 32-bit integer range saturate to `-2147483648`.

#### Examples

```
push 3.7
castToInt
```

### castToFloat64

The castToFloat64 instruction converts the top stack value to a 64-bit floating-point number.

- If the input is `int`, it converts to float64.
- If the input is `float` (float32), it promotes to float64.
- If the input is already float64, it is left unchanged.

#### Examples

```
push 3
castToFloat64
```

```
push 3.14
castToFloat64
```
