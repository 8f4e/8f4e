# @8f4e/tokenizer

`@8f4e/tokenizer` parses a single compiler source block into a validated AST.

```ts
const ast = compileToAST(sourceLines, cache, cacheKey);
```

The tokenizer owns source-to-AST parsing and syntax-level validation that can be decided from tokens, block placement, or argument shape alone. It also exports focused syntax helpers for argument parsing, memory-reference token classification, block classification, and instruction argument validation.

`parseInstructionTokens(line, lineNumber)` returns the raw instruction and argument tokens for source-editing tools.
It preserves quoted strings and escape sequences and stops at an unquoted comment delimiter. It does not validate
instruction names or argument shapes; use `parseLine` when a validated AST line is needed.

This package owns:

- Source line tokenization and AST construction.
- Source block structure validation.
- Function parameter ordering, imported declaration structure, and import/export directive uniqueness.
- Instruction placement and syntax-level argument validation.
- Literal, identifier, compile-time operand, string literal, pointer-depth, and memory-reference token parsing.
- Optional AST caching for repeated compilation of unchanged source blocks.

This package does not own:

- Project document parsing. That belongs to `@8f4e/project-preparser`.
- Constant resolution, memory reference resolution, or memory layout planning.
- Symbol resolution, scope checks, stack analysis, type compatibility, or code generation.
- Semantic compiler errors that require compiler state.

Syntax errors belong to `src/syntax/syntaxError.ts`; semantic errors belong to later compiler phases.

Function declaration checks run while the function AST builder consumes parsed lines. The builder records whether the
body has started and uses its existing import/export metadata to reject invalid declarations before building a validated
AST. Later stages trust these guarantees. Export-name collisions between different functions and prototype lookup for
`paramShape` remain semantic checks.
