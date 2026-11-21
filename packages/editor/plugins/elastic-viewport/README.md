# Elastic viewport

`createElasticViewportPlugin({ prefersReducedMotion })` adds elastic motion to the rendered position of code blocks
while panning. Install it through the editor's regular plugin list. The host supplies a function that reports its current
reduced-motion preference; the plugin does not access the DOM or register input handlers.

Blocks already in view start moving with the viewport right away, then catch up and overshoot slightly. The plugin blends spring
responses by displayed grid-cell area: small blocks lag less and catch up sooner, while large blocks feel heavier.
Blocks with the same area share the same response. The plugin prepares the blend weights when block layouts settle,
including after font grid changes. The renderer applies the same offset to a block and its attached decorations.
During a manual pan, an entering block can hold just outside the edge until its ordinary elastic position is 96 pixels
inside by default. Then it springs into view and settles. If the pull stops while the block is still held, it releases
after a short pause.
Keyboard navigation and other viewport jumps do not use this effect.
Blocks beyond the spring's maximum reach use their ordinary viewport-relative positions, including for offscreen
arrows and connector endpoints.
Logical positions, editing, hit testing and project data are unchanged.

The effect resets during block dragging, animated navigation, project or font-grid changes, unusually large camera
jumps and paused frame sequences. Each installation owns its spring state; unregistering the plugin restores ordinary
rendering immediately.

## Tuning

Only `prefersReducedMotion` is required. You can override individual settings within each group and leave the rest at
their defaults. For example, this softens the bounce and releases entering blocks sooner:

```ts
createElasticViewportPlugin({
  prefersReducedMotion,
  spring: { dampingRatio: 0.8 },
  entry: { releaseDistancePixels: 64 },
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `maxFrameGapMs` | `150` | Reset the effect after a longer gap between frames. |
| `maxCameraStepPixels` | `240` | Reset the effect after a larger camera movement in one frame. |
| `spring.dampingRatio` | `0.63` | Greater than `0` and at most `1`. Lower values bounce more; `1` removes spring overshoot. |
| `spring.restDistancePixels` | `0.25` | Positive distance from rest below which a slow spring can stop. |
| `spring.restSpeedPixelsPerSecond` | `1` | Positive speed below which a spring near rest can stop. |
| `pan.maxOffsetPixels` | `48` | Cap on each shared pan spring's offset before its influence is applied. |
| `entry.releaseDistancePixels` | `96` | How far the ordinary elastic position must enter before release; also caps the entry spring's displacement. |
| `entry.idleReleaseMs` | `90` | Release a held block once it has gone this long without being pulled farther in. |
| `entry.frequency` | `23` | Entry spring frequency in radians per second. |

`pan.sizeProfiles` is a nonempty list ordered by increasing `gridCells`. Each profile sets a frequency in radians per
second and an `influence` that scales the shared spring's offset. The defaults are:

| `gridCells` | `frequency` | `influence` |
| ---: | ---: | ---: |
| 80 | 26 | 0.22 |
| 200 | 21 | 0.35 |
| 500 | 17 | 0.5 |
| 900 | 13 | 0.64 |
