# Audio Runtime Plugin

`@8f4e/editor-plugin-audio-runtime` is an ordinary editor plugin. The default composition imports it when the project contains
`@config audioRuntime` settings. Enable execution with:

```text
; @config audioRuntime.enabled true
```

The plugin registers its schema on setup and initializes from current configuration and compiler artifacts. It can
run alongside other runtimes, sharing the compiler's memory. Disabling it stops its own execution. A loaded plugin
stays installed until editor disposal; configuration introduced by editing uses **Load plugins used by project**.

Configure `audioRuntime.entry` and `audioRuntime.sampleRate` to select the exported entry and its rate.
The defaults are `buffer` and `48000` respectively.
The plugin contributes `SAMPLE_RATE` by default. Set `audioRuntime.sampleRateConstantName` to choose its name:

```text
; @config audioRuntime.sampleRateConstantName AUDIO_RATE
```

Concurrent runtimes should use distinct constant names. Contributions are ordinary source in `constants env`;
the compiler handles conflicting declarations. Statistics are published under the fixed `info.audioRuntime` namespace.

Audio also contributes `AUDIO_BUFFER_SIZE` (128); configure its name with `audioRuntime.bufferSizeConstantName`.
Output/input buffers use `audioOutBufferLAddress`, `audioOutBufferRAddress`, and `audioInBufferLAddress` under
`audioRuntime`. The host supplies browser constructors, navigator, worklet URL, compiler getters, and an optional shared
AudioContext. A borrowed context is never closed. Audio and microphone permission flow belongs to this plugin.

Validate with `npx nx run @8f4e/editor-plugin-audio-runtime:build|test|typecheck`.
