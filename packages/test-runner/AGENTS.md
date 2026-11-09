# Test Runner Guidelines

- Own execution, assertion callbacks and structured failures shared by compiler fixtures and CLI. Keep
  compilation, file handling and snapshots in adapters. The assertion ABI belongs to language-spec.
- Consume compiler-produced assertion sites and preserve included-source provenance. Distinguish static site
  IDs from execution invocations. Keep results serializable and the runner browser-safe.
- Initialize fresh shared memory before executing the test entry. Borrow supplied memory without resetting it.
- Keep real compiler/Wasm integration in compiler tests and terminal reporting tests in the CLI.
