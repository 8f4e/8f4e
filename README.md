# 8f4e 

8f4e is a stack oriented programming language and live code editor that I created to perform generative music at algorave events. This monorepo contains the compiler, specialised runtimes, and the code of a browser-based visual code editor I designed specifically for the 8f4e language.
The editor and runtime stack follows a REPL-style coding loop (edit, compile/evaluate, and observe output), but it is UI-driven rather than a terminal prompt workflow.

More details about the language design and documentation can be found at [./docs/README.md](./docs/README.md)

## Package Architecture

The 8f4e project is organized as an Nx monorepo with the following package hierarchy:

<pre>
8f4e/
└── packages/
    ├── <a href="./packages/compiler/README.md">compiler</a> (The core compiler that transforms 8f4e code into WebAssembly)
    │   └── packages/
    │       ├── <a href="./packages/compiler/packages/language-spec/README.md">language-spec</a> (Shared language contracts and target-independent compiler facts)
    │       ├── <a href="./packages/compiler/packages/project-preparser/README.md">project-preparser</a> (Parses .8f4e project documents into sub-program source)
    │       ├── <a href="./packages/compiler/packages/program-composer/README.md">program-composer</a> (Composes recursive project groups into an ordered AST program)
    │       ├── <a href="./packages/compiler/packages/sub-program/README.md">sub-program</a> (Compiles one closed, independently identifiable program unit)
    │       │   └── packages/
    │       │       ├── <a href="./packages/compiler/packages/sub-program/packages/tokenizer/README.md">tokenizer</a> (Parses source blocks into validated ASTs)
    │       │       ├── <a href="./packages/compiler/packages/sub-program/packages/constant-resolver/README.md">constant-resolver</a> (Resolves const declarations and namespace imports)
    │       │       ├── <a href="./packages/compiler/packages/sub-program/packages/memory-planner/README.md">memory-planner</a> (Plans module and memory declaration layout)
    │       │       ├── <a href="./packages/compiler/packages/sub-program/packages/memory-reference-resolver/README.md">memory-reference-resolver</a> (Resolves memory layout references)
    │       │       ├── <a href="./packages/compiler/packages/sub-program/packages/memory-default-resolver/README.md">memory-default-resolver</a> (Resolves memory defaults and pointer metadata)
    │       │       ├── <a href="./packages/compiler/packages/sub-program/packages/semantic-reference-resolver/README.md">semantic-reference-resolver</a> (Resolves semantic value references)
    │       │       ├── <a href="./packages/compiler/packages/sub-program/packages/stack-analyzer/README.md">stack-analyzer</a> (Validates and reports stack effects)
    │       │       └── <a href="./packages/compiler/packages/sub-program/packages/semantic-utils/README.md">semantic-utils</a> (Shared target-independent semantic helpers)
    │       ├── <a href="./packages/compiler/packages/wasm-codegen/README.md">wasm-codegen</a> (WebAssembly code generation)
    │       │   └── packages/
    │       │       └── <a href="./packages/compiler/packages/wasm-codegen/packages/wasm-utils/README.md">wasm-utils</a> (Low-level WebAssembly byte construction helpers)
    │       └── <a href="./packages/compiler/packages/stdlib/README.md">stdlib</a> (Standard-library include source files)
    ├── <a href="./packages/editor/README.md">editor</a> (Editor product packages)
    │   └── packages/
    │       ├── <a href="./packages/editor/packages/compiler-worker/README.md">compiler-worker</a> (Web Worker wrapper around the compiler for live coding)
    │       ├── <a href="./packages/editor/packages/editor-default/README.md">editor-default</a> (Default compiler, runtime, storage, and example composition)
    │       ├── <a href="./packages/editor/packages/editor-core/README.md">editor-core</a> (Minimal reusable editor)
    │       │   └── packages/
    │       │       ├── <a href="./packages/editor/packages/editor-core/packages/editor-state/README.md">editor-state</a> (Editor state management)
    │       │       ├── editor-state-types (Shared public editor-state model types)
    │       │       ├── <a href="./packages/editor/packages/editor-core/packages/editor-state-testing/README.md">editor-state-testing</a> (Framework-agnostic editor-state test helpers)
    │       │       ├── <a href="./packages/editor/packages/editor-core/packages/state-manager/README.md">state-manager</a> (State manager with subscriptions)
    │       │       └── <a href="./packages/editor/packages/editor-core/packages/web-ui/README.md">web-ui</a> (WebGL rendering for the editor interface)
    │       │           └── packages/
    │       │               ├── <a href="./packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/README.md">glugglugglug</a> (2D WebGL graphics utilities)
    │       │               ├── <a href="./packages/editor/packages/editor-core/packages/web-ui/packages/render-projection/README.md">render-projection</a> (Precalculates web UI-specific render data from editor state)
    │       │               └── <a href="./packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/README.md">sprite-generator</a> (All UI graphics are generative)
    │       ├── <a href="./packages/editor/packages/editor-website/README.md">editor-website</a> (Thin deployable website for the default editor)
    │       ├── <a href="./packages/editor/packages/runtime-audio-worklet/README.md">runtime-audio-worklet</a> (AudioWorklet editor runtime)
    │       ├── <a href="./packages/editor/packages/runtime-test-runner/README.md">runtime-test-runner</a> (Runs project test entries and reports assertions in the editor)
    │       └── <a href="./packages/editor/packages/runtime-web-worker/README.md">runtime-web-worker</a> (Web Worker editor runtime)
    ├── <a href="./packages/examples/README.md">examples</a> (Example modules and projects)
    ├── <a href="./packages/cli/README.md">cli</a> (CLI for compiling 8f4e project files)
    ├── <a href="./packages/test-runner/README.md">test-runner</a> (Shared native assertion execution and reporting)
    ├── <a href="./packages/8f4e-website/README.md">8f4e-website</a> (Product homepage, examples gallery, and compiler test gallery)
    ├── metrics-dashboard (Local dashboard for release metrics)
    └── <a href="./packages/config/README.md">config</a> (Shared tooling and configuration helpers for the workspace)
