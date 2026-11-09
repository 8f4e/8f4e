# Linux Runtime Guidelines

- Keep the C++20 JACK host independent of the compiler and editor. Accept Wasm and numeric byte offsets.
  Read memory limits from the Wasm import. Symbol and metadata parsing belong to `tools/runtime-command`.
- Use one shared Wasmtime memory and run MIDI and audio sequentially in the same instance. Adapt fixed Wasm
  blocks to JACK cycles without allocation, compilation, parsing or per-block logging in the playback loop.
- Keep device discovery and hot-plug routing outside the playback loop. Use JACK ports for audio and MIDI.
- Build and test on Linux with CMake, a C++20 compiler, pkg-config and JACK development headers. CMake
  fetches and verifies the pinned Wasmtime C API. Run `npx nx run @8f4e/runtime-linux:test` for isolated JACK
  dummy-server tests without hardware.
- Keep the Debian Bookworm baseline for native CI and release runners. Smoke-test the extracted release
  executable. Compiler fixture preparation is a test dependency only.
