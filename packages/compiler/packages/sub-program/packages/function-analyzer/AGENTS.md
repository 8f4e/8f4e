# Function Analyzer Package Guidelines

This file extends the root, compiler, and sub-program guidance.

- Package name: `@8f4e/function-analyzer`.
- Analyze resolved bodies and stack facts after overload resolution. Use canonical function IDs for call graphs.
- Report structural facts only; optimization eligibility, budgets, and transformations belong to optimization passes.
- Keep `FunctionAnalysis` in `@8f4e/language-spec` and package-specific inputs/reports in this package.
- Preserve source ASTs, semantic references, and stack reports. Recompute facts for every compilation.
- Include composed entry/module execution paths in recursion analysis and respect skipped module dispatches.
- Use iterative graph traversal so large call graphs do not exhaust the JavaScript call stack.
- Run `npx nx run @8f4e/function-analyzer:build|test|typecheck|lint` from the repository root. Type checking includes tests.
