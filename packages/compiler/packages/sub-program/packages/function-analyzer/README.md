# @8f4e/function-analyzer

Reports structural facts about resolved functions after stack analysis has selected concrete call overloads.

```ts
const report = analyzeFunctions({ semanticReferences, stackReport, entries });
const analysis = report.functions[functionId];
```

The report is keyed by canonical function ID. Each `FunctionAnalysis` contains:

- `isImported`: the declaration is supplied by a host import.
- `hasExplicitReturn`: the executable body contains any explicit `return`.
- `hasEarlyReturn`: a `return` occurs before the last executable operation. Nested returns count because their
  enclosing block endings follow them. A final top-level `return` sets only `hasExplicitReturn`; trailing comments
  and declarations do not affect the result.
- `isRecursive`: the function belongs to a direct or indirect call cycle. The call graph includes entry dispatchers
  and module bodies, follows resolved overload identities, and omits skipped module dispatches. A function that only
  calls a recursive function is not itself recursive unless a path leads back to it.

Return facts describe body structure rather than proving reachability. Import facts come from registered metadata.
Host callback reentry is outside the statically known call graph. All analysis is recomputed per compilation without
mutating source ASTs, semantic reports, or stack facts.

The shared `FunctionAnalysis` contract lives in `@8f4e/language-spec`. Sub-program orchestration passes each result
through to the required `CompiledFunction.analysis` field, independently of `includeStackAnalysis`.

This package owns facts. Optimization passes own eligibility rules, expansion costs, and transformations.

From the repository root, use `npx nx run @8f4e/function-analyzer:build|test|typecheck|lint`.
