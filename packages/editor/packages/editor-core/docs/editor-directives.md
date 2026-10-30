# Editor Directives

This document defines editor-only directives for code blocks. Core owns generic directive parsing and layout;
`@8f4e/editor-default` installs the optional feature plugins documented here.

## Directive Syntax

Editor directives work in standalone comments and trailing comments on instruction lines:

```txt
; @<directive> <args...>
int gate 0 ; @<directive> <args...>
```

You can also chain multiple directives in one comment line:

```txt
; @pos 1 2 @favorite
```

When directives are chained, parsing starts a new directive at the next `@name` token. Every directive supports
both comment positions. Argument rules belong to each feature; declaration-based argument inference is described
where supported, such as `@watch` and `@meter`.

Examples:

```txt
; @watch counter
; @stack
; @plot &audioBuffer lengthMemory
; @button &gate0 0 1
; @config font ibmvga8x16
```

Memory-related arguments use distinct forms:

- `memoryId` - a named memory item used as a value or identifier, written as `name` or `module:name`. Operators and
  indexes are not allowed.
- `memoryAddress` - writable or directly addressed storage, written as `&name` or `&module:name`.
- `pointerSource` - either a pointer memory such as `bufferPointer` or the start address of direct memory such as
  `&buffer`.
- `typedValueSource` - a plain scalar or pointer memory, or an address-of form such as `&buffer` when the directive reads
  from direct memory.
- `memoryExpression` - the extended debugger syntax supported only by `@watch`, including `&`, `*`, `[]`, `0b`, and
  `0x` modifiers.
- `elementCount` - a positive integer, an integer `memoryId`, or `count(memoryId)`.

These directives are editor metadata only. They are not compiler instructions and should be ignored by the compiler.

## Group Memory References

Memory-based editor features and input/output connectors share memory-target resolution. A directive on a group block
can refer to that group's exposed memory by its public name. A directive in the enclosing scope can qualify the name
with the group, using the same argument form it uses for ordinary module memory.

```txt
group audio
expose gain &voice:level
; @slider &gain 0 1 0.01
; @watch gain

module voice
float level 0.5
moduleEnd
groupEnd
```

Within an entry, this group displays controls for `voice`'s `level` on the group block. A module in the enclosing scope
can address the same storage with `&audio:gain`, or watch its value with `audio:gain`. Nested group names resolve relative
to the current project scope; a path containing `/`, such as `audio/nested:gain`, identifies a canonical group path.

Each directive retains its supported argument forms and type requirements. Exposures inherit the backing declaration's
type for controls and runtime access. Group connectors use the same pointer classification as module connectors:
pointers are inputs, and non-pointers are outputs. Aliases allocate no additional memory.

## Supported Directives

### `@mode`

Select the initial editor mode for the whole project. Put exactly one declaration in any project block, including a
block inside a nested group:

```txt
note editor
; @mode edit
noteEnd
```

The argument must be `edit` or `view`. Missing, invalid, or duplicate declarations start the project in view mode;
invalid arguments and duplicates produce editor-directive diagnostics. The compiler ignores this metadata.

The editor applies the mode once when loading or replacing a project, before announcing that the loaded project is
ready. Later source edits, configuration changes, navigation, and undo/redo do not change the active mode. Loading
another project resolves its own declaration independently. Mode changes do not create edits or history entries.

The host's `modeToggling` feature flag controls user mode-switching controls. Disabling it still allows the directive
to choose the initial mode. `state.editorMode` alone determines whether source editing is allowed. Mode changes and
project replacement preserve `codeLineSelection` and all other host feature flags. There is no host initial-mode
option or editing feature flag.

### `@public`

Mark the block exported by a `.8f4em` module file when it is imported from the editor module library.

```txt
; @public
```

Notes:

- Supported public block types are `function`, `module`, `constants`, and `note`.
- A module file should mark the single block that represents the file's reusable public content.
- The editor removes `@public` from the block source when inserting it into a project.
- This directive is editor metadata only and does not affect compiler output.

### `@config`

Set editor configuration values.

