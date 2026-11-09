# Function Analyzer Guidelines

- Report structural facts from resolved bodies and stack reports. Optimization passes own eligibility and
  transformations. Keep the shared `FunctionAnalysis` contract in language-spec.
- Use canonical function IDs for call graphs. Include composed entry/module execution paths and respect skipped
  dispatches. Use iterative traversal for large graphs.
