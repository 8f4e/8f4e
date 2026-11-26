# Test Runtime Plugin

- Own `testRuntime` configuration, worker setup and job lifecycle. Import the worker asset here and keep
  execution in the nested packages/runtime-test-runner package. Test page-side diagnostics with worker-result
  fixtures rather than exposing the worker's private execution helpers.
- Publish source assertion outcomes separately from raw assertion errors. Report errors against owned,
  enabled source blocks. Inline error presentation belongs to error-messages.