```txt
; @config <path> <value>
```

Supported paths:

- `font` - editor font used for rendering code blocks and UI text. Font changes refresh block layouts without
  recentering the viewport.
- `runtime` - runtime host loaded for the project.
- `color.<path>` - editor base palette color. See [Color Paths](./color-paths.md) for the full list of color paths.
- `export.fileName` - base file name used by editor export actions.
- `bin.<id>.url` / `bin.<id>.memory` - binary asset URL and memory load target.
- `bin.<id>.memories.<name>` - additional memory load targets for the same binary asset.
- `keyboard.keyCodeMemory` / `keyboard.keyPressedMemory` - memory ids for browser keyboard state.
- `midi.inputs.<id>.port` / `midi.inputs.<id>.callback` - browser MIDI input bindings.
- `webUI.overlay.<field>` - WebAssembly-generated RGBA texture centered over the editor.

Examples:

```txt
; @config font ibmvga8x16
; @config audioRuntime.enabled true
; @config export.fileName samplePlayer
; @config color.ink #cccccc
; @config color.surface #101820
; @config bin.amen.url https://static.example.com/amen.pcm
; @config bin.amen.memory pcmPlayer:buffer
; @config keyboard.keyCodeMemory keyboard:keyCode
; @config keyboard.keyPressedMemory keyboard:keyPressed
; @config midi.inputs.0.port 0
; @config midi.inputs.0.callback onMidiIn
```

#### Configuration precedence

Configuration is global to the whole project, including nested project groups. When multiple valid directives set
the same path, the last one in spatial order wins:

- Blocks are processed from left to right by their grid position, then top to bottom at the same horizontal position.
- Blocks at the same grid position are processed in creation order, so the later-created block wins.
- Directives within a block are processed from top to bottom, and left to right when chained on one line.
- A project-group block's own directives are processed before its children. Children use the same spatial order in
  their local coordinates, and the entire group subtree is processed before the next sibling block.
- Invalid declarations produce diagnostics and do not replace an earlier valid value. Different paths combine.

Place defaults on the left and customizations on the right. Moving a block past another block can change the
effective configuration as soon as the move completes. Selecting a block or bringing it to the front does not change
precedence. Configuration uses spatial order across block types, even though the saved file groups blocks by type.
Use distinct grid positions for intentional overrides: creation indices are rebuilt when importing `.8f4e` text, so
exact-position ties between different block types can resolve differently after saving and reopening.

#### WASM editor overlay

The web UI can call an exported WebAssembly function every editor frame, read an RGBA8 pixel buffer from memory, and
draw it over the editor. Configure the export name, qualified memory target, source dimensions, and horizontal
position:

```txt
; @config webUI.overlay.entry renderFrame
; @config webUI.overlay.target screen:rgba
; @config webUI.overlay.width 64
; @config webUI.overlay.height 32
; @config webUI.overlay.magnification 4
; @config webUI.overlay.position center
```

The target contains `width * height * 4` bytes in top-to-bottom RGBA order. Pixel alpha controls how strongly the
overlay covers the editor: `0` is transparent and `255` is opaque. The texture always uses nearest-neighbor filtering
and is vertically centered. `webUI.overlay.position` accepts `left`, `center`, or `right`; these place the texture in
the center of the left half, the full viewport, or the right half respectively. It defaults to `center`. An optional
numeric `webUI.overlay.magnification` of at least `1` multiplies both displayed dimensions while preserving the source
aspect ratio; for example, `4` displays each source pixel as a 4 × 4 block.

Supported `font` values:

- `ibmvga8x16`
- `terminus8x16`
- `terminus8x16bold`
- `6x10`
- `terminus10x18`
- `terminus10x18bold`
- `kana12x13`
- `terminus12x24`
- `terminus12x24bold`
- `spleen5x8`
- `spleen6x12`
- `spleen8x16`
- `templeos8x8`
- `spleen12x24`
- `spleen16x32`

### `@watch`

Provided by `@8f4e/editor-plugin-watch`.

Show a runtime debugger value for a memory id.

