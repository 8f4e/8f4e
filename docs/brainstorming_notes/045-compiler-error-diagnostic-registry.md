# Compiler Error Diagnostic Registry

Date: 2026-05-12

This note captures a possible cleanup after moving compiler contracts into `@8f4e/language-spec`: replacing the large semantic error `switch` with a shared diagnostic registry.

## Short version

`@8f4e/language-spec` should probably own the stable error-code registry:

- `ErrorCode`
- structured error details
- error titles
- default message templates
- broad categories such as `scope`, `stack`, `type`, `memory`, `function`, `macro`, and `internal`

The compiler package should keep the helper that attaches compiler runtime data:

- source `line`
- optional `CompilationContext`
- any local details gathered at the throw site

That keeps `language-spec` as the source of truth for diagnostics while avoiding a dependency from the spec package back into compiler internals.

## Current shape

Semantic compiler codes live in `compiler/packages/language-spec/src/errors.ts`.

Semantic error objects are currently constructed in `compiler/src/compilerError.ts` by a large `getError(...)` switch. Most cases only differ by a static message, with a few dynamic cases using details such as an identifier or the current stack.

Syntax errors are separate and still tokenizer-owned in `compiler/packages/sub-program/packages/tokenizer/src/syntax/syntaxError.ts`.

## Proposed shape

The spec package could expose a registry like this:

```ts
export interface CompilerErrorDetails {
	identifier?: string;
	actualStack?: StackItemSummary[];
}

export interface CompilerErrorDefinition {
	code: ErrorCode;
	title: string;
	category: 'scope' | 'stack' | 'type' | 'memory' | 'function' | 'macro' | 'internal';
	severity: 'error';
	message: string | ((details: CompilerErrorDetails) => string);
}

export const compilerErrorDefinitions = {
	[ErrorCode.UNDECLARED_IDENTIFIER]: {
		code: ErrorCode.UNDECLARED_IDENTIFIER,
		title: 'Undeclared identifier',
		category: 'scope',
		severity: 'error',
		message: ({ identifier }) => `Undeclared identifier${identifier ? `: ${identifier}` : ''}.`,
	},

	[ErrorCode.TYPE_MISMATCH]: {
		code: ErrorCode.TYPE_MISMATCH,
		title: 'Type mismatch',
		category: 'type',
		severity: 'error',
		message: 'Type mismatch.',
	},
} satisfies Record<ErrorCode, CompilerErrorDefinition>;
```

Then `compiler` can keep a small wrapper:

```ts
export function getError(code: ErrorCode, line: AST[number], context?: CompilationContext, details = {}) {
	return {
		code,
		message: formatCompilerErrorMessage(code, details),
		line,
		context,
	};
}
```

## Why this is useful

The editor and syntax highlighter can consume stable diagnostic metadata without importing the compiler package.

The compiler remains responsible for compiler-state attachment, but not for owning all user-facing diagnostic copy.

Documentation can eventually generate an error-code reference from the same registry.

Tests can assert that every `ErrorCode` has a registry entry, so adding a code without a message becomes impossible to miss.

Throw sites can pass structured details instead of constructing custom message text.

## Main caveat

`STACK_EXPECTED_ZERO_ELEMENTS` currently builds a message from `line.lineNumberBeforeMacroExpansion` and `context.stack`. That is compiler-state-heavy.

Prefer passing a narrow precomputed detail object into the formatter, such as:

```ts
{
	expectedStackSize: 0,
	actualStack: [{ kind: 'int' }, { kind: 'float' }]
}
```

That keeps the spec registry stable and avoids making it understand the full `CompilationContext`.

## Possible migration path

1. Add `CompilerErrorDetails`, `CompilerErrorDefinition`, `compilerErrorDefinitions`, and `formatCompilerErrorMessage(...)` to `@8f4e/language-spec`.
2. Keep `getError(...)` in `@8f4e/compiler`, but rewrite it to call the formatter and attach `line` and `context`.
3. Add a test that every `ErrorCode` has a definition.
4. Convert dynamic message cases to structured details.
5. Expose the registry to editor-facing code when diagnostic UI or syntax-highlighter help needs it.
