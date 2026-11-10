---
title: 'TODO: Explore performance controls and custom banks for Grids'
priority: Medium
effort: TBD
created: 2026-11-10
issue: null
status: Open
completed: null
---

# TODO: Explore performance controls and custom banks for Grids

The [Grids example](../../packages/examples/src/projects/audio/gridsPatterns.8f4e) has six 5×5 banks, X/Y morphing,
and separate kick, snare, and hi-hat density controls. Each bank has a lookup table pointing to editable patterns
with 32 steps. Explore ways to perform with these banks and create new ones in the same format.

## First pass

- **Hold-to-fill.** Start with a momentary snare roll. Keep the main playhead running during the fill so releasing
  the button returns to the current step of the underlying groove. Other Truchets fills build up across the kit or
  temporarily jump to another X/Y position. [Truchets drum fills](https://dylan-bolink.github.io/eurorack/marbles/#drum-fill-hold-t-range-12)
- **Snap/Morph.** Keep the current interpolated X/Y playback as the default. In Snap mode, read the closest of the
  25 authored patterns from the selected bank's lookup table. [Truchets pattern banks](https://dylan-bolink.github.io/eurorack/marbles/#pattern-banks)

## Further performance controls

- **Master density.** Sweep the whole kit with one control and use the three instrument controls as trims around
  the master. This lets a hat-heavy or kick-heavy balance carry through the sweep. [Sorrow density controls](https://github.com/Eight4aWish/eurorack_daisy_patch_init/blob/main/daisy_grids/README.md#kit-led-steady-on)
- **Swing and groove offset.** Try classic and tresillo swing in the clock. Explore independent kick or snare
  delays for shifting the feel of a groove. [Truchets timing controls](https://dylan-bolink.github.io/eurorack/marbles/#groove-offset-x-bias)
- **Velocity from pattern levels.** Add a mode that uses each interpolated step level to set gain when the sample
  triggers and holds that gain for the hit. The current patch uses two gain levels for normal and accented hits.
  [Truchets accent variation](https://dylan-bolink.github.io/eurorack/marbles/#accent-variation-length)

## Custom banks from MIDI

Explore a separate offline importer that takes a collection of MIDI drum loops, maps notes to kick, snare, and
hi-hat, and selects 25 representative one-bar patterns on the 32-step grid. Arrange neighboring cells so X/Y
movement produces meaningful variation. Emit the existing 8f4e pattern modules with one decimal row per step and
a bank lookup table in X/Y order. [Sorrow bank generation](https://github.com/Eight4aWish/eurorack_daisy_patch_init/blob/main/daisy_grids/tools/grids_firmware/README.md)

## Success criteria for the first pass

- [ ] Holding Fill changes the groove and releasing it returns to the step the underlying pattern has reached.
- [ ] Snap plays the expected authored pattern across all six banks, and Morph keeps the existing interpolation.
- [ ] The example opens in Morph mode with the original bank selected and Fill released.