```txt
; @watch <memoryId>
```

Supported `memoryId` forms:

- `name` - Show the current value.
- `0bname` - Show an integer value in binary.
- `0xname` - Show an integer value in hexadecimal.
- `&name` - Show the start address.
- `name&` - Show the end address.
- `*name` - Dereference a pointer memory.
- `module:name` - Resolve `name` from another module.
- `name[3]` - Show a specific array element.

These modifiers can be combined when they make sense. For example:

```txt
; @watch 0bcounter
; @watch 0xcounter
; @watch &buffer
; @watch pointer&
; @watch *out
; @watch otherModule:value
; @watch buffer[3]
```

### `@stack`

Provided by `@8f4e/editor-plugin-stack`.

Show the compiler's `stackAfter` analysis at a source location. A trailing directive shows the stack after the
instruction on the same line. A standalone directive shows the stack after the preceding compiled instruction.

```txt
push 2
push 3 ; @stack
```

The example displays `[2, 3]`. Each stack item uses its statically known scalar value when one is available; otherwise,
it displays the analyzed type: `int`, `float`, `float64`, or `ptr`. Float values use their WebAssembly runtime precision
and display as the shortest decimal that round-trips to the same `f32` value. For example, a stack whose first value is
unknown and whose second value is known to be `3` displays `[int, 3]`. An empty stack displays `[]`.

The standalone form is equivalent:

```txt
push 2
push 3
; @stack
```

Use `@s` as a shorthand alias for `@stack`.

### `@plot`

Provided by `@8f4e/editor-plugin-plot`.

Draw a plot over a typed pointer range. The first argument provides the start pointer and element type metadata. Use a
plain pointer memory or `&buffer` for direct buffer memory. The second argument is always the element count. You can
optionally provide an explicit min/max range override.

```txt
; @plot <pointerSource> <elementCount>
; @plot <pointerSource> <elementCount> <minValue> <maxValue>
```

Range detection:

- float arrays use `-1..1`
- integer arrays use type-derived bounds, matching `@wave`
- lengths can be positive literal counts, integer memory targets, or `count(buffer)`
- if `minValue` and `maxValue` are specified, they override the type-derived defaults

### `@bars`

Provided by `@8f4e/editor-plugin-bars`.

Draw vertical bars over a typed pointer range. It uses the same pointer, element-count, and optional range arguments as
`@plot`.

```txt
; @bars <pointerSource> <elementCount>
; @bars <pointerSource> <elementCount> <minValue> <maxValue>
```

### `@meter`

Provided by `@8f4e/editor-plugin-meter`.

Render a horizontal level meter from a typed scalar value. The first argument is the typed value source to read. You can
optionally provide an explicit min/max range override.

```txt
; @meter <typedValueSource>
; @meter <typedValueSource> <minValue> <maxValue>
```

Notes:

- plain scalar memories are supported directly
- plain typed pointer memories read from their current pointee address
- `&memory` reads directly from the addressed memory item
- red still starts at a fixed 90% of the configured range

### `@wave`

Provided by `@8f4e/editor-plugin-wave`, which also provides `@wave2` and `@wave4` and is included in
`@8f4e/editor-default`. Hosts composing the minimal editor must include this plugin to enable these directives.

Draw a waveform over a typed absolute pointer range. The first argument provides the start pointer and element size metadata, the second argument is the element count, and the optional third argument is an absolute pointer in the same address space.

```txt
; @wave <pointerSource> <elementCount> [absolutePointerSource]
```

### `@wave2`

Same as `@wave`, but rendered at double height.

```txt
; @wave2 <pointerSource> <elementCount> [absolutePointerSource]
```

### `@wave4`

Same as `@wave`, but rendered at quadruple height.

```txt
; @wave4 <pointerSource> <elementCount> [absolutePointerSource]
```

### `@slider`

Render a slider that writes to a memory address. Provided by `@8f4e/editor-plugin-slider`, included in the default editor.

```txt
; @slider <memoryAddress> [min] [max] [step]
; @slider &gain 0 1 0.01
```

