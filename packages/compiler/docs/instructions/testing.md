# Testing

The compiler provides native `assert` and `assertEqual` instructions. Both are accepted in modules and functions.
`compileProject(project, { enableAssertions: true })` enables callback emission and source-site metadata. The flag
is `false` by default; disabled assertions consume their operands without requiring assertion imports.

## assert

**Stack effect:** `int --`

```8f4e
push 1
assert
```

Zero fails and any nonzero integer passes. When enabled, the instruction calls `host.assertCondition(condition, siteId)`.
The callback owns result collection. Returning normally allows execution to continue after a failed condition.

## assertEqual

**Syntax:** `assertEqual expected`

**Stack effect:** `T --`

```8f4e
push 2
assertEqual 2
```

Push the received value and supply exactly one expected argument. The argument supports numeric literals,
constants, compile-time expressions, locals, memory values, and address/pointer references, using the same resolution
rules as `push`. String literals are not accepted. For example, use `assertEqual EXPECTED`, `assertEqual value`, or
`assertEqual &value`. The received and expected values must have matching types: integer, float32, float64,
or matching pointer types. Pointers compare their 32-bit addresses without dereferencing. Pointer and ordinary integer
operands cannot be mixed. Float32 and float64 operands cannot be mixed or implicitly converted.

Equality is exact, with no epsilon or tolerance: close but unequal floats fail, NaN fails equality, matching infinities
pass, and positive/negative zero compare equal. Approximate expectations must be expressed separately, for example
by computing an integer condition and using `assert`.

## Compiler flag and host callbacks

When disabled, both instructions emit one Wasm `drop`. The inline expected value is not evaluated at runtime.
Instructions producing the actual stack operand still execute, including function calls and their side effects.
Normal syntax, reference-resolution, stack-count, and operand-type checks still
apply. Disabled compilation omits `assertionSites` and native assertion imports.

Enabled compilation adds only the callback signatures used by the program. Each import has no return values:

| Import | Wasm parameters | JavaScript callback |
| --- | --- | --- |
| `host.assertCondition` | `i32, i32` | `(condition, siteId) => void` |
| `host.assertEqualI32` | `i32, i32, i32` | `(received, expected, siteId) => void` |
| `host.assertEqualF32` | `f32, f32, i32` | `(received, expected, siteId) => void` |
| `host.assertEqualF64` | `f64, f64, i32` | `(received, expected, siteId) => void` |

The compiler appends the site ID after the source operands. Integer and pointer operands use the I32 callback;
JavaScript receives signed 32-bit values, preserving every address bit. Float callbacks receive values in their
original Wasm precision. The names are exported as `ASSERTION_IMPORT_NAMES` from `@8f4e/language-spec`.

The compiler knows these signatures; callers do not supply import descriptions or JavaScript callbacks during
compilation. Supply matching callbacks when instantiating the emitted Wasm. Callbacks implement the documented
condition/equality checks and own their reporting policy. They can collect both successful and failed assertions:

```ts
const compiled = await compileProject(project, { enableAssertions: true });
const memory = new WebAssembly.Memory({
  initial: Math.max(1, Math.ceil(compiled.requiredMemoryBytes / 65536)),
  maximum: Math.max(1, Math.ceil(compiled.requiredMemoryBytes / 65536)),
  shared: true,
});
const results = [];
const equal = (received, expected, siteId) => {
  results.push({ siteId, received, expected, passed: received === expected });
};
const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), {
  host: {
    memory,
    assertCondition: (condition, siteId) => {
      results.push({ siteId, condition, passed: condition !== 0 });
    },
    assertEqualI32: equal,
    assertEqualF32: equal,
    assertEqualF64: equal,
  },
});
```

This example supplies the program's shared `host.memory`. Every emitted assertion import is required during
instantiation, even when its call is in a branch
that is never executed. Callback exceptions propagate and interrupt the current invocation; collecting callbacks
should return normally to run later assertions.

Assertions check operands in the current state. They do not initialize or reset memory, select execution entries,
schedule tests, or require a fresh instance. Those decisions belong to the caller or test runner.

## Source-site lookup

Enabled compilation returns `compiled.assertionSites`, an array of static sites indexed by the emitted `siteId`:

```ts
interface AssertionSite {
  siteId: number;
  instruction: 'assert' | 'assertEqual';
  projectBlockId?: number;
  projectGroupPath: string;
  codeBlockType: 'module' | 'function';
  codeBlockId: string;
  functionId?: string;
  lineNumber: number;
  source?: { kind: 'include'; includeId: string; symbolName: string };
}
```

`lineNumber` is the zero-based physical line inside the original block, including comments and continuation lines.
`codeBlockId` is the original module/function name before group qualification. `projectGroupPath` is the canonical
encoded group path, with an empty string for the root. Function sites also carry the qualified, signature-derived
`functionId`, distinguishing overloads even in included sources. Included functions retain their original symbol
and source provenance. Their optional project block ID is present when the derived source supplies one.

The lookup includes static sites in unexecuted branches and functions. Each loop iteration reports the same site ID;
invocation counts and execution order belong to the caller. An enabled program with no native assertions returns an
empty array and emits no assertion imports. Site IDs belong to one compilation; consumers must associate results
with that compilation before matching them to editor lines.

## Shared test runner

Compiler fixtures and `8f4e test` use `@8f4e/test-runner` with assertions enabled.
They use these native instructions directly; sources are not instrumented and no assertion functions are injected.
The runner supplies collecting callbacks with the semantics above and reports compiler-produced source sites,
including included helpers. See the [runner API and memory policy](../../../test-runner/README.md).

Ordinary `call assert` still means a call to a user-defined function named `assert`; the test runner does not provide
that function. To migrate `call assert received expected`, use `push received` followed by `assertEqual expected`.
