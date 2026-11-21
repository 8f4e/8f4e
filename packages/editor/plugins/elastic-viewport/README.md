# Elastic viewport

`createElasticViewportPlugin({ prefersReducedMotion })` adds elastic motion to the rendered position of code blocks
while panning. Install it through the editor's regular plugin list. The host supplies a function that reports its current
reduced-motion preference; the plugin does not access the DOM or register input handlers.

Blocks start moving with the viewport right away, then catch up and overshoot slightly. The plugin blends spring
responses by displayed grid-cell area: small blocks lag less and catch up sooner, while large blocks feel heavier.
Blocks with the same area share the same response. The plugin prepares the blend weights when block layouts settle,
including after font grid changes. The renderer applies the same offset to a block and its attached decorations.
Blocks beyond the spring's maximum reach use their ordinary viewport-relative positions, including for offscreen
arrows and connector endpoints.
Logical positions, editing, hit testing and project data are unchanged.

The effect resets during block dragging, animated navigation, project or font-grid changes, unusually large camera
jumps and paused frame sequences. Each installation owns its spring state; unregistering the plugin restores ordinary
rendering immediately.
