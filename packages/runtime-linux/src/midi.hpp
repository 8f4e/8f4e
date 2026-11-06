#pragma once

#include <array>
#include <cstdint>
#include <optional>

struct MidiMessage {
  uint8_t status;
  uint8_t data1 = 0;
  uint8_t data2 = 0;
};

// MIDI 1.0 byte streams may split messages between reads, omit repeated channel
// status bytes, and interleave realtime bytes anywhere (including inside SysEx).
class MidiParser {
public:
  std::optional<MidiMessage> push(uint8_t byte) {
    if (byte >= 0xf8) return MidiMessage{byte};
    if (byte & 0x80) {
      count_ = 0;
      status_ = byte;
      if (byte < 0xf0) {
        size_ = (byte & 0xe0) == 0xc0 ? 1 : 2;
      } else if (byte == 0xf1 || byte == 0xf3) {
        size_ = 1;
      } else if (byte == 0xf2) {
        size_ = 2;
      } else {
        status_ = 0; // Ignore SysEx and undefined system messages; cancel running status.
        if (byte == 0xf6) return MidiMessage{byte};
      }
      return std::nullopt;
    }
    if (!status_) return std::nullopt;
    data_[count_++] = byte;
    if (count_ != size_) return std::nullopt;
    const MidiMessage result{status_, data_[0], size_ == 2 ? data_[1] : uint8_t{0}};
    count_ = 0;
    if (status_ >= 0xf0) status_ = 0;
    return result;
  }

private:
  uint8_t status_ = 0;
  uint8_t size_ = 0;
  uint8_t count_ = 0;
  std::array<uint8_t, 2> data_{};
};
