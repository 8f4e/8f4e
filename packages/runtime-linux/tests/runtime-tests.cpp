#include "midi.hpp"
#include "program.hpp"

#include <array>
#include <iostream>
#include <stdexcept>
#include <vector>

void require(bool condition, const char *message) {
  if (!condition) throw std::runtime_error(message);
}

void midi_tests() {
  MidiParser parser;
  std::vector<MidiMessage> messages;
  for (const uint8_t byte : std::vector<uint8_t>{
           0x90, 60, 0xf8, 100, 64, 0, // Interleaved clock and running status.
           0xc0, 5, 6, 0xd1, 7,       // One-data-byte channel messages.
           0xf0, 1, 2, 0xfa, 3, 0xf7, 60, 100, // SysEx and stray data ignored.
           0xf2, 1, 0xfe, 2, 0xf1, 3, 0xf3, 4, 0xf6,
           0x80, 60, 0, 0x90, 60, 0x81, 61, 2}) {
    if (const auto message = parser.push(byte)) messages.push_back(*message);
  }
  const std::vector<MidiMessage> expected{
      {0xf8}, {0x90, 60, 100}, {0x90, 64, 0}, {0xc0, 5}, {0xc0, 6}, {0xd1, 7},
      {0xfa}, {0xfe}, {0xf2, 1, 2}, {0xf1, 3}, {0xf3, 4}, {0xf6}, {0x80, 60, 0}, {0x81, 61, 2}};
  require(messages.size() == expected.size(), "MIDI message count");
  for (std::size_t i = 0; i < expected.size(); ++i) {
    require(messages[i].status == expected[i].status && messages[i].data1 == expected[i].data1 &&
                messages[i].data2 == expected[i].data2, "MIDI message bytes");
  }
}

int main(int argc, char **argv) {
  try {
    require(argc == 3, "Expected compiler WASM and memory information fixture paths");
    midi_tests();
    Program program(argv[1], argv[2], "output:left", "output:right", "buffer", "onMidiEvent");
    require(program.frames() == 4, "Block size comes from compiler memory metadata");
    std::array<float, 8> audio;
    program.render(audio, 1.0f);
    for (std::size_t i = 0; i < program.frames(); ++i) {
      require(audio[2 * i] == 0.125f && audio[2 * i + 1] == -0.25f,
              "initDefaults applies nonzero compiler defaults before audio execution");
    }

    MidiParser parser;
    for (const uint8_t byte : std::array<uint8_t, 3>{0x90, 64, 96}) {
      if (const auto message = parser.push(byte)) program.midi(*message);
    }
    program.render(audio, 1.0f);
    for (std::size_t i = 0; i < program.frames(); ++i) {
      require(audio[2 * i] == 0.5f && audio[2 * i + 1] == -0.75f,
              "MIDI callback updates compiler-planned buffers with stereo routing");
    }
    program.render(audio, 4.0f);
    require(audio[0] == 1.0f && audio[1] == -1.0f, "Output gain clips to device range");
    program.render(audio, 0.5f);
    require(audio[0] == 0.25f && audio[1] == -0.375f, "Output gain preserves headroom");

    Program mono(argv[1], argv[2], "output:left", "output:left", "buffer", "onMidiEvent");
    mono.midi({0x90, 32, 0});
    mono.render(audio, 1.0f);
    require(audio[0] == 0.25f && audio[1] == 0.25f, "Mono buffer routes to both outputs");

    bool failed = false;
    try {
      Program missing(argv[1], argv[2], "output:left", "output:right", "missing", "");
    } catch (const std::exception &) { failed = true; }
    require(failed, "Missing audio exports fail at startup");
    std::cout << "MIDI parsing, compiled WASM execution, memory routing and gain passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
