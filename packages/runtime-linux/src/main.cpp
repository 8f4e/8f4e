#include "program.hpp"

#include <jack/jack.h>
#include <jack/midiport.h>
#include <algorithm>
#include <atomic>
#include <charconv>
#include <chrono>
#include <cmath>
#include <csignal>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {
volatile std::sig_atomic_t stopped = 0;
void stop(int) { stopped = 1; }

struct Options {
  std::string wasm;
  std::optional<unsigned int> left;
  std::optional<unsigned int> right;
  unsigned int buffer_size = 128;
  std::string client_name = "8f4e";
  bool midi = true;
  std::string entry = "buffer";
  std::string callback = "onMidiEvent";
  unsigned int sample_rate = 48000;
  unsigned int blocks = 0;
  float gain = 0.25f;
};

const char *usage =
    "Usage: 8f4e-runtime <program.wasm> --left <byte-address> [options]\n"
    "  --left <byte-address>  Float32 left output buffer (required, decimal bytes)\n"
    "  --right <byte-address> Right output buffer (default: same as left)\n"
    "  --buffer-size <samples> Samples generated per WASM block (default: 128)\n"
    "  --sample-rate <hz>     Required JACK/project sample rate (default: 48000)\n"
    "  --client-name <name>   JACK client name (default: 8f4e)\n"
    "  --no-midi             Disable MIDI input and its WASM callback\n"
    "  --gain <number>        Output gain before clipping (default: 0.25)\n"
    "  --entry <export>       Audio block function (default: buffer)\n"
    "  --midi-callback <export> MIDI function (default: onMidiEvent)\n"
    "  --blocks <count>       Stop after this many WASM blocks (default: continuous)\n"
    "Hardware audio and MIDI ports connect automatically, including newly attached devices.\n";

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
  for (int i = 2; i < argc; ++i) {
    const std::string flag = argv[i];
    if (flag == "--no-midi") {
      result.midi = false;
      continue;
    }
    if (i + 1 == argc) throw std::runtime_error("Missing value for " + flag);
    const std::string value = argv[++i];
    if (flag == "--client-name") result.client_name = value;
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

void jack_check(int result, const std::string &operation) {
  if (result != 0) throw std::runtime_error(operation + " failed (JACK error " + std::to_string(result) + ")");
}

struct Playback {
  Program &program;
  const Options &config;
  std::vector<float> stereo;
  std::size_t cursor;
  unsigned int blocks = 0;
  jack_port_t *left = nullptr;
  jack_port_t *right = nullptr;
  jack_port_t *midi = nullptr;
  std::atomic<bool> finished{false};
  std::atomic<bool> server_stopped{false};
  std::atomic<bool> rate_changed{false};
  std::atomic<bool> ports_changed{true};
  std::exception_ptr error;
  std::once_flag initialized;

  Playback(Program &program, const Options &config)
      : program(program), config(config), stereo(program.frames() * 2), cursor(program.frames()) {}

  static void initialize(void *argument) noexcept {
    auto &self = *static_cast<Playback *>(argument);
    // JACK2 also invokes this hook on its message-buffer thread. Initialize the store once,
    // and make the playback thread wait here if another JACK thread reached the hook first.
    std::call_once(self.initialized, [&] {
      try {
        self.program.initialize();
      } catch (...) {
        self.error = std::current_exception();
        self.finished = true;
      }
    });
  }

  static int process(jack_nframes_t frames, void *argument) noexcept {
    auto &self = *static_cast<Playback *>(argument);
    auto *left = static_cast<float *>(jack_port_get_buffer(self.left, frames));
    auto *right = static_cast<float *>(jack_port_get_buffer(self.right, frames));
    std::fill_n(left, frames, 0.0f);
    std::fill_n(right, frames, 0.0f);
    if (self.finished || self.server_stopped || self.rate_changed) return 0;
    try {
      auto *midi = self.midi ? jack_port_get_buffer(self.midi, frames) : nullptr;
      const auto event_count = midi ? jack_midi_get_event_count(midi) : 0;
      uint32_t event_index = 0;
      jack_midi_event_t event{};
      if (event_count) jack_midi_event_get(&event, midi, 0);
      for (jack_nframes_t frame = 0; frame < frames; ++frame) {
        while (event_index < event_count && event.time <= frame) {
          if (const auto message = midi_message({event.buffer, event.size})) self.program.midi(*message);
          if (++event_index < event_count) jack_midi_event_get(&event, midi, event_index);
        }
        if (self.cursor == self.program.frames()) {
          if (self.config.blocks && self.blocks == self.config.blocks) {
            self.finished = true;
            break;
          }
          self.program.render(self.stereo, self.config.gain);
          self.cursor = 0;
          ++self.blocks;
        }
        left[frame] = self.stereo[self.cursor * 2];
        right[frame] = self.stereo[self.cursor * 2 + 1];
        ++self.cursor;
      }
    } catch (...) {
      self.error = std::current_exception();
      self.finished = true;
      std::fill_n(left, frames, 0.0f);
      std::fill_n(right, frames, 0.0f);
    }
    return 0;
  }
};

// Port discovery and connections stay on the main thread, outside audio processing.
void connect_hardware(jack_client_t *client, Playback &playback) {
  const auto connect = [&](jack_port_t *local, const char *remote, bool input) {
    if (jack_port_connected_to(local, remote)) return;
    const auto *name = jack_port_name(local);
    const auto result = input ? jack_connect(client, remote, name) : jack_connect(client, name, remote);
    // A device may disappear between discovery and connection; retry on the next main-loop iteration.
    if (result != 0 && !jack_port_connected_to(local, remote)) playback.ports_changed = true;
  };
  using PortNames = std::unique_ptr<const char *, decltype(&jack_free)>;
  const PortNames audio(jack_get_ports(client, nullptr, JACK_DEFAULT_AUDIO_TYPE,
                                       JackPortIsPhysical | JackPortIsInput), jack_free);
  if (audio && audio.get()[0]) {
    connect(playback.left, audio.get()[0], false);
    if (audio.get()[1]) connect(playback.right, audio.get()[1], false);
  }
  if (playback.midi) {
    const PortNames midi(jack_get_ports(client, nullptr, JACK_DEFAULT_MIDI_TYPE,
                                        JackPortIsPhysical | JackPortIsOutput), jack_free);
    if (midi) {
      for (auto port = midi.get(); *port; ++port) connect(playback.midi, *port, true);
    }
  }
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
                    config.midi ? config.callback : "");
    Playback playback(program, config);
    jack_status_t status{};
    const std::unique_ptr<jack_client_t, decltype(&jack_client_close)> client(
        jack_client_open(config.client_name.c_str(), static_cast<jack_options_t>(JackNoStartServer | JackUseExactName),
                         &status), jack_client_close);
    if (!client) throw std::runtime_error("Cannot open JACK client; start JACK and choose an unused client name (status " +
                                          std::to_string(status) + ")");
    if (jack_get_sample_rate(client.get()) != config.sample_rate) {
      throw std::runtime_error("JACK sample rate does not match --sample-rate/the compiled project");
    }
    playback.left = jack_port_register(client.get(), "out_left", JACK_DEFAULT_AUDIO_TYPE, JackPortIsOutput, 0);
    playback.right = jack_port_register(client.get(), "out_right", JACK_DEFAULT_AUDIO_TYPE, JackPortIsOutput, 0);
    if (config.midi) {
      playback.midi = jack_port_register(client.get(), "midi_in", JACK_DEFAULT_MIDI_TYPE, JackPortIsInput, 0);
    }
    if (!playback.left || !playback.right || (config.midi && !playback.midi)) {
      throw std::runtime_error("Cannot register JACK ports");
    }
    jack_check(jack_set_thread_init_callback(client.get(), Playback::initialize, &playback), "Set JACK thread initializer");
    jack_check(jack_set_process_callback(client.get(), Playback::process, &playback), "Set JACK process callback");
    jack_check(jack_set_port_registration_callback(client.get(), [](jack_port_id_t, int, void *argument) {
      static_cast<Playback *>(argument)->ports_changed = true;
    }, &playback), "Set JACK port registration callback");
    jack_check(jack_set_sample_rate_callback(client.get(), [](jack_nframes_t rate, void *argument) {
      auto &playback = *static_cast<Playback *>(argument);
      if (rate != playback.config.sample_rate) playback.rate_changed = true;
      return 0;
    }, &playback), "Set JACK sample-rate callback");
    jack_on_shutdown(client.get(), [](void *argument) {
      static_cast<Playback *>(argument)->server_stopped = true;
    }, &playback);
    std::signal(SIGINT, stop);
    std::signal(SIGTERM, stop);
    jack_check(jack_activate(client.get()), "Activate JACK client");
    std::cerr << "Running JACK client " << config.client_name << ": " << config.sample_rate << " Hz, "
              << program.frames() << " samples/WASM block, " << jack_get_buffer_size(client.get()) << " samples/JACK cycle\n";
    while (!stopped && !playback.finished && !playback.server_stopped && !playback.rate_changed) {
      if (playback.ports_changed.exchange(false)) connect_hardware(client.get(), playback);
      std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    const auto deactivated = jack_deactivate(client.get());
    if (playback.error) std::rethrow_exception(playback.error);
    if (playback.server_stopped) throw std::runtime_error("JACK server shut down");
    if (playback.rate_changed) throw std::runtime_error("JACK sample rate changed; recompile/restart with the matching rate");
    jack_check(deactivated, "Deactivate JACK client");
    std::cerr << "Stopped\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "8f4e-runtime: " << error.what() << '\n';
    return 1;
  }
}
