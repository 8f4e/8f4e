# Capturing Audio Buffers as Raw Files

`cli capture` can be used to render any 8f4e project that writes generated
audio into a buffer in module memory.

This is useful when a project:

- writes audio samples into a `float[]` or `int[]` buffer
- expects external binary assets such as PCM samples or pattern data
- should be rendered offline into a raw binary file for later inspection or
  import into an editor such as Audacity

The general workflow is:

1. Load any required binary assets into the project’s memory with
   `--load-file`
2. Run `cycle()` enough times to fill one output buffer
3. Capture that buffer
4. Repeat the process many times
5. Save the concatenated raw bytes to disk

The raw output format is inferred directly from the 8f4e buffer type.

Examples:

- `float[]` buffer → raw `float32`
- `int[]` buffer → raw `int32`
- `int8[]` buffer → raw signed 8-bit bytes

## Generic Command Shape

```bash
cli capture /path/to/project.8f4e \
  --load-file moduleA:buffer=/path/to/asset-a.bin \
  --load-file moduleB:buffer=/path/to/asset-b.bin \
  --buffer audiooutL:buffer \
  --cycles 128 \
  --repeat 1000 \
  --out /tmp/render.bin
```

Meaning:

- `--load-file`
  Writes raw bytes into a target memory item before capture starts. This can be
  repeated multiple times.
- `--buffer`
  Selects the source buffer to extract after each run window.
- `--cycles`
  Controls how many `cycle()` calls happen before one extraction.
- `--repeat`
  Controls how many extracted chunks are concatenated.
- `--out`
  Writes the concatenated raw binary file.

## Choosing `--cycles`

For projects that fill an audio buffer over time, `--cycles` must match the
actual audio buffer size.

For example, if a project writes into:

```8f4e
float[] buffer AUDIO_BUFFER_SIZE
```

and `AUDIO_BUFFER_SIZE` is `128`, then:

```bash
--cycles 128
```

means:

- execute `cycle()` once per generated sample
- fill one full output audio buffer
- extract that whole buffer
- repeat

This is how the CLI knows when the buffer is ready to be captured.

If `--cycles` does not match the actual output buffer size, the captured file
will be wrong because the CLI will snapshot the buffer too early or too late,
while it is only partially updated or already being overwritten.

## Example: `lowerIntentions`

Concrete project:

- `examples/src/projects/audio/amigaMods/lowerIntentions.8f4e`

This project:

- writes its audio output to `audiooutL:buffer` and `audiooutR:buffer`
- expects pattern data and PCM samples to be preloaded into memory

### 1. Download the Referenced Assets

There is currently no CLI tool that automatically collects and downloads the
assets referenced by an `.8f4e` file.

So for this project, the pattern files and sample files need to be gathered
first and then loaded explicitly with `--load-file`.

If you do not want to do that manually, you can ask your AI agent to inspect
the project, collect the referenced asset URLs, download them, and assemble the
full `cli capture` command for you.

```bash
ASSET_DIR="/tmp/8f4e-lowerintentions-assets"
mkdir -p "$ASSET_DIR"

for url in \
  "https://static.8f4e.com/assets/mods/lowerintentions/patterns_ch1.bin" \
  "https://static.8f4e.com/assets/mods/lowerintentions/patterns_ch2.bin" \
  "https://static.8f4e.com/assets/mods/lowerintentions/patterns_ch3.bin" \
  "https://static.8f4e.com/assets/mods/lowerintentions/patterns_ch4.bin" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_1.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_2.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_3.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_4.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_5.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_6.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_7.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_9.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_10.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_11.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_12.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_13.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_14.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_15.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_16.pcm" \
  "https://static.8f4e.com/assets/mods/lowerintentions/sample_17.pcm"
do
  curl -fsSL "$url" -o "$ASSET_DIR/$(basename "$url")"
done
```

### 2. Capture the Left Channel