If provided, `min`, `max`, and `step` must be finite decimal numbers, and `step` must be greater than zero.

Use **Save slider values to code** in the block context menu to save current runtime values as declaration
defaults. References to other modules or group aliases update the original backing declarations, including declarations
inside nested groups. The public exposure lines remain unchanged.

### `@crossfade`

Provided by `@8f4e/editor-plugin-crossfade`.

Render a center-origin crossfade control that writes to two float memory addresses. The left address is driven when the
knob moves left, and the right address is driven when the knob moves right.

```txt
; @crossfade <leftFloatAddress> <rightFloatAddress>
; @crossfade &dry &wet
```

Notes:

- both arguments must be memory addresses such as `&dry` and `&wet`
- both bound memories must resolve to float32 scalars
- the written range is fixed to `0..1` on each side

### `@button`

Provided by `@8f4e/editor-plugin-button`, which is included in `@8f4e/editor-default`. Hosts composing the minimal
editor must include this plugin to enable the directive.

Render a momentary button that writes its on value when pressed and its off value when released.

```txt
; @button <memoryAddress> [offValue] [onValue]
```

Defaults:

- `offValue`: `0`
- `onValue`: `1`

### `@switch`

Provided by `@8f4e/editor-plugin-switch`, which is included in `@8f4e/editor-default`. Hosts composing the minimal
editor must include this plugin to enable the directive.

Render a toggle switch that reads and writes a memory address.

```txt
; @switch <memoryAddress> [offValue] [onValue]
```

Defaults:

- `offValue`: `0`
- `onValue`: `1`

### `@piano`

Render a piano keyboard control. Provided by `@8f4e/editor-plugin-piano`, included in the default editor.

```txt
; @piano <pressedKeysListAddress> <pressedKeyCountAddress> [startingMidiNote]
```

Notes:

- Both memory arguments are addresses because piano clicks update the pressed-key array and count directly in runtime
  memory, like sliders. Clicks leave source code and declaration defaults unchanged; note highlights reflect runtime memory.
- Use **Save piano values to code** in the block context menu to save the current notes and count into their
  backing declarations. This preserves array sizes and inline comments, including when aliases target different modules.
- `pressedKeysListAddress` must identify an `int[]` array of MIDI note numbers (32-bit integers).
- `pressedKeyCountAddress` must identify a single `int` count. Other backing types, including `float[]` and `float64[]`
  notes, do not create an interactive keyboard or a save action.
- `startingMidiNote` defaults to `0`.
- `startingMidiNote` must be a non-negative integer.
- Every other note label has a shaded background using the theme's highlighted code line color, starting with the second
  key. All note labels use the theme's code text color.

### Keyboard Memory Config

Keyboard memory targets are configured through `@config`.

```txt
; @config keyboard.keyCodeMemory <moduleId>:<memoryId>
; @config keyboard.keyPressedMemory <moduleId>:<memoryId>
```

Notes:

- The keyboard memory plugin is activated by `@config keyboard...`.
- `keyboard.keyCodeMemory` receives the latest USB HID usage id.
- `keyboard.keyPressedMemory` receives `1` while a tracked key is pressed and `0` when all tracked keys are released or the window blurs.
- Values may use local memory ids inside a module block, or module-qualified memory ids such as `keyboard:keyCode` from any block.
- The plugin runs on the main thread and writes integer values into shared WebAssembly memory.

### MIDI Input Config

MIDI input bindings are configured through `@config`.

```txt
; @config midi.inputs.<id>.port <port>
; @config midi.inputs.<id>.callback <callbackExportName>
```

Notes:

- The MIDI plugin is activated by `@config midi...`; `; @info midi` can display available ports while MIDI is active.
- `<id>` is a binding identifier such as `0`, `1`, etc.
- `<port>` is the numeric input index shown by `; @info midi`.
- MIDI entries are shown as `0`, `1`, etc.; only entries marked `(in)` can be used as input ports.
- Indexes are stable while the MIDI plugin is active; disconnected port indexes are not reused until the plugin is restarted.
- `<callbackExportName>` must be a callable WebAssembly export created with `#export`.
- The callback receives three integer arguments: `status`, `data1`, and `data2`.
- MIDI messages with fewer than three bytes pass missing bytes as `0`.
- Multiple bindings can bind the same input port to different callbacks.
- The same callback export can be bound to multiple input ports.
- The MIDI plugin runs on the main thread and calls exported functions against the shared WebAssembly memory.

