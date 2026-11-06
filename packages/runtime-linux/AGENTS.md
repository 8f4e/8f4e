# Linux Runtime Guidelines

- This package is a native C++20 Linux ALSA host, independent of the editor and browser runtime packages.
- Input is a `.wasm` file plus the CLI's `--memory-output` JSON (`requiredMemoryBytes` and `memoryPlan`).
  Keep the compiler metadata unchanged; route float32 audio using byte addresses and declared element counts.
- Compile with `--no-shared-memory`. Keep MIDI and audio execution in one WASM instance on one thread.
- Avoid allocation, compilation, source parsing, and per-block logging in the playback loop.
- `npx nx run @8f4e/runtime-linux:build` builds the executable under `dist/`; it requires Linux, CMake, a C++ compiler,
  ALSA development headers and nlohmann-json. The pinned Wasmtime C API is fetched and hash-verified by CMake.
- `npx nx run @8f4e/runtime-linux:test` builds the CLI, compiles the local fixture and runs CTest, including ALSA null
  playback. Tests require no physical devices; hardware latency and real MIDI ports need separate verification.
- Production inputs exclude `tests/`; do not add compiler/editor build dependencies to the native production target.
- Native test commands ignore forwarded Vitest options such as `--coverage`; CI test/release workflows install
  the system development packages before running affected/all tests.
