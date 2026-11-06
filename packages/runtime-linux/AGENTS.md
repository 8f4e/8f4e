# Linux Runtime Guidelines

- This package is a native C++20 Linux ALSA host, independent of the editor and browser runtime packages.
- Input is a `.wasm` file, numeric `--left`/`--right` byte offsets and `--buffer-size`. Read memory limits from the
  WASM import; keep compiler symbol lookup and metadata parsing in the separate `tools/runtime-command` tool.
- Use the compiler's shared-memory output. Enable Wasmtime's threads/shared-memory features, import a
  `wasmtime_sharedmemory_t`, and keep MIDI and audio execution in one WASM instance on one thread.
- Avoid allocation, compilation, source parsing, and per-block logging in the playback loop.
- `npx nx run @8f4e/runtime-linux:build` builds the executable under `dist/`; it requires Linux, CMake, a C++ compiler,
  ALSA development headers. The pinned Wasmtime C API is fetched and hash-verified by CMake. No JSON dependency.
- `npx nx run @8f4e/runtime-linux:test` builds the CLI, compiles the local fixture and runs CTest, including ALSA null
  playback. Tests require no physical devices; hardware latency and real MIDI ports need separate verification.
- Production inputs exclude `tests/`; do not add compiler/editor build dependencies to the native production target.
- Native test commands ignore forwarded Vitest options such as `--coverage`. Dedicated `runtime-linux-test.yml` and
  `runtime-linux-release.yml` workflows own native checks and releases; web workflows exclude the native projects.
- The native package is excluded from the web Nx release. Its manual release uses `package.json`'s version and
  publishes GitHub release archives for x86-64 and ARM64 after tests pass.
