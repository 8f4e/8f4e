# Function Inliner Package Guidelines

This file extends the root, compiler, and sub-program guidance.

- Package name: `@8f4e/function-inliner`.
- Own inlining eligibility and bounded call-site plans after function/stack/assertion analysis, before Wasm layout.
- Consume `FunctionAnalysis`; keep optimization policy out of the function analyzer.
- Keep original resolved bodies, binding identities, facts, ASTs, and cached inputs unchanged.
- Copy original callee bodies once. Calls inside a selected expansion remain ordinary calls.
- Imports, recursive callees, early-return callees, and generated entries are not expansion candidates.
- Codegen owns physical local allocation, per-invocation local resets, scoped result blocks, and byte emission.
- Retain standalone definitions and preserve assertion/source identity in selected copies.
- Run `npx nx run @8f4e/function-inliner:build|test|typecheck|lint` from the repository root. Type checking includes tests.
