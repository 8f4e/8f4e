# 8f4e 

8f4e is a stack oriented programming language and live code editor that I created to perform generative music at algorave events. This monorepo contains the compiler, specialised runtimes, and the code of a browser-based visual code editor I designed specifically for the 8f4e language.
The editor and runtime stack follows a REPL-style coding loop (edit, compile/evaluate, and observe output), but it is UI-driven rather than a terminal prompt workflow.

More details about the language design and documentation can be found at [./docs/README.md](./docs/README.md)

## Workspace Architecture

The 8f4e project is organized as an Nx monorepo with the following project hierarchy:

<pre>
8f4e/
├── apps/
│   ├── <a href="./apps/8f4e-website/README.md">8f4e-website</a> (Product homepage, examples gallery, and compiler test gallery)
│   ├── <a href="./apps/cli/README.md">cli</a> (CLI for compiling, running, testing, formatting, and capturing output from 8f4e projects)
│   ├── <a href="./apps/editor-webapp/README.md">editor-webapp</a> (Thin deployable web app for the default editor)
│   ├── <a href="./apps/metrics-dashboard">metrics-dashboard</a> (Local dashboard for release metrics)
│   ├── <a href="./apps/runtime-command/README.md">runtime-command</a> (Generator for native runtime launch arguments)
│   ├── <a href="./apps/runtime-daisy/README.md">runtime-daisy</a> (Daisy Field firmware that loads instruments from microSD for audio and MIDI)
│   └── <a href="./apps/runtime-linux/README.md">runtime-linux</a> (Native Linux runtime with JACK audio and MIDI)
├── <a href="./compiler/README.md">compiler</a> (The core compiler that transforms 8f4e code into WebAssembly)
│   └── packages/
│       ├── <a href="./compiler/packages/language-spec/README.md">language-spec</a> (Shared language contracts and target-independent compiler facts)
│       ├── <a href="./compiler/packages/diagnostics/README.md">diagnostics</a> (Compiler error construction and diagnostic serialization)
│       ├── <a href="./compiler/packages/project-preparser/README.md">project-preparser</a> (Parses .8f4e project documents into sub-program source)
│       ├── <a href="./compiler/packages/program-composer/README.md">program-composer</a> (Composes recursive project groups into an ordered AST program)
│       ├── <a href="./compiler/packages/sub-program/README.md">sub-program</a> (Compiles one closed, independently identifiable program unit)
│       │   └── packages/
│       │       ├── <a href="./compiler/packages/sub-program/packages/tokenizer/README.md">tokenizer</a> (Parses source blocks into validated ASTs)
│       │       ├── <a href="./compiler/packages/sub-program/packages/constant-resolver/README.md">constant-resolver</a> (Resolves const declarations and namespace imports)
│       │       ├── <a href="./compiler/packages/sub-program/packages/memory-planner/README.md">memory-planner</a> (Plans module and memory declaration layout)
│       │       ├── <a href="./compiler/packages/sub-program/packages/memory-reference-resolver/README.md">memory-reference-resolver</a> (Resolves memory layout references)
│       │       ├── <a href="./compiler/packages/sub-program/packages/memory-default-resolver/README.md">memory-default-resolver</a> (Resolves memory defaults and pointer metadata)
│       │       ├── <a href="./compiler/packages/sub-program/packages/semantic-reference-resolver/README.md">semantic-reference-resolver</a> (Resolves semantic value references)
│       │       ├── <a href="./compiler/packages/sub-program/packages/stack-analyzer/README.md">stack-analyzer</a> (Validates and reports stack effects)
│       │       ├── <a href="./compiler/packages/sub-program/packages/semantic-utils/README.md">semantic-utils</a> (Shared target-independent semantic helpers)
│       │       ├── <a href="./compiler/packages/sub-program/packages/wasm-ir-lowering/README.md">wasm-ir-lowering</a> (Lowers resolved 8f4e programs to WebAssembly intermediate representation)
│       │       ├── <a href="./compiler/packages/sub-program/packages/wasm-ir-pruner">wasm-ir-pruner</a> (Removes unreachable functions and unused local slots from Wasm IR)
│       │       ├── <a href="./compiler/packages/sub-program/packages/function-inliner">function-inliner</a> (Inlines function calls in Wasm IR)
│       │       └── <a href="./compiler/packages/sub-program/packages/wasm-ir-simplifier">wasm-ir-simplifier</a> (Simplifies local instructions in Wasm IR)
│       ├── <a href="./compiler/packages/wasm-codegen/README.md">wasm-codegen</a> (WebAssembly code generation)
│       │   └── packages/
│       │       └── <a href="./compiler/packages/wasm-codegen/packages/wasm-utils/README.md">wasm-utils</a> (Low-level WebAssembly byte construction helpers)
│       └── <a href="./compiler/packages/stdlib/README.md">stdlib</a> (Standard-library include source files)
├── <a href="./editor/README.md">editor</a> (Editor product packages)
│   ├── core/
│   │   ├── <a href="./editor/core/editor-core/README.md">editor-core</a> (Minimal reusable editor)
│   │   ├── <a href="./editor/core/editor-palette/README.md">editor-palette</a> (Shared base palette and predefined editor shades)
│   │   ├── <a href="./editor/core/editor-state/README.md">editor-state</a> (Editor state management)
│   │   ├── <a href="./editor/core/editor-state-types">editor-state-types</a> (Shared public editor-state model types)
│   │   ├── <a href="./editor/core/editor-state-testing/README.md">editor-state-testing</a> (Framework-agnostic editor-state test helpers)
│   │   ├── <a href="./editor/core/state-manager/README.md">state-manager</a> (State manager with subscriptions)
│   │   ├── <a href="./editor/core/web-ui/README.md">web-ui</a> (WebGL rendering for the editor interface)
│   │   ├── <a href="./editor/core/web-ui-testing/README.md">web-ui-testing</a> (Renderer test helpers)
│   │   ├── <a href="./editor/core/glugglugglug/README.md">glugglugglug</a> (2D WebGL graphics utilities)
│   │   └── <a href="./editor/core/sprite-generator/README.md">sprite-generator</a> (All UI graphics are generative)
│   ├── compositions/
│   │   ├── <a href="./editor/compositions/editor-default/README.md">editor-default</a> (Default compiler, runtime, storage, and example composition)
│   │   ├── <a href="./editor/compositions/editor-gallery/README.md">editor-gallery</a> (Embedded editor composition for examples and compiler tests)
│   │   └── <a href="./editor/compositions/editor-landing/README.md">editor-landing</a> (Lightweight editor composition for interactive landing-page demos)
│   ├── <a href="./editor/editor-webmcp/README.md">editor-webmcp</a> (Page-owned WebMCP adapter for one live editor)
│   └── <a href="./editor/plugins">plugins</a> (Optional editor features)
│       ├── <a href="./editor/plugins/assertion-markers">assertion-markers</a> (Executed assertion pass/fail indicators)
│       ├── <a href="./editor/plugins/audio-runtime">audio-runtime</a> (Audio execution, configuration, and lifecycle management)
│       │   └── packages/
│       │       └── <a href="./editor/plugins/audio-runtime/packages/runtime-audio-worklet/README.md">runtime-audio-worklet</a> (AudioWorklet execution and message protocol)
│       ├── <a href="./editor/plugins/bars">bars</a> (Live memory bar displays)
│       ├── <a href="./editor/plugins/binary-assets">binary-assets</a> (Binary asset fetching, caching, and memory loading)
│       ├── <a href="./editor/plugins/block-authoring">block-authoring</a> (Code-block creation and deletion)
│       ├── <a href="./editor/plugins/button">button</a> (Momentary button controls)
│       ├── <a href="./editor/plugins/code-block-background">code-block-background</a> (Code-block surfaces and corner markers)
│       ├── <a href="./editor/plugins/code-block-copy-paste">code-block-copy-paste</a> (Code-block copy and paste actions)
│       ├── <a href="./editor/plugins/code-rendering/README.md">code-rendering</a> (Code text, syntax highlighting, and sprite preparation)
│       ├── <a href="./editor/plugins/compiler">compiler</a> (Live compilation, artifacts, diagnostics, and memory access)
│       │   └── packages/
│       │       └── <a href="./editor/plugins/compiler/packages/compiler-worker/README.md">compiler-worker</a> (Web Worker wrapper around the compiler for live coding)
│       ├── <a href="./editor/plugins/connectors">connectors</a> (Input/output connector sprites, declaration labels, and endpoint geometry)
│       ├── <a href="./editor/plugins/context-menu">context-menu</a> (Context-menu layout, hit testing, and drawing)
│       ├── <a href="./editor/plugins/crossfade">crossfade</a> (Interactive crossfade controls)
│       ├── <a href="./editor/plugins/dialogs">dialogs</a> (Dialog layout, button hit testing, and drawing)
│       ├── <a href="./editor/plugins/entry-outlines">entry-outlines</a> (Execution entry borders and labels)
│       ├── <a href="./editor/plugins/error-messages">error-messages</a> (Inline error layout and drawing)
│       ├── <a href="./editor/plugins/example-modules">example-modules</a> (Built-in module browsing and dependency insertion)
│       ├── <a href="./editor/plugins/favorites">favorites</a> (Favorite directives, editing, and navigation)
│       ├── <a href="./editor/plugins/font-preview">font-preview</a> (Temporary keyboard font previews)
│       ├── <a href="./editor/plugins/group-path">group-path</a> (Active project group and ancestor names)
│       ├── <a href="./editor/plugins/grouping">grouping</a> (Visual block grouping, group actions, dragging, and copying)
│       ├── <a href="./editor/plugins/jump-to-error">jump-to-error</a> (Navigation to the first error with a source location)
│       ├── <a href="./editor/plugins/keyboard-editing">keyboard-editing</a> (Text editing, caret movement, and drawing)
│       ├── <a href="./editor/plugins/keyboard-memory">keyboard-memory</a> (Keyboard-to-memory input)
│       ├── <a href="./editor/plugins/keyboard-mode-switching">keyboard-mode-switching</a> (View/edit mode shortcuts and hints)
│       ├── <a href="./editor/plugins/keyboard-navigation">keyboard-navigation</a> (View-mode line selection and block navigation)
│       ├── <a href="./editor/plugins/lazy-loader">lazy-loader</a> (Directive-triggered lazy plugin loading)
│       ├── <a href="./editor/plugins/loading-indicators">loading-indicators</a> (On-canvas operation progress and status)
│       ├── <a href="./editor/plugins/meter">meter</a> (Live memory value meters)
│       ├── <a href="./editor/plugins/midi-input">midi-input</a> (MIDI device discovery and input callbacks)
│       ├── <a href="./editor/plugins/mouse-input">mouse-input</a> (Browser mouse and wheel input)
│       ├── <a href="./editor/plugins/offscreen-block-arrows">offscreen-block-arrows</a> (Viewport-edge arrows toward offscreen code blocks)
│       ├── <a href="./editor/plugins/piano">piano</a> (Interactive piano keyboards)
│       ├── <a href="./editor/plugins/plot">plot</a> (Live memory plots)
│       ├── <a href="./editor/plugins/project-files">project-files</a> (Project Open/Save and one-shot source export)
│       ├── <a href="./editor/plugins/project-url-loader">project-url-loader</a> (Project source fetching and loading from URLs)
│       ├── <a href="./editor/plugins/pwa-updates">pwa-updates</a> (PWA update notifications and reload actions)
│       ├── <a href="./editor/plugins/remove-memory-connections">remove-memory-connections</a> (Disconnects intermodular memory defaults)
│       ├── <a href="./editor/plugins/screenshot">screenshot</a> (PNG screenshots of the editor)
│       ├── <a href="./editor/plugins/selection-animation">selection-animation</a> (Animated selected-block outline)
│       ├── <a href="./editor/plugins/session-persistence">session-persistence</a> (Browser session restoration and project autosaving)
│       ├── <a href="./editor/plugins/slider">slider</a> (Interactive slider controls)
│       ├── <a href="./editor/plugins/stack">stack</a> (Stack analysis overlays)
│       ├── <a href="./editor/plugins/stack-connections/README.md">stack-connections</a> (Stack operand links beside the code block)
│       ├── <a href="./editor/plugins/stack-producers/README.md">stack-producers</a> (Highlights immediate stack operand producer lines)
│       ├── <a href="./editor/plugins/switch">switch</a> (Memory toggle controls)
│       ├── <a href="./editor/plugins/test-runtime">test-runtime</a> (Test execution, assertion results, and failure reporting)
│       │   └── packages/
│       │       └── <a href="./editor/plugins/test-runtime/packages/runtime-test-runner/README.md">runtime-test-runner</a> (Executes compiled test entries in a worker)
│       ├── <a href="./editor/plugins/texture-runtime">texture-runtime</a> (Per-frame WebAssembly execution and inline framebuffer textures)
│       ├── <a href="./editor/plugins/toggle-skip-execution">toggle-skip-execution</a> (Single-module execution toggling)
│       ├── <a href="./editor/plugins/tooltips">tooltips</a> (Selected-line tooltips)
│       ├── <a href="./editor/plugins/touch-input">touch-input</a> (Touch input and viewport gestures)
│       ├── <a href="./editor/plugins/viewport-mouse-input">viewport-mouse-input</a> (Desktop mouse drag capture outside the canvas)
│       ├── <a href="./editor/plugins/wasm-export">wasm-export</a> (WebAssembly export action)
│       ├── <a href="./editor/plugins/watch">watch</a> (Inline memory value overlays)
│       ├── <a href="./editor/plugins/wave">wave</a> (Live waveform displays)
│       ├── <a href="./editor/plugins/wires">wires</a> (WebGL wire rendering)
│       └── <a href="./editor/plugins/worker-runtime">worker-runtime</a> (Web Worker execution, configuration, and lifecycle management)
│           └── packages/
│               └── <a href="./editor/plugins/worker-runtime/packages/runtime-web-worker/README.md">runtime-web-worker</a> (Web Worker execution loop and message protocol)
├── <a href="./examples/README.md">examples</a> (Example modules and projects)
├── tools/
│   ├── <a href="./tools/config/README.md">config</a> (Shared tooling and configuration helpers for the workspace)
│   ├── <a href="./tools/dx7-to-8f4e/README.md">dx7-to-8f4e</a> (DX7 SysEx patch converter)
│   ├── <a href="./tools/project-preview/README.md">project-preview</a> (Project preview image generator)
│   ├── <a href="./docs/releasing.md">release</a> (Release and validation tooling)
│   ├── <a href="./tools/test-runner/README.md">test-runner</a> (Shared native assertion execution and reporting)
│   └── <a href="./tools/vite-plugin-sources/README.md">vite-plugin-sources</a> (Vite source discovery and lazy text collections)
├── <a href="./docs/README.md">docs</a> (Language and repository documentation)
└── scripts/ (Workspace maintenance scripts)
</pre>

