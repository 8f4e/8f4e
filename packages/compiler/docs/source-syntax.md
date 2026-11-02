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

## Group templates

Use `template NAME` / `templateEnd` to define a reusable group implementation. Each instance is a group with one
`useTemplate NAME` instruction:

```8f4e
8f4e/v1
template counter
entry main
module tick
int count
push &count
push count
add 1
store
moduleEnd
entryEnd
templateEnd

entry main
group first
expose count &tick:count
init &count 10
useTemplate counter
groupEnd
group second
expose count &tick:count
init &count 20
useTemplate counter
groupEnd
entryEnd
```

The compiler source front end inserts a copy of the template's child blocks and entries after each group's declaration
lines before ordinary project parsing. Each group has its own memory: after one `main` call, these counters contain 11
and 21. `useTemplate` stays in the expanded group's source. Later compiler stages and the project object model operate
on ordinary expanded groups; templates are not editor directives.

Templates share child functions, includes, constants, prototypes, notes, entries (including empty ones), modules, nested
groups, and their internal layout. Group names, outer positions, `expose`, `init`, `pass`, and other group-level lines
remain specific to each instance. Template bodies contain child blocks and entries, not instance declaration lines.

Root and every group can define templates for their direct child groups. A reference searches only the scope containing
its group, with no ancestor lookup or sibling-private visibility. Definitions can appear after their users, and separate
scopes may reuse a name. Nested templates inside an outer template remain local to each expanded copy. Forwarding
templates through `pass` is not supported.

In input files, a using group must contain exactly one `useTemplate` and no authored child blocks or entries alongside
it. The template-inlining stage rejects violations before insertion. Names follow module-name rules:
`[A-Za-z_][A-Za-z0-9_-]*`. Definition and reference lines accept semicolon comments. Missing definitions, duplicate
local definitions, and recursive references are errors.

The editor displays and edits fully expanded groups. To create a template, add `useTemplate NAME` to an existing group;
no prior definition is needed in the editor. When saving, its child content becomes a template definition in the containing
scope. The serializer keeps each instance's own declaration lines and reference, removing expanded child content from
the saved instance. Unused definitions are omitted.

If several groups use the same local template, saving silently takes the rightmost group's child content, following
existing spatial serialization order (left to right, then top to bottom, then creation order). Moving a group can change
which copy wins. Live groups are not synchronized by saving; reopening gives every instance the selected shared content.
