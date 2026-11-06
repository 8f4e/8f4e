#pragma once

#include "midi.hpp"
#include <cstddef>
#include <memory>
#include <span>
#include <string>

class Program {
public:
  Program(const std::string &wasm_path, const std::string &memory_path,
          const std::string &left, const std::string &right,
          const std::string &entry, const std::string &midi_callback);
  ~Program();
  std::size_t frames() const;
  void midi(MidiMessage message);
  // The caller supplies exactly frames() interleaved stereo frames.
  void render(std::span<float> stereo, float gain);

private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};
