# Test Runtime Plugin

- Own `testRuntime` configuration, worker setup and job lifecycle. Import the worker asset here and keep
  execution in runtime-test-runner.
- Publish source assertion outcomes separately from raw assertion errors. Report errors against owned,
  enabled source blocks. Inline error presentation belongs to error-messages.
