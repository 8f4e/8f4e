# DX7 algorithm 5 presets

Each `.8f4em` file exposes a single `constants preset` block through `; @public`, so it can be inserted from
**Add Built-in Block → Presets → Dx7 Algorithm 5**. In the [eight-voice MIDI example](../../../projects/midi/dx7Algorithm5EightVoices.8f4e),
open the `dx7` group and move the `preset` block furthest right to select it for all voices.

The library contains factory, song-inspired, and ambient preset blocks. Source tuning and gains are unchanged.
Hold notes to hear the ambient patches' slow attacks.

| Source                                                                                             | Example modules                                                                                  |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Yamaha / original example                                                                          | `dx7EPiano1`, `dx7TubBells`, `dx7EOrgan4`                                                        |
| [Vivolator / Famous patches, Dexed version](https://rekkerd.org/patches/sound-designer/vivolator/) | `dx7Suitcase73`, `dx7IFeel4U`, `dx7LivinVideo`, `dx7SunGoesDwn`, `dx7TrueHorns`, `dx7StreetNoNm` |
| [The Introvert / AI Pads](https://theintrovert.net/dx7-sound-banks/)                               | `dx7Moidore`, `dx7Rauraci`, `dx7Eleoblast`                                                       |
| [Solyaris / Alienazi](https://solyaris.altervista.org/mesmerism.html)                              | `dx7OpenSpace`, `dx7Nuvole2`, `dx7Penombra`, `dx7SoftWave`                                       |

The Introvert and Solyaris entries are for local audition. Their banks permit use in music but restrict redistribution
of the patches; obtain permission before publishing these entries in an example distribution. Source credits and
local-use notices remain inside each public block when inserted into a project.

The blocks retain keyboard level scaling, pitch-envelope, and pitch/amplitude LFO parameters, including
per-operator amplitude sensitivity and independent LFO key sync. Whether those settings are audible depends on
the consuming voice implementation. The factory E.PIANO 1 block retains zero LFO depths, a flat pitch envelope,
and the original keyboard scaling parameters for operator 6.

Each voice in the MIDI example applies the patch's operator gain normalization.
See [the converter documentation](../../../../../tools/dx7-to-8f4e/README.md) for tuning calibration and scope.
