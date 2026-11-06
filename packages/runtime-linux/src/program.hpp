#pragma once

#include "midi.hpp"
#include <cstddef>
#include <memory>
#include <span>
#include <string>

class Program {
public:
  // Addresses are byte offsets in the imported WASM memory; buffers contain float32 samples.
  Program(const std::string &wasm_path, std::size_t left, std::size_t right, std::size_t frames,
          const std::string &entry, const std::string &midi_callback);
  ~Program();
  std::size_t frames() const;
  // Call once on the playback thread before MIDI or rendering.
  void initialize();
  void midi(MidiMessage message);
  // The caller supplies exactly frames() interleaved stereo frames.
  void render(std::span<float> stereo, float gain);

private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};
