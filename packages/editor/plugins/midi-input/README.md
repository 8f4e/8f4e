# MIDI Input Plugin

`@8f4e/editor-plugin-midi-input` exports `createMidiInputPlugin({ navigator, getMemory, getCodeBuffer })`. The browser
host supplies its navigator and getters for the compiler's current WebAssembly memory and bytecode. The plugin
owns MIDI discovery, configuration, input bindings, and its cached WASM instance.

Configure input callbacks with separate directives:

```text
; @config midi.inputs.keys.port 0
; @config midi.inputs.keys.callback onMidiEvent
; @info midi
```

The default and minimal editors automatically load the plugin when raw `@config midi.*` directives exist, including
after editing and inside unopened groups. Detection reads cached parsed directives across the complete project tree.
The plugin stays installed until editor disposal. Installation reads current configuration and compiler artifacts,
including after compilation has already completed. The plugin requests MIDI access only when MIDI configuration
exists. It publishes available input and output names under `state.info.midi`, using stable numeric indexes while discovery is active.
Input callbacks use those indexes and name exported WASM functions accepting `(status, data1, data2)`. Multiple
callbacks can share a port; duplicate bindings are ignored. Missing bytes in short realtime messages become zero.

The WASM instance shares the host's memory. Its exports are reused for matching memory and bytecode and replaced
after recompilation changes either. Input listeners are removed while compiling, when configuration is removed,
and on disposal. Late access or export results cannot attach listeners to a disposed binding. Disconnects refresh
the published ports and bindings. Unsupported Web MIDI or denied access leaves an empty device list.

The plugin owns its schema and removes it on disposal. The shared plugin context contains no browser resources or
MIDI-specific services.

Verify with `npx nx run @8f4e/editor-plugin-midi-input:build|test|typecheck`. Tests use simulated MIDI ports and real
compiled WASM callbacks; no hardware is required.
