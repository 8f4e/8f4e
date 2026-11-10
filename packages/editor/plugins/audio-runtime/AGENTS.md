# Audio Runtime Plugin

- Own `audioRuntime` configuration, permissions, browser audio lifecycle and the optional shared AudioContext.
  Import the worklet asset here. Keep audio-thread execution in runtime-audio-worklet.
- Track worklet module loading and Wasm initialization separately. Exclude time spent in permission prompts.
