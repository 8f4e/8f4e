# Loose wires plugin

Install `createLooseWiresPlugin()` from `@8f4e/editor-plugin-loose-wires` in place of the straight wire plugin. The gallery
editor loads it after the first render. It resolves its own connections from compiler metadata and live memory and
does not depend on the straight wire or connector sprite plugins. Endpoints follow the blocks' rendered positions,
including when blocks are offscreen. The connection tracker observes accepted compiler metadata changes separately
from settled block layouts.

The drawer batches one instance per wire. Its vertex shader calculates a downward sag from the horizontal span (capped
at 96 canvas pixels) and generates short segments. Its fragment shader draws them on the pixel grid and skips shared
starts so translucent joins do not darken. Nearly vertical connections stay straight. The plugin retains the selected
input highlight and hides wires while dialogs are open.

Set `; @config looseWires.slack 0.5` in the project to tune the sag as a fraction of each wire's horizontal span.
The built-in default is `0.25`; `0` draws straight wires, and values above `1` are treated as `1`.
Hosts can use `createLooseWiresPlugin({ defaultSlack: 0.5 })` to change the fallback when the project doesn't specify
one. The gallery uses the built-in fallback without passing options.

Palette changes, GPU memory release, and disposal follow the editor's render-layer lifecycle. Verify with
`npx nx run @8f4e/editor-plugin-loose-wires:test:screenshot` and `npx nx run @8f4e/8f4e-website:test:browser`.
