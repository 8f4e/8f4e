#include "midi.hpp"
#include "program.hpp"

#include <alsa/asoundlib.h>
#include <array>
#include <cerrno>
#include <charconv>
#include <cmath>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
volatile std::sig_atomic_t stopped = 0;
void stop(int) { stopped = 1; }

struct Options {
  std::string wasm;
  std::optional<unsigned int> left;
  std::optional<unsigned int> right;
  unsigned int buffer_size = 128;
  std::string audio_device = "default";
  std::string midi_device;
  std::string entry = "buffer";
  std::string callback = "onMidiEvent";
  unsigned int sample_rate = 48000;
  unsigned int blocks = 0;
  float gain = 0.25f;
};

const char *usage =
    "Usage: 8f4e-runtime <program.wasm> --left <byte-address> [options]\n"
    "  --audio-device <name>  ALSA PCM output (default: default)\n"
    "  --midi-device <name>   ALSA raw MIDI input (omitted: no MIDI)\n"
    "  --left <byte-address>  Float32 left output buffer (required, decimal bytes)\n"
    "  --right <byte-address> Right output buffer (default: same as left)\n"
    "  --buffer-size <samples> Samples generated per block (default: 128)\n"
    "  --sample-rate <hz>     Must match the compiled project (default: 48000)\n"
    "  --gain <number>        Output gain before clipping (default: 0.25)\n"
    "  --entry <export>       Audio block function (default: buffer)\n"
    "  --midi-callback <export> MIDI function (default: onMidiEvent)\n"
    "  --blocks <count>       Stop after this many blocks (default: run continuously)\n";

unsigned int integer(const std::string &value, bool allow_zero = false) {
  unsigned int result = 0;
  const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), result);
  if (error != std::errc{} || end != value.data() + value.size() || (!allow_zero && result == 0)) {
    throw std::runtime_error("Expected a " + std::string(allow_zero ? "nonnegative" : "positive") + " integer, got: " + value);
  }
  return result;
}

Options options(int argc, char **argv) {
  if (argc < 2) throw std::runtime_error(usage);
  Options result;
  result.wasm = argv[1];
  for (int i = 2; i < argc; i += 2) {
    const std::string flag = argv[i];
    if (i + 1 == argc) throw std::runtime_error("Missing value for " + flag);
    const std::string value = argv[i + 1];
    if (flag == "--audio-device") result.audio_device = value;
    else if (flag == "--midi-device") result.midi_device = value;
    else if (flag == "--left") result.left = integer(value, true);
    else if (flag == "--right") result.right = integer(value, true);
    else if (flag == "--buffer-size") result.buffer_size = integer(value);
    else if (flag == "--sample-rate") result.sample_rate = integer(value);
    else if (flag == "--blocks") result.blocks = integer(value);
    else if (flag == "--entry") result.entry = value;
    else if (flag == "--midi-callback") result.callback = value;
    else if (flag == "--gain") {
      char *end = nullptr;
      result.gain = std::strtof(value.c_str(), &end);
      if (end == value.c_str() || *end || !std::isfinite(result.gain) || result.gain < 0) {
        throw std::runtime_error("Expected a finite nonnegative gain, got: " + value);
      }
    } else throw std::runtime_error("Unknown option: " + flag);
  }
  if (!result.left) throw std::runtime_error("--left <byte-address> is required");
  if (!result.right) result.right = result.left;
  return result;
}

void alsa_check(int result, const std::string &operation) {
  if (result < 0) throw std::runtime_error(operation + ": " + snd_strerror(result));
}
} // namespace

int main(int argc, char **argv) {
  if (argc == 2 && std::string(argv[1]) == "--help") {
    std::cout << usage;
    return 0;
  }
  try {
    const auto config = options(argc, argv);
    Program program(config.wasm, *config.left, *config.right, config.buffer_size, config.entry,
                    config.midi_device.empty() ? "" : config.callback);
    std::vector<float> stereo(program.frames() * 2);

    snd_pcm_t *pcm_handle = nullptr;
    alsa_check(snd_pcm_open(&pcm_handle, config.audio_device.c_str(), SND_PCM_STREAM_PLAYBACK, 0),
               "Open audio device " + config.audio_device);
    const std::unique_ptr<snd_pcm_t, decltype(&snd_pcm_close)> pcm(pcm_handle, snd_pcm_close);
    // ALSA plug devices convert float32 to the card's native sample format.
    const auto latency_us = static_cast<unsigned int>(
        (program.frames() * 3 * 1000000ULL + config.sample_rate - 1) / config.sample_rate);
    alsa_check(snd_pcm_set_params(pcm.get(), SND_PCM_FORMAT_FLOAT_LE, SND_PCM_ACCESS_RW_INTERLEAVED,
                                 2, config.sample_rate, 0, latency_us), "Configure audio output");

    snd_rawmidi_t *midi_handle = nullptr;
    if (!config.midi_device.empty()) {
      alsa_check(snd_rawmidi_open(&midi_handle, nullptr, config.midi_device.c_str(), SND_RAWMIDI_NONBLOCK),
                 "Open MIDI device " + config.midi_device);
    }
    const std::unique_ptr<snd_rawmidi_t, decltype(&snd_rawmidi_close)> midi(midi_handle, snd_rawmidi_close);
    MidiParser parser;
    std::signal(SIGINT, stop);
    std::signal(SIGTERM, stop);
    std::cerr << "Running " << config.sample_rate << " Hz, " << program.frames()
              << " samples/block; MIDI " << (midi ? config.midi_device : "disabled") << '\n';

    unsigned int recoveries = 0;
    unsigned int blocks = 0;
    while (!stopped && (!config.blocks || blocks < config.blocks)) {
      if (midi) {
        std::array<uint8_t, 256> bytes;
        // Bound the amount of MIDI work so a continuous stream cannot starve audio.
        for (int read = 0; read < 16; ++read) {
          const auto count = snd_rawmidi_read(midi.get(), bytes.data(), bytes.size());
          if (count == -EAGAIN || count == -EINTR || count == 0) break;
          alsa_check(static_cast<int>(count), "Read MIDI input");
          for (ssize_t i = 0; i < count; ++i) {
            if (const auto message = parser.push(bytes[i])) program.midi(*message);
          }
        }
      }
      program.render(stereo, config.gain);
      std::size_t written = 0;
      while (written < program.frames() && !stopped) {
        const auto count = snd_pcm_writei(pcm.get(), stereo.data() + written * 2, program.frames() - written);
        if (count < 0) {
          if (count == -EINTR) continue;
          alsa_check(snd_pcm_recover(pcm.get(), static_cast<int>(count), 1), "Recover audio output");
          ++recoveries;
        } else if (count == 0) {
          alsa_check(snd_pcm_wait(pcm.get(), 100), "Wait for audio output");
        } else {
          written += count;
        }
      }
      ++blocks;
    }
    alsa_check(stopped ? snd_pcm_drop(pcm.get()) : snd_pcm_drain(pcm.get()), "Stop audio output");
    std::cerr << "Stopped; " << recoveries << " audio recoveries\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "8f4e-runtime: " << error.what() << '\n';
    return 1;
  }
}