Example:

```txt
; @info midi
; @config midi.inputs.0.port 0
; @config midi.inputs.0.callback onMidiIn
; @config midi.inputs.1.port 0
; @config midi.inputs.1.callback onPitchBend
```

### `@tab`

Define a visual tab stop for literal tab characters within the code block.

```txt
; @tab <position1> <position2> ...
```

Notes:

- Each position must be a positive integer visual column.
- One `@tab` directive defines the full active stop list at that point in the block.
- If another valid `@tab` directive appears later, it replaces the active stop list from that line onward.
- A tab advances to the first declared stop strictly greater than the current visual column.
- The minimum tab advance is `1`.
- If no later declared stop exists, the tab falls back to advance `1`.
- Tabs remain literal `\t` characters in source code; the extra spacing is editor-rendered only.

Example:

```txt
module main
; @tab 4 8
int foo
int\tbar
; @tab 12 34 54
\tbaz
moduleEnd
```

### Binary Asset Config

`@8f4e/editor-plugin-binary-assets`, included by the default editor, defines named binary asset URLs and loads them
into runtime memory. The plugin owns fetching, CacheStorage, the loading dialog, and generated size constants.

```txt
; @config bin.<id>.url <url>
; @config bin.<id>.memory <memoryId>
```

Notes:

- Asset size constants are auto-generated in the env block as `ASSET_<ID>_SIZE`.
- `memory` may use a local memory id inside a module block, or a module-qualified memory id from any block.
- Invalid paths/values are reported through config validation.
- Binary payloads stay outside serialized project models; generated size constants are available to compilation.
- Assets with a `url` but no load target are not fetched.

Multiple loads for one asset are supported with named load targets:

```txt
; @config bin.<id>.memories.<name> <memoryId>
```

The recommended pattern is one load per asset and sharing that memory from other modules to reduce memory usage.

### `@favorite`

Mark a code block as a favorite for quick navigation.

```txt
; @favorite
```

When a code block contains this directive, it appears in the "Jump to..." submenu of the main context menu (right-click on empty space). Selecting a favorite from the submenu will jump to and center the viewport on that code block.

Use this to bookmark important modules, functions, or other blocks in large projects for faster navigation.

### `@home`

Mark a code block as the home block for initial viewport placement.

```txt
; @home [center|left|right|top|bottom]
```

When a project loads, the viewport moves to the first code block containing the `@home` directive. If no code block contains `@home`, the viewport defaults to position `(0,0)`.

**Behavior:**

- **Project Load**: On load, viewport moves to the first block with `@home` (determined by code block order).
- **Multiple @home**: If multiple blocks have `@home`, only the first one (by project order) is used.
- **No @home**: If no blocks have `@home`, viewport defaults to `(0,0)`.
- **Alignment**: Optional alignment hints are: `center` (default), `left`, `right`, `top`, or `bottom`.
- **During Editing**: Use the "Go @home" main menu action (right-click on empty space) to return the viewport to the home block at any time using the same alignment rule.

**Format:**
The canonical formats are:

- `; @home`
- `; @home top`
- `; @home bottom`
- `; @home left`
- `; @home right`
- `; @home center`

Example:

```txt
module mainOscillator
; @home top
; @pos 50 30
output out 1
moduleEnd
```

**Important:**

- Use `@home` to define the starting view for your project.
- Only one `@home` directive takes effect (the first block in project order).

### `@hide`

Hide everything after the directive line while the block is not selected.

```txt
; @hide
```

Notes:

- Everything after the `@hide` line is hidden while the block is unselected.
- Selecting the block expands the full source again for editing.
- Directives with arguments are ignored.
- If multiple valid `@hide` directives exist, the first one wins.
- Works with all block types (modules, functions, configs, constants, notes).

