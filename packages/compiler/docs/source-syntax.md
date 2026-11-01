# Source syntax

## Entity names

Entity names and references must contain only ASCII characters. This includes module, function, export, parameter, local, memory, prototype, constant, and constant namespace names. Non-ASCII names are rejected during tokenization with `INVALID_IDENTIFIER` and the source line.

Each entity kind retains its naming rules: module names match `[A-Za-z_][A-Za-z0-9_-]*`, while constants start with an uppercase ASCII letter and contain no lowercase letters. Other valid ASCII punctuation remains accepted. This restriction does not apply to quoted string literals.

## Argument Continuation Lines

Use `- <argument>` to append one argument to the previous instruction. This is parser sugar; the compiler sees the same instruction it would have seen if the arguments had been written on one line.

```8f4e
float*
- readHead
- &source:samples
```

is equivalent to:

```8f4e
float* readHead &source:samples
```

Each continuation line accepts exactly one argument. A bare `-`, a continuation with multiple arguments, or a continuation without a previous instruction is a syntax error.

The instruction and its continuation lines can each have an inline comment. Semicolons inside quoted strings remain part of the argument:

```8f4e
push; instruction comment
- "hello; world" ; argument comment
```
