# @8f4e/test-runner

Shared native assertion execution for compiler fixtures and `cli test`. The compiler emits
assertion imports and static source sites. This package supplies collecting callbacks, executes the `test` export,
and returns failures as data. Sources are compiled unchanged.

## Usage

```ts
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { formatTestFailures, hasTestEntry, runTests } from '@8f4e/test-runner';

const project = parseProjectSource(source);
if (hasTestEntry(project)) {
  const compiled = await compileProject(project, {
    enableAssertions: true,
    disableSharedMemory: true,
    resolveInclude,
  });
  const result = await runTests(compiled);
  if (result.failures.length) console.error(formatTestFailures(result.failures));
}
```

Callers compile with assertions enabled and non-shared memory, adding an include resolver when needed.
`runTests(compiled)` allocates fresh memory, calls `initDefaults()` once, and executes `test()`.
It returns `instance`, `memory`, `assertions`, and `failures`. Callers retain the compiler's source-site lookup and
other output themselves. The runner has no compiler implementation dependency or source transformation step.

`runTests({ codeBuffer, assertionSites, memory })` instead borrows the supplied
`WebAssembly.Memory` for the `host.memory` import. This path needs no allocation sizes and executes against the
current state without calling `initDefaults()` or resetting memory. The caller owns initialization and lifetime;
supplied shared memory must match the compiled Wasm imports. The editor test runtime uses this path with memory
already initialized by its compiler worker.

Hosts that instantiate assertion-enabled Wasm without collecting results can import `IGNORED_ASSERTION_IMPORTS`
from `@8f4e/language-spec` and spread it into their `host` imports alongside memory. These callbacks ignore all assertion invocations.

## Assertions and reporting

```8f4e
entry test
module addWorks
push 1
push 2
add
assertEqual 3
push 1
assert
moduleEnd
entryEnd
```

`assert` passes for nonzero integers. `assertEqual expected` consumes the actual stack value and compares it to its
required expected argument. It compares matching integer, float32, float64, or pointer values
exactly. Pointers compare addresses. NaN fails, matching infinities pass, and signed zero compares equal. Express
approximate expectations explicitly with arithmetic and `assert`; no tolerance is hidden in the runner.

The callbacks collect results and return normally after failures. `assertions` records each invocation with
`assertIndex`, `site`, and `passed`; condition results contain `condition`, equality results contain `received` and
`expected`. `failures` contains failed invocations. Loops share a static site but have distinct invocation indices.
`formatAssertionExpectation(result)` formats the expected and received values for inline diagnostics as well as
the failure text used by `formatTestFailures`.
The compiler's `assertionSites` lookup includes sites in branches that never execute. Count executed assertions with
`result.assertions.length`.

Failure formatting uses one-based physical block lines and included-source provenance:

```text
1 assertion failed:
  assertEqual #0 expected 4, received 3 at module addFails, block line 5 (site 0)
```

Site IDs belong to one compilation. Static sites remain in compiler output; each executed invocation is recorded by
the runner.

## Validation

Use `npx nx run @8f4e/test-runner:build|test|typecheck|lint`. Real compiler/Wasm integration coverage lives in
`packages/compiler/tests/testRunner.test.ts`, terminal reporting in `packages/cli/tests/cli.test.ts`.
