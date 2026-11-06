#include "midi.hpp"
#include "program.hpp"

#include <iostream>
#include <stdexcept>
#include <vector>

void require(bool condition, const char *message) {
  if (!condition) throw std::runtime_error(message);
}

int main(int argc, char **argv) {
  try {
    require(argc == 5, "Expected WASM path, left/right byte addresses and buffer size");
    const auto left = std::stoul(argv[2]);
    const auto right = std::stoul(argv[3]);
    const auto frames = std::stoul(argv[4]);
    Program program(argv[1], left, right, frames, "buffer", "onMidiEvent");
    program.initialize();
    require(program.frames() == 128, "Block size comes from the numeric launch argument");
    std::vector<float> audio(frames * 2);
    program.render(audio, 1.0f);
    for (std::size_t i = 0; i < program.frames(); ++i) {
      require(audio[2 * i] == 0.125f && audio[2 * i + 1] == -0.25f,
              "initDefaults applies nonzero compiler defaults before audio execution");
    }

    program.midi({0x90, 64, 96});
    program.render(audio, 1.0f);
    for (std::size_t i = 0; i < program.frames(); ++i) {
      require(audio[2 * i] == 0.5f && audio[2 * i + 1] == -0.75f,
              "MIDI callback updates compiler-planned buffers with stereo routing");
    }
    program.render(audio, 4.0f);
    require(audio[0] == 1.0f && audio[1] == -1.0f, "Output gain clips to device range");
    program.render(audio, 0.5f);
    require(audio[0] == 0.25f && audio[1] == -0.375f, "Output gain preserves headroom");

    Program mono(argv[1], left, left, frames, "buffer", "onMidiEvent");
    mono.initialize();
    mono.midi({0x90, 32, 0});
    mono.render(audio, 1.0f);
    require(audio[0] == 0.25f && audio[1] == 0.25f, "Mono buffer routes to both outputs");

    bool failed = false;
    try {
      Program missing(argv[1], left, right, frames, "missing", "");
    } catch (const std::exception &) { failed = true; }
    require(failed, "Missing audio exports fail at startup");
    std::cout << "Compiled WASM execution, memory routing, MIDI callbacks and gain passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
