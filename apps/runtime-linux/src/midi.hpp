#pragma once

#include <cstdint>
#include <optional>
#include <span>

struct MidiMessage {
  uint8_t status;
  uint8_t data1 = 0;
  uint8_t data2 = 0;
};

// JACK supplies complete, normalized messages, including their status byte.
inline std::optional<MidiMessage> midi_message(std::span<const uint8_t> bytes) {
  if (bytes.front() == 0xf0) return std::nullopt; // SysEx has no corresponding WASM callback.
  return MidiMessage{bytes[0], bytes.size() > 1 ? bytes[1] : uint8_t{0},
                     bytes.size() > 2 ? bytes[2] : uint8_t{0}};
}