### `@disabled`

Mark a code block as disabled to exclude it from compilation.

```txt
; @disabled
```

When a code block contains this directive, it is excluded from compilation and rendered with a transparent background. This is useful for temporarily disabling modules, functions, or other blocks without deleting them.

**Behavior:**

- **Project Load**: Disabled state is parsed from `@disabled` directive. Blocks without the directive are enabled by default.
- **Context Menu**: Use "Disable <blockLabel>" or "Enable <blockLabel>" menu items to toggle the directive.
- **Compilation**: Disabled blocks are filtered out before compilation, so they don't affect the compiled program.
- **Rendering**: Disabled blocks appear with a transparent/dimmed background in the editor.

**Format:**
The canonical format is exactly: `; @disabled`

Example:

```txt
module debugOscillator
; @disabled
; @pos 10 20
output debugOut 1
moduleEnd
```

**Important:**

- The `@disabled` directive is the source of truth for disabled state in saved projects.
- You can manually add or remove the directive to enable/disable blocks.
- Works with all block types (modules, functions, configs, constants, notes).

### `@pos`

Define the grid position of a code block in the editor.

```txt
; @pos <gridX> <gridY>
```

This directive stores the position of a code block within the project.

**Rules:**

- `gridX` and `gridY` must be strict integers (floats are rejected)
- Negative values are allowed
- Multiple `@pos` directives in one block are treated as invalid
- Malformed values (non-integers) are treated as invalid

**Behavior:**

- **Project Load**: Position is parsed from `@pos` directive. Missing or invalid directive defaults to `(0,0)`
- **Code Edit**: Valid `@pos` edits immediately update the block's grid coordinates and position before config
  precedence is resolved. Missing, incomplete, or invalid directives leave the block at its last valid position,
  including updates through the editing API and same-project history restoration. Newly inserted blocks without a
  valid position start at `(0,0)`.
- **Dragging**: When you drag a block, `@pos` is automatically updated when the drag ends (not during the drag)
- **Creation**: New blocks automatically get a canonical `@pos` directive based on creation location
- **Paste**: Pasted blocks automatically get `@pos` directives with adjusted positions

**Format:**
The canonical format is exactly: `; @pos ${gridX} ${gridY}`

Example:

```txt
module oscillator
; @pos 10 20
; @favorite
output out 1
moduleEnd
```

**Important:**

- The `@pos` directive is the source of truth for block position in saved projects
- During drag, `@pos` updates only on drag end (not during the drag)
- When `@viewport` is also present, `@pos` stores the inward offset from the anchored corner instead of world-space coordinates (see `@viewport`)

### `@viewport`

Pin a code block to a viewport corner so it stays visible as you pan around the project.

```txt
; @viewport <top-left|top-right|bottom-left|bottom-right>
```

When this directive is present, `@pos` is interpreted as an **inward offset** from the specified corner of the visible viewport instead of world-space grid coordinates.

**Accepted values:**

- `top-left`
- `top-right`
- `bottom-left`
- `bottom-right`

**Offset semantics** — positive `@pos` values always move inward from the anchored edges:

- `top-left`: `+x` moves right, `+y` moves down
- `top-right`: `+x` moves left, `+y` moves down
- `bottom-left`: `+x` moves right, `+y` moves up
- `bottom-right`: `+x` moves left, `+y` moves up

`; @pos 0 0` with any anchor means "flush against the anchored corner".

**Clamping:**
Viewport-anchored blocks are always clamped to remain visible. If a block would be placed outside the viewport due to a large or negative `@pos` offset, its position is clamped so the anchored corner stays within the visible area. Oversized blocks pin the anchored corner and allow overflow only on the opposite side.

**Dragging:**
Dragging a viewport-anchored block works normally. When the drag ends, `@pos` is rewritten in anchored coordinates (not world-space), and `@viewport` is left unchanged.

**Important:**