You can use `npx nx graph` to explore the relationships between projects.

## Development

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build all packages:**
   ```bash
   npx nx run @8f4e/editor-webapp:build
   ```

3. **Start the development server:**
   ```bash
   npx nx run @8f4e/editor-webapp:dev
   ```
   The app will be available at http://localhost:3000

## Contributors

Thanks to everyone who has contributed to 8f4e.

<!-- CONTRIBUTORS-GRID:START -->
<!-- Generated by scripts/update-contributors.mjs. -->
<table>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/masyarakatai"><img src="https://github.com/masyarakatai.png?size=96" width="72" alt="@masyarakatai"><br><sub><b>Masyarakat AI</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Amasyarakatai">🔀 16</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/jinchuntan"><img src="https://github.com/jinchuntan.png?size=96" width="72" alt="@jinchuntan"><br><sub><b>Nigel Tan</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Ajinchuntan">🔀 14</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/aazminu"><img src="https://github.com/aazminu.png?size=96" width="72" alt="@aazminu"><br><sub><b>Abdullah Azmi</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Aaazminu">🔀 8</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Erfouni"><img src="https://github.com/Erfouni.png?size=96" width="72" alt="@Erfouni"><br><sub><b>erfouni</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AErfouni">🔀 8</a></sub>
</td>
</tr>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/mouse-far"><img src="https://github.com/mouse-far.png?size=96" width="72" alt="@mouse-far"><br><sub><b>mouse-far</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Amouse-far">🔀 4</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/theTemple10"><img src="https://github.com/theTemple10.png?size=96" width="72" alt="@theTemple10"><br><sub><b>Victor Akinremi</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AtheTemple10">🔀 3</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/MarioZhang420"><img src="https://github.com/MarioZhang420.png?size=96" width="72" alt="@MarioZhang420"><br><sub><b>Wenzhuo Zhang</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AMarioZhang420">🔀 3</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/875612255-beep"><img src="https://github.com/875612255-beep.png?size=96" width="72" alt="@875612255-beep"><br><sub><b>875612255-beep</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3A875612255-beep">🔀 2</a></sub>
</td>
</tr>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Aaqibhafeezkhan"><img src="https://github.com/Aaqibhafeezkhan.png?size=96" width="72" alt="@Aaqibhafeezkhan"><br><sub><b>Aaqibhafeez Khan</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AAaqibhafeezkhan">🔀 2</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/zFl4wless"><img src="https://github.com/zFl4wless.png?size=96" width="72" alt="@zFl4wless"><br><sub><b>Noah</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AzFl4wless">🔀 2</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/nova-loop"><img src="https://github.com/nova-loop.png?size=96" width="72" alt="@nova-loop"><br><sub><b>nova-loop</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Anova-loop">🔀 2</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/StavanRKhobare"><img src="https://github.com/StavanRKhobare.png?size=96" width="72" alt="@StavanRKhobare"><br><sub><b>StavanRKhobare</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AStavanRKhobare">🔀 2</a></sub>
</td>
</tr>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/slopgobblercobbler"><img src="https://github.com/slopgobblercobbler.png?size=96" width="72" alt="@slopgobblercobbler"><br><sub><b>Stephen Cork</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Aslopgobblercobbler">🔀 2</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/mehetab-01"><img src="https://github.com/mehetab-01.png?size=96" width="72" alt="@mehetab-01"><br><sub><b>TabCrypt</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Amehetab-01">🔀 2</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Abhijay-29r"><img src="https://github.com/Abhijay-29r.png?size=96" width="72" alt="@Abhijay-29r"><br><sub><b>Abhijay-29r</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AAbhijay-29r">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Anikesh348"><img src="https://github.com/Anikesh348.png?size=96" width="72" alt="@Anikesh348"><br><sub><b>Anikesh Thakur</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AAnikesh348">🔀 1</a></sub>
</td>
</tr>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/mandiau-matthias"><img src="https://github.com/mandiau-matthias.png?size=96" width="72" alt="@mandiau-matthias"><br><sub><b>Automatron</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Amandiau-matthias">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/jay23606"><img src="https://github.com/jay23606.png?size=96" width="72" alt="@jay23606"><br><sub><b>Jay</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Ajay23606">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/cjy851096"><img src="https://github.com/cjy851096.png?size=96" width="72" alt="@cjy851096"><br><sub><b>Jianyang Chen</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Acjy851096">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Khushbu677"><img src="https://github.com/Khushbu677.png?size=96" width="72" alt="@Khushbu677"><br><sub><b>Khushbu Kumari</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AKhushbu677">🔀 1</a></sub>
</td>
</tr>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/badgujarkunal93-blip"><img src="https://github.com/badgujarkunal93-blip.png?size=96" width="72" alt="@badgujarkunal93-blip"><br><sub><b>Kunal Badgujar</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Abadgujarkunal93-blip">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Prisha38"><img src="https://github.com/Prisha38.png?size=96" width="72" alt="@Prisha38"><br><sub><b>Prisha</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3APrisha38">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/satyam0777"><img src="https://github.com/satyam0777.png?size=96" width="72" alt="@satyam0777"><br><sub><b>Satyam Prajapati</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Asatyam0777">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/TanmayNileshShinde"><img src="https://github.com/TanmayNileshShinde.png?size=96" width="72" alt="@TanmayNileshShinde"><br><sub><b>Tanmay Nilesh Shinde</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3ATanmayNileshShinde">🔀 1</a></sub>
</td>
</tr>
</table>
<!-- CONTRIBUTORS-GRID:END -->
