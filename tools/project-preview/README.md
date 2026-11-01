# Project preview CLI

Generates GIF preview images from 8f4e project files with the production editor renderer.

This is a standalone npm package rather than an Nx project. Install its dependencies separately after cloning:

```sh
npm --prefix tools/project-preview ci
```

## Icon previews

The `icon` format finds the first valid `@home` code block, or falls back to the first root code block, places its
top-left corner at the configured position, hides editor-only overlays, and captures a square image. The defaults
remain a 64 by 64 pixel image with the code block at `(0, 0)`.

```sh
npm --prefix tools/project-preview run build
node tools/project-preview/bin/8f4e-preview.js icon path/to/project.8f4e --out path/to/icon.gif
```

Set the output size independently with `--size`. Use `--offset-x` and `--offset-y` to place the code block inward
from the image's top-left corner; negative offsets crop farther into the block.

```sh
node tools/project-preview/bin/8f4e-preview.js icon path/to/project.8f4e \
	--out path/to/preview.gif --size 256 --offset-x 24 --offset-y 32
```

For audio projects, `--start-at` accepts the AudioWorklet permission and waits for the given number of milliseconds
before the first capture. This lets scopes and other runtime-driven UI fill with rendered values. Projects that need
keyboard, MIDI or microphone input may still require additional interaction to produce a visible signal. The older
`--run-for` spelling remains available as an alias.

```sh
node tools/project-preview/bin/8f4e-preview.js icon path/to/audio-project.8f4e \
	--out path/to/preview.gif --size 256 --start-at 1500
```

Animated previews are assembled directly from individual screenshots and loop forever. `--capture-interval` controls
the time between screenshots, while `--fps` independently controls their playback speed. For example, this captures
four frames at 5, 6, 7 and 8 seconds, then plays them at 2 frames per second:

```sh
node tools/project-preview/bin/8f4e-preview.js icon path/to/audio-project.8f4e \
	--out path/to/preview.gif --size 256 --start-at 5000 \
	--capture-interval 1000 --frames 4 --fps 2
```

GIF output is silently quantized to an optimized palette of at most 256 colors with dithering disabled. When `--out`
is omitted, the image is written next to the project as `<project-name>.icon.gif`.

Regenerate all committed example and compiler-test gallery icons manually with:

```sh
npm --prefix tools/project-preview run generate-gallery-previews
```

The package also exports `generateProjectPreview` for programmatic use.