- `@viewport` changes how `@pos` is interpreted but does **not** replace it. `@pos` remains the only persisted coordinate.
- When `@viewport` is absent the block uses normal world-space placement.
- Only the first `@viewport` directive in a block takes effect; duplicates are ignored.
- An unknown anchor value (anything other than the four listed above) is treated as if `@viewport` were absent.

Example:

```txt
module hud
; @viewport top-right
; @pos 2 1
output out 1
moduleEnd
```

This places the block two grid cells inward from the right edge and one grid cell down from the top edge of the viewport, regardless of where the user pans.

### `@alwaysOnTop`

Mark a code block as persistently top-most so it always renders above normal blocks.

```txt
; @alwaysOnTop
```

Without this directive, clicking a block brings it above all other blocks. With `@alwaysOnTop`, blocks are divided into two z-order partitions:

- **Normal blocks** — rendered first, in their relative array order
- **Always-on-top blocks** — rendered last (on top of all normal blocks), in their relative array order

Clicking a normal block brings it to the front of the normal segment only; it never rises above any always-on-top block.
Clicking an always-on-top block brings it to the front of the always-on-top segment.

**Important:**

- Rendering and hit-testing both derive from the same `codeBlocks` array order; no separate rendering pass is used.
- The directive takes no arguments; any text after `@alwaysOnTop` is ignored.
- `@alwaysOnTop` is compatible with `@viewport`; a viewport-anchored block may also be always-on-top.

Example:

```txt
module overlay
; @alwaysOnTop
; @viewport top-left
; @pos 1 1
output status 1
moduleEnd
```

This block stays pinned to the top-left corner of the viewport and is always rendered above all normal code blocks.

### `@group`

Assign a code block to a named group for coordinated movement.
Provided by `@8f4e/editor-plugin-grouping`, included in the default editor.

```txt
; @group <groupName> [nonstick]
```

When a code block contains this directive, it can be moved together with other blocks sharing the same group name:

- **Default behavior (without `nonstick`)**: All blocks in the group move together when you drag any member. Hold `Alt/Option` to override and drag only the selected block (single-block drag)
- **With `nonstick` keyword**: Drag only the selected block by default (single-block drag). Hold `Alt/Option` to override and drag all blocks in the group together (group drag)

This is useful for keeping related modules, functions, or other blocks positioned relative to each other.

Examples:

```txt
; @group audio-chain
; @group visualizers nonstick
; @group utilities
```

**Menu Actions:**

When a code block belongs to a group, the context menu provides these actions:

- **Make Group Nonstick**: Adds the `nonstick` keyword to all blocks in the group, making them drag individually by default
- **Make Group Sticky**: Removes the `nonstick` keyword from all blocks in the group, returning to default group-drag behavior
- **Delete group**: Deletes all code blocks in the group immediately without confirmation (use with caution)
- **Copy group**: Copies all blocks in the group to clipboard as a multi-block JSON array (see Clipboard Behavior below)
- **Remove from group**: Removes the `@group` directive from the selected block only
- **Ungroup "<groupName>"**: Removes the `@group` directive from all blocks in the group

Notes:

- Group names are case-sensitive.
- Group names can contain letters, numbers, hyphens, and underscores.
- Group names should not contain spaces (the first token after @group is used as the group name).
- The `nonstick` keyword must be exactly `nonstick` (lowercase) to be recognized.
- By default, all blocks in a group move together when dragging. Use Alt/Option to override and drag a single block.
- Nonstick groups drag individually by default. Use Alt/Option to override and drag all blocks together.
- Ungrouped blocks are unaffected and always use single-block drag behavior.

## Clipboard Behavior

The editor supports two clipboard formats for copying and pasting code blocks:

### Single-Block Copy/Paste

When you copy a single code block (using "Copy module/function" in the context menu), it is copied to the clipboard as plain text with newline-separated code lines.

**Example:**

```txt
module oscillator
output out 1
moduleEnd
```

Pasting plain text creates a single new code block at the paste location.

### Multi-Block Copy/Paste (Groups)

When you copy a group (using "Copy group" in the context menu), all blocks in the group are copied to the clipboard as a JSON array.

