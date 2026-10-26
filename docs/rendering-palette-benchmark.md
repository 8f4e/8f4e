# GPU palette storage benchmark

Measured on 2026-10-26 for [issue #1254](https://github.com/8f4e/8f4e/issues/1254).
The change replaces the RGBA8 palette texture with a 256-entry std140 uniform buffer and prepares premultiplied
float32 colors when the palette changes. The public palette input remains straight-alpha RGBA8.

## Method

The baseline renderer is `fbf7f9834b6e244045237a445d9bc37b4773773f` in the `glugglugglug` submodule. Both variants
use the same generated IBM VGA 8×16 R8 atlas, 189-entry palette, 1024×768 canvas, draw order, blend mode, and
20-byte instance records. The test palette includes opaque and partially transparent colors.

The harness uses two separate Chrome contexts and alternates their measurement order between batches. Each scene
gets 30 warmup frames followed by six batches of 12 measured frames per variant. Three independent runs provide
216 CPU and GPU samples per scene and variant. CPU time surrounds `renderFrame`; GPU time uses
`EXT_disjoint_timer_query_webgl2`. GPU completion waits happen outside the CPU interval, and disjoint GPU samples
are discarded. There were no disjoint samples in these runs.

Machine: Apple M1 Pro, Darwin 23.6.0, Chrome 155.0.8059.86, ANGLE Metal renderer. The isolated page's CPU timer
resolution was 0.005 ms. These measurements include browser submission overhead and do not estimate full editor FPS.

The synthetic scenes draw 10,000 and 50,000 glyphs in five colors, with intentional overlap on the fixed canvas.
The editor scene invokes the real background and code-block drawers, `DrawContext`, and code-cell projection for
six static, syntax-colored code blocks, including a disabled block. It includes background patterns, fills, borders,
text, and partial alpha. It does not run the full application, compiler, animated wires, or widget plugins.

## Results

Values are milliseconds: the median of the three per-run medians, followed by their minimum–maximum range.

| Scene | CPU, texture | CPU, uniform buffer | GPU, texture | GPU, uniform buffer |
| --- | --- | --- | --- | --- |
| 10,000 glyphs | 0.165 (0.150–0.175) | 0.160 (0.150–0.175) | 0.405 (0.394–0.411) | 0.412 (0.407–0.418) |
| 50,000 glyphs | 0.915 (0.868–1.008) | 0.913 (0.840–0.915) | 1.606 (1.579–1.615) | 1.594 (1.591–1.597) |
| Editor drawers, 2,305 sprites | 0.095 (0.093–0.110) | 0.095 (0.095–0.095) | 0.499 (0.466–0.506) | 0.469 (0.464–0.479) |

The measurements do not establish a repeatable general rendering speedup. The 10,000-glyph GPU case is slightly
slower; the 50,000-glyph case is similar. The editor fixture has a lower aggregate GPU median, but the first run is
effectively equal and the baseline varies between runs. Individual timing distributions overlap substantially.
CPU submission medians are similar. Removing one texture lookup and per-vertex premultiplication therefore should
not be presented as a demonstrated performance improvement on this machine.

All three scenes produce matching pixel hashes between variants in every run. The hashes are `7d56e4bf`, `a83d3e4d`,
and `de4bcfd4`, respectively. Both variants use one sprite draw per frame and upload 200,000, 1,000,000, and 46,100
instance bytes for those scenes.

## Storage tradeoff

| Resource | Texture palette | Uniform-buffer palette |
| --- | ---: | ---: |
| Public 189-color RGBA8 input | 756 bytes | 756 bytes |
| GPU palette allocation, excluding driver overhead | 756 bytes | 4,096 bytes |
| Active float32 color data within allocation | — | 3,024 bytes |
| R8 mask atlas | 98,304 bytes | 98,304 bytes |
| Sprite rectangle metadata | 1,040 bytes | 1,040 bytes |
| Instance record | 20 bytes | 20 bytes |

The GPU palette allocation grows by 3,340 bytes. All 256 slots are backed and unused slots are zero-filled.
Changed palette uploads now send 4,096 bytes instead of 756; equivalent updates still skip preparation and upload.
The renderer retains both its private RGBA8 copy and the prepared float32 block for equality checks and restoration.
The renderer limit is deliberately 256 colors, replacing the former texture-dependent limit; no compatibility mode
or additional public palette API is retained.

## Reproduce

From the repository root, with Chrome installed:

```sh
nvm use
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true npx nx run @8f4e/editor-core:build
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true npx nx exec \
  --projects=@8f4e/web-ui --excludeTaskDependencies -- \
  node "$PWD/tools/rendering/benchmark-palette-storage.mjs" \
  --baseline fbf7f9834b6e244045237a445d9bc37b4773773f \
  --output /tmp/palette-storage.json
```

Repeat the benchmark three times to assess variation. JSON output includes raw samples, per-run medians,
10th/90th percentiles, pixel hashes, upload counts, hardware, and browser information. The harness reads baseline
sources from Git and transpiles them into a temporary directory; the current renderer uses its built `dist` output.
It serves a temporary loopback port and cleans up the browser, server, and temporary sources on completion.

## Correctness checks

- 230 unit tests passed across the renderer, web UI, and editor core; renderer, web UI, and editor core typechecks passed.
- 45 browser checks passed across the renderer, web UI, font atlas, tooltips, and widget drawers without baseline changes.
  Font atlas checks used an isolated port because the standard port was occupied by the local metrics dashboard.
- Browser pixel checks cover partial alpha and R8 coverage, palette replacement, release/restore, slot 255, and recovery
  of both uniform-block mapping and buffer binding after a raw render hook changes them.
- Renderer tests cover premultiplication, zero-filled unused slots, palette shrinking, 1/256-entry bounds, rejected
  inputs, equivalent updates, private data ownership, allocation/upload exceptions, and resource disposal.
- Both editor and product website production builds passed.