```bash
ASSET_DIR="/tmp/8f4e-lowerintentions-assets"

node apps/cli/bin/cli.js capture \
  examples/src/projects/audio/amigaMods/lowerIntentions.8f4e \
  --load-file rowBuffer1:_dat="$ASSET_DIR/patterns_ch1.bin" \
  --load-file rowBuffer2:_dat="$ASSET_DIR/patterns_ch2.bin" \
  --load-file rowBuffer3:_dat="$ASSET_DIR/patterns_ch3.bin" \
  --load-file rowBuffer4:_dat="$ASSET_DIR/patterns_ch4.bin" \
  --load-file samplePack1:sample1="$ASSET_DIR/sample_1.pcm" \
  --load-file samplePack1:sample2="$ASSET_DIR/sample_2.pcm" \
  --load-file samplePack1:sample3="$ASSET_DIR/sample_3.pcm" \
  --load-file samplePack1:sample4="$ASSET_DIR/sample_4.pcm" \
  --load-file samplePack1:sample5="$ASSET_DIR/sample_5.pcm" \
  --load-file samplePack1:sample6="$ASSET_DIR/sample_6.pcm" \
  --load-file samplePack1:sample7="$ASSET_DIR/sample_7.pcm" \
  --load-file samplePack1:sample9="$ASSET_DIR/sample_9.pcm" \
  --load-file samplePack2:sample10="$ASSET_DIR/sample_10.pcm" \
  --load-file samplePack2:sample11="$ASSET_DIR/sample_11.pcm" \
  --load-file samplePack2:sample12="$ASSET_DIR/sample_12.pcm" \
  --load-file samplePack2:sample13="$ASSET_DIR/sample_13.pcm" \
  --load-file samplePack2:sample14="$ASSET_DIR/sample_14.pcm" \
  --load-file samplePack2:sample15="$ASSET_DIR/sample_15.pcm" \
  --load-file samplePack2:sample16="$ASSET_DIR/sample_16.pcm" \
  --load-file samplePack2:sample17="$ASSET_DIR/sample_17.pcm" \
  --buffer audiooutL:buffer \
  --cycles 128 \
  --repeat 67500 \
  --out /tmp/lowerintentions-left-full.f32
```

### 3. Capture the Right Channel

Use the same command as the left channel, but change the captured buffer from
`audiooutL:buffer` to `audiooutR:buffer` and write to a different output file:

```bash
ASSET_DIR="/tmp/8f4e-lowerintentions-assets"

node apps/cli/bin/cli.js capture \
  examples/src/projects/audio/amigaMods/lowerIntentions.8f4e \
  --load-file rowBuffer1:_dat="$ASSET_DIR/patterns_ch1.bin" \
  --load-file rowBuffer2:_dat="$ASSET_DIR/patterns_ch2.bin" \
  --load-file rowBuffer3:_dat="$ASSET_DIR/patterns_ch3.bin" \
  --load-file rowBuffer4:_dat="$ASSET_DIR/patterns_ch4.bin" \
  --load-file samplePack1:sample1="$ASSET_DIR/sample_1.pcm" \
  --load-file samplePack1:sample2="$ASSET_DIR/sample_2.pcm" \
  --load-file samplePack1:sample3="$ASSET_DIR/sample_3.pcm" \
  --load-file samplePack1:sample4="$ASSET_DIR/sample_4.pcm" \
  --load-file samplePack1:sample5="$ASSET_DIR/sample_5.pcm" \
  --load-file samplePack1:sample6="$ASSET_DIR/sample_6.pcm" \
  --load-file samplePack1:sample7="$ASSET_DIR/sample_7.pcm" \
  --load-file samplePack1:sample9="$ASSET_DIR/sample_9.pcm" \
  --load-file samplePack2:sample10="$ASSET_DIR/sample_10.pcm" \
  --load-file samplePack2:sample11="$ASSET_DIR/sample_11.pcm" \
  --load-file samplePack2:sample12="$ASSET_DIR/sample_12.pcm" \
  --load-file samplePack2:sample13="$ASSET_DIR/sample_13.pcm" \
  --load-file samplePack2:sample14="$ASSET_DIR/sample_14.pcm" \
  --load-file samplePack2:sample15="$ASSET_DIR/sample_15.pcm" \
  --load-file samplePack2:sample16="$ASSET_DIR/sample_16.pcm" \
  --load-file samplePack2:sample17="$ASSET_DIR/sample_17.pcm" \
  --buffer audiooutR:buffer \
  --cycles 128 \
  --repeat 67500 \
  --out /tmp/lowerintentions-right-full.f32
```

## Importing the Result into Audacity

When the source buffer is a `float[]`, import the output files as:

- `32-bit float`
- `little-endian`
- `48000 Hz`

If you exported left and right channels separately:

- import each as mono
- assign one to left and one to right
