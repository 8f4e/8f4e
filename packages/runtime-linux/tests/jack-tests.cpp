#include <jack/jack.h>
#include <jack/midiport.h>
#include <atomic>
#include <chrono>
#include <csignal>
#include <iostream>
#include <memory>
#include <spawn.h>
#include <stdexcept>
#include <sys/wait.h>
#include <thread>

extern char **environ;

struct Probe {
  jack_port_t *left;
  jack_port_t *right;
  jack_port_t *midi;
  std::atomic<int> phase{0};
  std::atomic<int> matched_phase{-1};
  std::atomic<bool> timed_transition{false};
  int previous_phase = -1;
  unsigned int cycles = 0;

  static int process(jack_nframes_t frames, void *argument) {
    auto &self = *static_cast<Probe *>(argument);
    const auto phase = self.phase.load();
    auto *midi = jack_port_get_buffer(self.midi, frames);
    jack_midi_clear_buffer(midi);
    if (phase == 1) {
      const jack_midi_data_t sysex[]{0xf0, 1, 2, 0xf7};
      jack_midi_event_write(midi, 0, sysex, sizeof(sysex));
    } else if (phase == 2) {
      const jack_midi_data_t note[]{0x90, 64, 96};
      jack_midi_event_write(midi, frames / 2, note, sizeof(note));
    }
    const auto *left = static_cast<const float *>(jack_port_get_buffer(self.left, frames));
    const auto *right = static_cast<const float *>(jack_port_get_buffer(self.right, frames));
    if (phase == 2 && frames == 256 && left[0] == 0.125f && left[127] == 0.125f &&
        left[128] == 0.5f && left[255] == 0.5f && right[0] == -0.25f && right[128] == -0.75f) {
      self.timed_transition = true;
    }
    const float expected_left = phase == 2 ? 0.5f : 0.125f;
    const float expected_right = phase == 2 ? -0.75f : -0.25f;
    bool matches = true;
    for (jack_nframes_t i = 0; i < frames; ++i) {
      if (left[i] != expected_left || right[i] != expected_right) matches = false;
    }
    // Wait several cycles after each phase change so the SysEx check sees its effect.
    if (self.previous_phase != phase || !matches) self.cycles = 0;
    self.previous_phase = phase;
    if (matches && ++self.cycles >= 20) self.matched_phase = phase;
    return 0;
  }
};

struct Child {
  pid_t pid = -1;
  ~Child() {
    if (pid > 0) {
      kill(pid, SIGTERM);
      waitpid(pid, nullptr, 0);
    }
  }
};

int main(int argc, char **argv) {
  try {
    if (argc != 2) throw std::runtime_error("Expected generated runtime launch script");
    Probe probe{};
    jack_status_t status{};
    const std::unique_ptr<jack_client_t, decltype(&jack_client_close)> client(
        jack_client_open("8f4e-probe", static_cast<jack_options_t>(JackNoStartServer | JackUseExactName), &status),
        jack_client_close);
    if (!client) throw std::runtime_error("Cannot open JACK test client");
    probe.left = jack_port_register(client.get(), "left", JACK_DEFAULT_AUDIO_TYPE, JackPortIsInput, 0);
    probe.right = jack_port_register(client.get(), "right", JACK_DEFAULT_AUDIO_TYPE, JackPortIsInput, 0);
    probe.midi = jack_port_register(client.get(), "midi", JACK_DEFAULT_MIDI_TYPE, JackPortIsOutput, 0);
    if (!probe.left || !probe.right || !probe.midi) throw std::runtime_error("Cannot register test ports");
    jack_set_process_callback(client.get(), Probe::process, &probe);
    if (jack_activate(client.get()) != 0) throw std::runtime_error("Cannot activate JACK test client");
    Child child;
    char shell[] = "sh";
    char *arguments[]{shell, argv[1], nullptr};
    if (posix_spawnp(&child.pid, shell, nullptr, nullptr, arguments, environ) != 0) {
      throw std::runtime_error("Cannot launch runtime");
    }
    for (int phase = 0; phase <= 2; ++phase) {
      probe.phase = phase;
      const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
      while (probe.matched_phase != phase) {
        if (std::chrono::steady_clock::now() >= deadline) {
          throw std::runtime_error("JACK audio/MIDI phase timed out: " + std::to_string(phase));
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
      }
    }
    if (jack_get_buffer_size(client.get()) == 256 && !probe.timed_transition) {
      throw std::runtime_error("MIDI must affect the second WASM block, not the start of the JACK cycle");
    }
    kill(child.pid, SIGTERM);
    int result = 0;
    waitpid(child.pid, &result, 0);
    child.pid = -1;
    jack_deactivate(client.get());
    if (!WIFEXITED(result) || WEXITSTATUS(result) != 0) throw std::runtime_error("Runtime did not stop cleanly");
    std::cout << "JACK stereo routing, MIDI note input, ignored SysEx and clean shutdown passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
