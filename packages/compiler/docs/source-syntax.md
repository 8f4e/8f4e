# Source syntax

## Entity names

Entity names and references must contain only ASCII characters. This includes module, function, export, parameter, local, memory, prototype, constant, and constant namespace names. Non-ASCII names are rejected during tokenization with `INVALID_IDENTIFIER` and the source line.

Each entity kind retains its naming rules: module names match `[A-Za-z_][A-Za-z0-9_-]*`, while constants start with an uppercase ASCII letter and contain no lowercase letters. Other valid ASCII punctuation remains accepted. This restriction does not apply to quoted string literals.

## Argument Continuation Lines

Use `- <arguments...>` to append one or more arguments to the previous instruction. This is parser sugar; the compiler sees the same instruction it would have seen if the arguments had been written on one line.

```8f4e
float*
- readHead &source:samples
```

is equivalent to:

```8f4e
float* readHead &source:samples
```

Arguments can be grouped across several continuation lines:

```8f4e
int[] values
- 4 1 -2
- 3 4
```

is equivalent to `int[] values 4 1 -2 3 4`. Grouping does not change how many arguments an instruction accepts.
A bare `-`, a comment-only continuation, or a continuation without a previous instruction is a syntax error.

The instruction and its continuation lines can each have an inline comment. Semicolons inside quoted strings remain part of the argument:

```8f4e
push; instruction comment
- "hello; world" ; argument comment
```

## Group scope passes

Groups have isolated scopes. Use `pass NAME` in a child group to share a function or constant namespace from its
immediate parent. Repeat the pass at each group boundary when forwarding a name to deeper groups.

Passed functions are called normally, without `use`. A pass shares the complete overload set and retains the
definition's original scope, including its helper functions and constants; it does not copy the function into the child.
A passed function cannot collide with a local function, local entry, or another function pass. If a name identifies both
a function and a constant namespace in the parent, `pass NAME` forwards both. Passed constant namespaces still require
`use NAME` in the blocks that consume their constants.

```8f4e
8f4e/v1
entry main
group voice
function double
param int value
push value
mul 2
functionEnd int

entry main
group envelope
pass double
entry main
module output
int out
push &out
call double 3
store
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd
```
