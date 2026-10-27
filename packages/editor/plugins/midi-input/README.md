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

The plugin is installed synchronously but requests MIDI access only when MIDI configuration exists. It publishes
available input and output names under `state.info.midi`, using stable numeric indexes while discovery is active.
Input callbacks use those indexes and name exported WASM functions accepting `(status, data1, data2)`. Multiple
callbacks can share a port; duplicate bindings are ignored. Missing bytes in short realtime messages become zero.

The WASM instance shares the host's memory. Its exports are reused for matching memory and bytecode and replaced
after recompilation changes either. Input listeners are removed while compiling, when configuration is removed,
and on disposal. Late access or export results cannot attach listeners to a disposed binding. Disconnects refresh
the published ports and bindings. Unsupported Web MIDI or denied access leaves an empty device list.

The plugin owns its schema and removes it on disposal. The shared plugin context contains no browser resources or
MIDI-specific services. Loading the implementation lazily remains a separate plugin-system follow-up.

Verify with `npx nx run @8f4e/editor-plugin-midi-input:build|test|typecheck`. Tests use simulated MIDI ports and real
compiled WASM callbacks; no hardware is required.