**Format:**

```json
[
	{
		"code": ["module foo", "; @disabled", "; @pos 5 10", "moduleEnd"],
		"gridCoordinates": { "x": 0, "y": 0 }
	},
	{
		"code": ["module bar", "; @pos 17 14", "moduleEnd"],
		"gridCoordinates": { "x": 12, "y": 4 }
	}
]
```

**Rules:**

- `gridCoordinates` are **relative offsets** used only for paste positioning (not for project storage)
- Coordinates are relative to the copied anchor block (the selected block becomes `{x: 0, y: 0}`)
- When pasted, final position = paste location + relative offset, then `@pos` is updated in code
- Disabled state is stored in code via `@disabled` directive, not as a separate field
- Blocks are ordered by their creation index for deterministic ordering
- No envelope metadata (`type`, `version`, etc.) is added to the payload

**Note:** The clipboard format uses `gridCoordinates` for paste mechanics only. In saved projects, both position and disabled state are stored in directives within code (`@pos` and `@disabled`), not as separate fields.

**Paste Behavior:**

- The editor automatically detects whether clipboard content is a multi-block array or plain text
- A valid multi-block array must have at least 2 items with the required shape
- Pasted blocks are placed relative to the paste location (anchor position)
- Module/function names are automatically incremented to avoid collisions

**Group Name Collision Handling:**

The grouping plugin automatically renames pasted `@group` names to avoid collisions with existing visual groups:

- If a group name ends with a number, that number is incremented: `audio1` → `audio2`
- If a group name doesn't end with a number, `1` is appended: `audio` → `audio1`
- The rename process repeats until a unique name is found
- All blocks with the same original group name get the same new group name

**Examples:**

- Paste `audio` when `audio` exists → becomes `audio1`
- Paste `audio1` when `audio` and `audio1` exist → becomes `audio2`
- Paste `bass09` when `bass09` and `bass10` exist → becomes `bass11`

**Fallback Behavior:**

Invalid clipboard content falls back to single-block paste behavior:

- Non-JSON text
- JSON that isn't an array
- Arrays with fewer than 2 items
- Arrays with items missing required fields (`code`, `gridCoordinates`)
- Arrays with items containing invalid data types

## Notes

- Directive parsing should be strict: plain comments like `; note` are not directives.
- Unknown directives should be ignored by editor sub-parsers unless explicitly supported by that feature.

### Export file name

Set the base file name used by editor export actions.

```txt
; @config export.fileName <value>
```

- `value` must be a non-empty single token (for example `samplePlayer` or `demo.wasm`)
- The editor strips `.wasm` and `.8f4e` suffixes before appending the export format extension

**Example**:

```txt
; @config export.fileName samplePlayer
```

### Runtime plugins

Audio, worker, and test runtimes are independently enabled plugins:

```txt
; @config audioRuntime.enabled true
; @config audioRuntime.sampleRateConstantName SAMPLE_RATE
; @config audioRuntime.sampleRate 48000
; @config audioRuntime.entry buffer
; @config audioRuntime.audioOutBufferLAddress audioout:buffer
; @config workerRuntime.enabled true
; @config workerRuntime.sampleRateConstantName CONTROL_RATE
; @config workerRuntime.sampleRate 50
; @config workerRuntime.entry main
; @config testRuntime.enabled true
```

The audio entry defaults to `buffer` and the worker entry to `main`. Each runtime's `enabled` default is false.
Both contribute a sample-rate constant named `SAMPLE_RATE` by default; use their `sampleRateConstantName` settings
when running them together. Audio also contributes `AUDIO_BUFFER_SIZE`, configurable through
`audioRuntime.bufferSizeConstantName`. Info namespaces are fixed: `audioRuntime`, `workerRuntime`, and `testRuntime`.
The default and minimal editors automatically import these plugins when their configuration roots appear, including
after editing. Runtime signals are checked across the complete project tree, including unopened groups, using cached
parsed directives. Each plugin stays installed until editor disposal and owns its schema and cleanup.
