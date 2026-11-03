# DX7 to 8f4e

Convert Yamaha DX7 `.syx` files into `constants preset` blocks. Run with the repository's Node 24;
the converter uses only Node built-ins and needs no build or separate installation.

```sh
node tools/dx7-to-8f4e/src/cli.ts bank.syx --algorithm 5 --out presets.8f4e
node tools/dx7-to-8f4e/src/cli.ts bank.syx --name 'E.PIANO 1'
```

The output is a source fragment to paste into a project. Blocks share the `preset` namespace, so moving a block
furthest right selects its values. `--name` selects an exact name, ignoring case, and can be repeated.
`--algorithm` filters by the DX7's displayed algorithm number, 1–32. By default all patches are converted in bank order.
Output goes to stdout, or to `--out`. Diagnostics go to stderr.

Each block starts at `--x` / `--y` (default 0 / 0). Following blocks advance by `--step-x` / `--step-y`
(default 60 / 0). Negative values use the `--y=-10` form. `--source` supplies a credit label; by default this is
the input filename. The source voice number is included in each block.

Both 163-byte single-voice dumps and 4104-byte 32-voice banks are supported, including concatenated dumps and
any MIDI device channel. Framing, declared lengths, 7-bit data, and Yamaha checksums are checked before output.
Other SysEx formats, including DX7II performance data, are rejected.

## Generated parameters

All operator and global voice parameters are retained as named constants, with operators numbered 1–6.
`ALGORITHM` uses display numbering. `TRANSPOSE_SEMITONES` is relative to C3; `DETUNE` retains the raw 0–14 setting.
LFO waveforms and keyboard scaling curves retain their numeric DX7 encodings.

Derived `OPn_RATIO` includes fine tuning, detune, and patch transpose. `OPn_FIXED_HZ` preserves fixed-frequency
operators independently of transpose. Tuning follows the convention used in the examples, based on
[Google's DX7 emulator](https://github.com/google/music-synthesizer-for-android/blob/master/app/src/main/jni/dx7note.cc).
`OPn_GAIN` is output level divided by 100 to match the example's normalized operator envelopes.
Algorithm 5 blocks also include its three mixer gains and output gain.

The blocks target the `preset` namespace used by the `dx7Algorithm5` example. Pitch-envelope, keyboard-scaling,
and LFO parameters are retained intact; their playback behavior belongs to the consuming voice implementation.
Voice implementations may consume a subset of the preserved parameters. Transpose is already included in
`OPn_RATIO` and must not be applied to it again.

Conversion does not make a voice a complete DX7 emulation. The example uses normalized operator envelopes and
approximate tuning; reproducing a source patch also depends on its modulation, envelope, scaling, and performance
controls. Other algorithms need their own operator routing and are identified in a diagnostic.

## Ambient audition presets

The preset library includes these algorithm-5 patches for local audition:

- [The Introvert / AI Pads](https://theintrovert.net/dx7-sound-banks/): MOIDORE, RAURACI, ELEOBLAST,
  from `DeepDX-More Pads.syx`.
- [Solyaris / Alienazi](https://solyaris.altervista.org/mesmerism.html): OpenSpace, Nuvole 2, Penombra,
  from `DX7/alienazi_1-32.syx`, and soft wave from `DX7/alienazi_33-64.syx`.

These banks permit use in music but restrict redistribution of the patches. The imported constants are for local
trial; obtain the authors' permission before including them in a published example distribution.
Hold notes when auditioning: several pads have very slow attacks and long release tails.

All 16 presets converted so far are also saved as public constants-block examples under
[`packages/examples/src/modules/presets/dx7-algorithm-5`](../../packages/examples/src/modules/presets/dx7-algorithm-5/README.md),
including six Vivolator patches. The editor discovers them automatically in
**Add Built-in Block → Presets → Dx7 Algorithm 5**. The ambient entries retain their local-audition restrictions.

For example, generate the Introvert blocks with:

```sh
node tools/dx7-to-8f4e/src/cli.ts 'DeepDX-More Pads.syx' \
  --name MOIDORE --name RAURACI --name ELEOBLAST \
  --source 'The Introvert / AI Pads (local audition)' \
  --x 348 --y 35 --step-x 0 --step-y 7 --out presets.8f4e
```

## Development

This is a standalone tool, like `tools/project-preview`. Its development commands use the root repository's
installed TypeScript, Vitest, and Biome dependencies:

```sh
npm --prefix tools/dx7-to-8f4e test
npm --prefix tools/dx7-to-8f4e run typecheck
npm --prefix tools/dx7-to-8f4e run lint
```
