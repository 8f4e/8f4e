# Reviewing Test Helper Derived Behavior

Use this check when reviewing changes to shared test utilities, mock builders, fixtures, or helper packages.

## Goal

Find and remove test helpers that silently parse, resolve, normalize, or otherwise derive production semantics from convenient mock inputs.

## Problem

A mock helper should build explicit mock data. It becomes risky when it accepts a broad convenience input, such as `code`, `source`, `text`, `schema`, `route`, or `config`, then secretly derives other fields by duplicating production behavior.

For example, a helper like this may look harmless:

```ts
createMockCodeBlock({
	code: ['module synth', '; @config webUI.overlay.target frame:buffer', 'moduleEnd'],
});
```

But it should not silently fill fields such as `parsedDirectives`, `moduleId`, or `functionId` by parsing the `code` array. If a test needs those semantic fields, the test should pass them explicitly.

This pattern often appears after a review asks for one behavior to use the real parser. The fix can accidentally go into a generic mock helper instead of the production parser's owning package. That makes the helper a second implementation path.

## Why This Matters

Silent derived behavior in test helpers has several costs:

- production parsing, resolving, or normalization logic can drift from the duplicate helper behavior;
- test setup becomes hidden, so readers cannot see which semantic state the test depends on;
- unrelated tests start depending on parser or resolver behavior just because they use the same mock helper;
- helper packages gain dependencies on parser, compiler, router, or runtime packages that do not belong there;
- failures become confusing because the broken behavior may be in fixture construction rather than the subject under test;
- reviewers may mistake helper behavior for product behavior.

## Detection Checklist

Look for test helper code that imports production logic only to interpret fixture inputs:

```sh
rg -n "from '@8f4e/.+(parser|compiler|token|resolver|runtime|spec)|parse|tokenize|resolve|normalize" packages src -g '*.ts'
```

Search shared test utilities and fixtures for broad convenience inputs that are used to derive other fields:

```sh
rg -n "code|source|text|schema|route|url|config|fixture" packages -g '*test*.ts' -g '*.ts'
```

Review package dependency changes. A test utility package that gains parser, tokenizer, compiler, router, runtime, or schema-validation dependencies deserves a closer look.

Watch for these signs:

- a helper named `createMockX`, `mockX`, or `buildFakeX` calls `parse`, `tokenize`, `resolve`, `normalize`, or similar production-like functions;
- helper tests assert derived semantic fields instead of explicit defaults and overrides;
- passing one field causes several unrelated fields to be populated;
- the helper computes identifiers, directives, symbol metadata, route params, config values, or type information from a string fixture;
- the helper's behavior becomes conditional on source syntax rather than explicit options;
- the helper lives in a shared package but understands details from a specific production package.

## Review Questions

Ask these before accepting derived behavior in a helper:

1. Is this helper testing parsing or resolution itself, or only creating data for another test?
2. Would a caller be surprised that passing one convenience field populates several semantic fields?
3. Is there already a production entry point that owns this derivation?
4. Can the consuming tests pass the derived fields explicitly?
5. Does the new dependency belong in this helper package?
6. Would removing the derivation make the test intent clearer?

If the answer points to hidden production behavior, treat it as a maintainability issue.

## Fix Strategy

Keep production parsing and semantic derivation in the package that owns the behavior. Keep generic mock helpers boring and explicit.

Prefer this approach:

1. Change the generic helper so broad inputs are treated as plain mock data.
2. Give semantic fields neutral defaults, such as empty arrays or caller-provided ids.
3. Let tests pass derived fields explicitly when those fields matter.
4. Move parser behavior tests to the production parser's owning package.
5. Remove now-unused parser, tokenizer, compiler, router, runtime, or schema dependencies from the helper package.
6. Update helper tests to assert defaults and explicit overrides, not hidden derivation.

For example:

```ts
createMockCodeBlock({
	code: ['module synth', '; @config webUI.overlay.target frame:buffer', 'moduleEnd'],
	moduleId: 'synth',
	parsedDirectives: [
		{
			prefix: '@',
			name: 'config',
			args: ['webUI.overlay.target', 'frame:buffer'],
			sourceLineIndex: 1,
			sourceLine: '; @config webUI.overlay.target frame:buffer',
			isTrailing: false,
		},
	],
});
```

The test now says exactly which semantic state it needs. Changes to directive parsing will affect directive parser tests, not every test that happens to build a mock code block.

## When Parsing In Helpers Is Acceptable

Parsing inside a helper can be acceptable when all of these are true:

- the helper is clearly named as a parser fixture helper;
- it is local to parser tests or the package that owns the parser;
- it delegates to the real production parser instead of reimplementing parser behavior;
- consumers need parser behavior as the subject of the test;
- the helper does not live in a broad shared mock package.

If those conditions are not met, prefer explicit fixture fields.

## Review Response Template

Use language like this when replying to a review comment:

> Valid maintainability issue. The helper was deriving semantic fields from mock source text, which duplicated production behavior and hid test setup. I changed the helper to default those fields to neutral mock values, updated tests to pass semantic data explicitly, and removed the now-unneeded dependency.

## Verification

After fixing this pattern, verify both the helper package and the owning production behavior:

```sh
npx nx run <test-helper-package>:test
npx nx run <test-helper-package>:typecheck
npx nx run <owning-production-package>:test
```

Use narrower targets when the package names are known. Broaden to affected projects when the helper is shared widely.