</pre>

You can use `npx nx graph` to explore the relationship between the packages.

## Development

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build all packages:**
   ```bash
   npx nx run @8f4e/editor-website:build
   ```

3. **Start the development server:**
   ```bash
   npx nx run @8f4e/editor-website:dev
   ```
   The app will be available at http://localhost:3000

## Contributors

Thanks to everyone who has contributed to 8f4e.

<!-- CONTRIBUTORS-GRID:START -->
<!-- Generated by scripts/update-contributors.mjs. -->
<table>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/jinchuntan"><img src="https://github.com/jinchuntan.png?size=96" width="72" alt="@jinchuntan"><br><sub><b>Nigel Tan</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Ajinchuntan">🔀 14</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Erfouni"><img src="https://github.com/Erfouni.png?size=96" width="72" alt="@Erfouni"><br><sub><b>erfouni</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AErfouni">🔀 8</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/aazminu"><img src="https://github.com/aazminu.png?size=96" width="72" alt="@aazminu"><br><sub><b>Abdullah Azmi</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Aaazminu">🔀 7</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/masyarakatai"><img src="https://github.com/masyarakatai.png?size=96" width="72" alt="@masyarakatai"><br><sub><b>Masyarakat AI</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Amasyarakatai">🔀 5</a></sub>
</td>
</tr>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/mouse-far"><img src="https://github.com/mouse-far.png?size=96" width="72" alt="@mouse-far"><br><sub><b>mouse-far</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Amouse-far">🔀 3</a></sub>
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
<a href="https://github.com/nova-loop"><img src="https://github.com/nova-loop.png?size=96" width="72" alt="@nova-loop"><br><sub><b>nova-loop</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Anova-loop">🔀 2</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/slopgobblercobbler"><img src="https://github.com/slopgobblercobbler.png?size=96" width="72" alt="@slopgobblercobbler"><br><sub><b>Stephen Cork</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Aslopgobblercobbler">🔀 2</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Abhijay-29r"><img src="https://github.com/Abhijay-29r.png?size=96" width="72" alt="@Abhijay-29r"><br><sub><b>Abhijay-29r</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AAbhijay-29r">🔀 1</a></sub>
</td>
</tr>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Anikesh348"><img src="https://github.com/Anikesh348.png?size=96" width="72" alt="@Anikesh348"><br><sub><b>Anikesh Thakur</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AAnikesh348">🔀 1</a></sub>
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
<a href="https://github.com/mandiau-matthias"><img src="https://github.com/mandiau-matthias.png?size=96" width="72" alt="@mandiau-matthias"><br><sub><b>mandiau-matthias</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Amandiau-matthias">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/zFl4wless"><img src="https://github.com/zFl4wless.png?size=96" width="72" alt="@zFl4wless"><br><sub><b>Noah</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AzFl4wless">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Prisha38"><img src="https://github.com/Prisha38.png?size=96" width="72" alt="@Prisha38"><br><sub><b>Prisha</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3APrisha38">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/satyam0777"><img src="https://github.com/satyam0777.png?size=96" width="72" alt="@satyam0777"><br><sub><b>Satyam Prajapati</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3Asatyam0777">🔀 1</a></sub>
</td>
</tr>
<tr>
<td align="center" valign="top" width="25%">
<a href="https://github.com/TanmayNileshShinde"><img src="https://github.com/TanmayNileshShinde.png?size=96" width="72" alt="@TanmayNileshShinde"><br><sub><b>Tanmay Nilesh Shinde</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3ATanmayNileshShinde">🔀 1</a></sub>
</td>
<td align="center" valign="top" width="25%">
<a href="https://github.com/Warma10032"><img src="https://github.com/Warma10032.png?size=96" width="72" alt="@Warma10032"><br><sub><b>一只小包子</b></sub></a><br>
<sub><a href="https://github.com/8f4e/8f4e/pulls?q=is%3Apr%20is%3Amerged%20label%3Acontributor%20author%3AWarma10032">🔀 1</a></sub>
</td>
</tr>
</table>
<!-- CONTRIBUTORS-GRID:END -->
