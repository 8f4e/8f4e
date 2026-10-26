# TODO Index

This index is derived from the active files currently present in `docs/todos/`.

Active todo files are listed below.

## Active TODOs

### 🔴 High Priority

| ID | Title | Priority | Effort | Created | Summary |
| ---- | ----- | -------- | ------ | ------- | ------- |
| 278 | Add storeWords with explicit count and word size | 🔴 | 1-2d | 2026-02-23 | `storeBytes <count>` covers contiguous byte writes, but there is no equivalent explicit instruction for contiguous multi-byte word writes. |
| 305 | Reuse WASM instance across incremental compiles | 🔴 | 3-6h | 2026-03-14 | The compiler worker currently recreates the WebAssembly instance on every compile, even when memory can be reused and the runtime shape has not changed. |
| 492 | Trigger autosave and history only on project changes | 🔴 | 3-6h | 2026-10-10 | Selection can autosave unchanged source, add undo-history entries, and clear redo; use a project-change signal that also covers persisted editor metadata. |

### 🟡 Medium Priority

| ID | Title | Priority | Effort | Created | Summary |
| ---- | ----- | -------- | ------ | ------- | ------- |
| 048 | Add 2D Engine Visual Regression Tests | 🟡 | 6-8 hours | 2025-08-28 | The 2D engine package currently lacks visual regression testing, which means: |
| 058 | Research C/C++ WebAssembly Runtimes on Linux with ALSA Audio Support | 🟡 | 4-6 days | 2025-09-11 | The 8f4e project requires a native C/C++ runtime for Linux systems with ALSA audio integration to complement the existing browser-based WebAssembly runtimes. Currently, the proj... |
| 064 | Research WebAssembly Runtimes for ARM Microcontroller Support | 🟡 | 3-5 days | 2025-09-10 | The 8f4e project currently supports browser-based WebAssembly runtimes (WebWorker and AudioWorklet) but lacks native runtimes for embedded ARM microcontrollers. To implement the... |
| 240 | Add row-align context-menu action with fixed spacing | 🟡 | 4-8h | 2026-02-18 | There is no quick layout action to arrange multiple related code blocks into a clean horizontal row while keeping their relative left-to-right order. |
| 291 | Add int64 support across compiler, runtime, and docs | 🟡 | 2-4d | 2026-03-09 | The language already has dedicated `float64` support, including 64-bit memory allocation and type-aware compiler paths, but there is no equivalent `int64` support. |
| 297 | Add url editor directive for clickable links | 🟡 | 4-8h | 2026-03-12 | The editor currently has no directive for attaching a clickable external link to a code block. |
| 302 | Add jump editor directive for code block navigation | 🟡 | 4-8h | 2026-03-14 | The editor currently supports code block navigation through the context-menu jump flow, but there is no in-code directive for linking one code block to another. |
| 307 | Optimize state-manager selector tokenization and subscription lookup | 🟡 | 3-6h | 2026-03-14 | The state manager currently does repeated string splitting and repeated path traversal during every `set(...)` call. |
| 315 | Optimize global editor directive recomputation | 🟡 | 3-6h | 2026-03-16 | The global editor directives effect currently rescans every code block whenever: |
| 320 | Add `&*name` pointee start address prefix for pointers | 🟡 | 2-4h | 2026-03-26 | 8f4e already supports `&name` to push the start byte address of a memory item and `*name` to dereference a pointer. However, there is no compile-time identifier form for "start... |
| 321 | Add `*name&` pointee end address suffix for pointers | 🟡 | 2-4h | 2026-03-26 | 8f4e supports `name&` to push the start byte address of the last word-aligned chunk covering a memory item. That gives users an address-oriented way to reference the end of an a... |
| 376 | Add ASCII scene renderer for editor snapshot tests | 🟡 | 1-2d | 2026-04-08 | The editor currently has strong unit coverage for directive parsing, layout derivation, and individual widget geometry, but it does not have a cheap whole-scene regression layer... |
| 378 | Make parser stateful for block pairing and owning block context | 🟡 | 4-8h | 2026-04-08 | The tokenizer/parser already owns some cross-line structural syntax concerns such as `if` pairing and block-closure validation, but that statefulness is still too narrow in two... |
| 380 | Remove hardcoded AudioWorklet buffer size from runtime contract | 🟡 | 1-2 days | 2026-04-21 | The AudioWorklet runtime currently injects `const AUDIO_BUFFER_SIZE 128` as an auto-managed environment constant in `packages/editor/packages/runtime-audio-worklet/src/runtimeDirectives.ts`. |
| 383 | Extend CLI run with tracing and derived debug signals | 🟡 | 1-2d | 2026-04-23 | The new `cli run` command is already useful for inspecting final state after a fixed |
| 385 | Guard i32.div_s signed overflow | 🟡 | 2-4h | 2026-04-30 | The `div` instruction emits WebAssembly `i32.div_s` for integer operands. The compiler already rejects division when the divisor is not known to be non-zero, which prevents the... |
| 386 | Guard i32.rem_s divisor zero | 🟡 | 2-4h | 2026-04-30 | The `remainder` instruction emits WebAssembly `i32.rem_s` for integer operands. WebAssembly has no non-trapping variant for integer remainder. The raw opcode traps when the divi... |
| 390 | Add compiler passive data inputs for array initialization | 🟡 | 1-2d | 2026-05-04 | The compiler now uses passive data segments to restore declared initial memory, but every segment is still derived from source-level memory declarations and compiler-owned inter... |
| 398 | Add compiler peephole arithmetic strength reduction | 🟡 | 1-2 days | 2026-05-12 | The compiler now has compile-time folding and stack-level integer metadata, but runtime arithmetic codegen still emits direct WebAssembly arithmetic operations even when the top... |
| 400 | Add serial input editor environment plugin | 🟡 | 1-2d | 2026-05-13 | Add a Web Serial editor environment plugin with `@info serial`, fixed-size `@serialIn` framing, and `@serialInCallback` fanout to exported 8f4e functions. |
| 401 | Tighten runtime browser API typing | 🟡 | 2-4h | 2026-05-18 | Browser runtime packages cross platform-specific API boundaries and currently rely on broad `any` casts and `@ts-expect-error` comments in production runtime code. |
| 426 | Decide compiler broad type splitting strategy | 🟡 | 2-4h | 2026-05-26 | Decide migration boundaries for broad language-spec shapes such as `DataStructure`, `LocalBinding`, `CompilationContext`, `MapBlockState`, `CollectedNamespace`, and address-bearing constants before implementing more type splits. |
| 427 | Add depth-aware pointer metadata query dereferencing | 🟡 | 2-4h | 2026-05-27 | `sizeof(**ptr)` and `max(**ptr)` should carry explicit dereference depth and resolve against double-pointer metadata instead of targeting a literal `*ptr` identifier. |
| 429 | Unify metadata query argument shape | 🟡 | 2-4h | 2026-05-27 | Replace per-helper metadata query reference kinds with one structured query shape carrying query kind, target scope, and dereference depth. |
| 430 | Nest pointer metadata shape | 🟡 | 4-8h | 2026-05-27 | Move scattered pointer fields into a shared nested pointer metadata shape used consistently by memory, locals, and stack address metadata. |
| 431 | Separate pointer type and provenance facts | 🟡 | 2-4h | 2026-05-27 | Model declared pointer type facts separately from value provenance facts so helpers like `count(*ptr)` only use explicit count provenance. |
| 432 | Centralize compile-time metadata query resolution | 🟡 | 2-4h | 2026-05-27 | Split metadata query resolution into target lookup and query evaluation so local, intermodule, and pointer helpers share one resolver path. |
| 434 | Show const values in declaration tooltips | 🟡 | 2-4h | 2026-05-28 | Selected-line tooltips should show resolved value and type rows for highlighted `const` declaration lines when compiler metadata is available. |
| 450 | Generalize instruction placement config | 🟡 | 4-8h | 2026-06-08 | Make instruction placement metadata generic enough to express shared source-placement checks, starting with named prologue rules for directives and function parameters. |
| 452 | Add Reachability-Based Function Pruning | 🟡 | 1-2d | 2026-06-10 | Replace conservative function pruning with a reachability pass so functions only called by uncalled functions are also omitted. |
| 453 | Add indirect calls and function reference type | 🟡 | 2-4d | 2026-06-11 | Add typed function references backed by WebAssembly table indices so 8f4e can store, load, and call runtime-selected functions through `call_indirect`. |
| 454 | Add compile-time int cast helper | 🟡 | 4-8h | 2026-06-11 | Add a compile-time-only `int(...)` helper for folding numeric constants into integer arguments such as array lengths and loop counts. |
| 457 | Make load infer narrow width from pointer metadata | 🟡 | 4-8h | 2026-06-12 | Let plain `load` choose narrow signed or unsigned integer loads when address metadata proves the pointee width, while keeping raw integer addresses 32-bit. |
| 459 | Extract compiler diagnostics package | 🟡 | 2-4h | 2026-06-15 | Move compiler diagnostic construction into a small shared package so compiler-adjacent packages can emit consistent diagnostics without importing compiler internals. |
| 461 | Decouple language-spec from WASM output contracts | 🟡 | 1-2d | 2026-06-16 | Move WASM-only output and runtime contracts out of language-spec while keeping target-neutral language facts there. |
| 483 | Lazy-load WASM overlay rendering | 🟡 | 1-2d | 2026-09-06 | Load the framebuffer overlay drawer and RGBA layer only when a project configures an overlay. |
| 486 | Lazy-load editing features on entering edit mode | 🟡 | 2-4d | 2026-09-06 | Keep authoring-only effects out of view-mode startup and load them before editing becomes available. |
| 491 | Migrate project testing to native assertions | 🟡 | 2-4d | 2026-10-09 | Use TODO 490 in the shared runner, migrate fixtures and CLI, remove the precompiler, and add an editor test runtime. |
| 493 | Index compiled functions by project block ID | 🟡 | 2-4h | 2026-10-14 | Reuse a compilation-derived Map for function-block layout, stack-widget, and tooltip lookups instead of repeatedly scanning all compiled functions. |
| 494 | Make editor block-highlight parsing linear | 🟡 | 3-6h | 2026-10-14 | Track open-block counts and matching stacks incrementally to avoid repeated history scans and array copies during highlight parsing. |
| 498 | Consolidate shared editor test-state builders | 🟡 | 4-8h | 2026-10-14 | Share complete typed state defaults and migrate cast-based editor/runtime fixtures so missing required fields are caught earlier. |
| 499 | Unify project instruction syntax parsing | 🟡 | 4-8h | 2026-10-14 | Move exposure syntax into the tokenizer alongside pass and init, with shared comment handling, validation, and source diagnostics. |
| 500 | Keep planned memory and its source together | 🟡 | 4-8h | 2026-10-14 | Attach effective source information to each planned declaration, removing parallel arrays and positional source lookups. |
| 501 | Preserve known pointee counts of one | 🟡 | 1-2h | 2026-10-16 | Retain proven single-element pointee counts so count(*pointer) resolves correctly while unknown counts remain errors. |
| 502 | Add browser-driven accessibility color-scheme overrides | 🟡 | 2-4d | 2026-10-18 | Add tested alternative editor palettes selected automatically from supported browser contrast and forced-color preferences. |
| 503 | Explore WebMCP tools for inspecting and editing projects | 🟡 | 1-2d | 2026-10-18 | Research and prototype a safe browser-agent command surface for semantic project inspection and code-block changes. |
| 504 | Add a color-theme contrast audit tool | 🟡 | 1-2d | 2026-10-21 | Measure critical foreground/background pairs in resolved editor themes and report contrast failures, including alpha compositing. |
| 505 | Add an initial editor mode directive | 🟡 | 4-8h | 2026-10-21 | Let projects request edit or view mode at load time while preserving host-level mode policy and later user mode changes. |
| 506 | Add an inline sample browser directive | 🟡 | TBD | 2026-10-22 | Render a folder/file browser inside a code block and update a bound binary asset URL when a sample is selected. |
| 508 | Design lazy loading for editor plugins | 🟡 | TBD | 2026-10-26 | Work out plugin discovery, asynchronous activation, readiness, and per-editor cleanup while measuring initial-bundle savings. |
| 509 | Rebuild editor colors from a small base palette | 🟡 | TBD | 2026-10-26 | Replace feature-specific colors with a few shared base colors, generate lighter and darker shades, and use those shades in core and plugin drawers. |

### 🟢 Low Priority

| ID | Title | Priority | Effort | Created | Summary |
| ---- | ----- | -------- | ------ | ------- | ------- |
| 364 | Centralize alwaysOnTop code block partition logic | 🟢 | 1-2 hours | 2026-04-03 | The `@alwaysOnTop` behavior is implemented through repeated ad hoc array partitioning of `graphicHelper.codeBlocks`. The same "normal blocks first, always-on-top blocks last" ru... |
| 388 | Add PixelCode font to sprite-generator | 🟢 | 4-8h | 2026-05-02 | The editor sprite-generator has several bundled bitmap fonts, but it does not include PixelCode/Pixel Code. PixelCode is an upstream pixel font aimed at programming, which makes... |
| 389 | Add EagleSpCGA Alt3 8x8 font to sprite-generator | 🟢 | 4-8h | 2026-05-04 | The editor sprite-generator has several bundled bitmap fonts, including a few compact 8-pixel-high options, but it does not include EagleSpCGA Alt3 8x8. That leaves the editor w... |
| 465 | Add Sergamon font to the editor | 🟢 | 4-8h | 2026-07-30 | Add Sergamon's 8x16 programming-font glyphs to the sprite-generator pipeline and expose the font through editor configuration. |
| 466 | Add Scientifica font to the editor | 🟢 | 4-8h | 2026-07-30 | Import Scientifica's regular 11-pixel BDF face into the sprite-generator pipeline and expose the condensed font through editor configuration. |

## Completed TODOs

| ID | Title | Completed | Notes |
| ---- | ----- | --------- | ----- |
| 507 | Design plugin fill-color contributions | 2026-10-26 | Cancelled; TODO 509 replaces plugin-owned color registration with a shared base palette and generated shades. |
| 271 | Add float64 support for loadFloat instruction | 2026-10-21 | Completed in [PR #1120](https://github.com/8f4e/8f4e/pull/1120); linked issue #422 was closed as completed. |
| 496 | Use Set and Map for binary-asset lookups | 2026-10-21 | Completed in [PR #1104](https://github.com/8f4e/8f4e/pull/1104); linked issue #1013 was closed as completed. |
| 475 | Remove dead compiler block-state caches | 2026-10-20 | Completed in [PR #1101](https://github.com/8f4e/8f4e/pull/1101); linked issue #954 was closed as completed. |
| 272 | Add float32/float64 width checks to localSet instruction | 2026-10-20 | Completed in [PR #1100](https://github.com/8f4e/8f4e/pull/1100); linked issue #551 was closed as completed. |
| 495 | Index editor pointer targets by address | 2026-10-20 | Completed in [PR #1108](https://github.com/8f4e/8f4e/pull/1108); linked issue #1012 was closed as completed. |
| 424 | Rename compiler allocation-grid metadata to allocation-unit terminology | 2026-10-19 | Completed in [PR #1111](https://github.com/8f4e/8f4e/pull/1111); linked issue #712 was closed as completed. |
| 269 | Add float64 support for round instruction | 2026-10-15 | Completed in [PR #1040](https://github.com/8f4e/8f4e/pull/1040); linked issue #415 was closed as completed. |
| 497 | Unify editor memory resolution for exposed aliases | 2026-10-14 | Added shared target resolution across widgets, connectors, and environment bindings, with canonical-owner control saving and regression coverage. |
| 490 | Add native compiler assertions | 2026-10-09 | Added opt-in assert/assertEqual, typed callbacks, disabled operand drops, and compiler source-site metadata; existing testing remains in place pending TODO 491. |
| 480 | Simplify map codegen with reverse row order | 2026-10-09 | Preserved first-match behavior with two map temporaries; added numeric edge-case project fixtures and a one-time benchmark showing 2.40–2.47× faster 64-row lookups and 1,863 → 895 byte fixtures. |
| 487 | Save projects to reusable browser file handles | 2026-10-04 | Separated explicit source saves from session autosave; added per-editor writable file associations, Save As, safe project replacement, cancellation, and upload/download fallback. |
| 481 | Centralize compiler local allocation | 2026-10-01 | Added shared allocation, typed-allocation, reuse, and reset helpers across compiler stages; 2,000-local warm-cache compilation fell from 322.048 ms to 3.363 ms in the documented benchmark. |
| 482 | Resolve sprite identifiers before drawing | 2026-10-01 | Added setup-time public-key resolution, atlas-specific dense sprite ids, direct packed-metadata submission, atlas-replacement integration, and a retained byte-equivalence benchmark. |
| 489 | Remove obsolete intermodular nth-reference helpers | 2026-09-30 | Deleted two test-only tokenizer helpers while preserving and strengthening coverage of the live nth-reference classifier. |
| 488 | Remove disabled editor debug overlays | 2026-09-30 | Removed the disconnected info and console overlays and their public flags while retaining state-backed logging. |
| 274 | Remove unused editor-core feature-flag configuration | 2026-09-30 | Deleted the test-only editor-core implementation and retained focused coverage beside the canonical editor-state feature flags. |
| 448 | Move prototype content validation to parser | 2026-09-07 | Cancelled as stale; parser-owned placement validation already rejects invalid prototype contents. GitHub issue #944 was closed as not planned. |
| 425 | Split StackItem into value and address variants | 2026-09-07 | Cancelled as stale; the value/address discriminated union is already implemented. GitHub issue #713 was closed as not planned. |
| 408 | Reduce tokenizer identifier classification work | 2026-09-07 | Cancelled as stale; identifier dispatch is already optimized and GitHub issue #661 was already closed as completed. |
| 407 | Optimize normalizeArgumentsAtIndexes | 2026-09-07 | Cancelled as stale; the targeted normalization path was removed by later compiler refactoring. GitHub issue #660 was closed as not planned. |
| 406 | Review repeated compiler namespace prepass work | 2026-09-07 | Cancelled as stale; the targeted prepass architecture was superseded by namespace/layout restructuring. GitHub issue #659 was closed as not planned. |
| 270 | Add float64 support for castToInt instruction | 2026-09-07 | Cancelled as stale; float64 conversion and tests are already implemented. GitHub issue #414 was closed as not planned. |
| 261 | Update instruction test helpers for float64 and refactor call test | 2026-09-07 | Cancelled as stale; float64 call coverage landed and the old helper was removed. GitHub issue #644 was closed as not planned. |
| 179 | Add glugglugglug shader error callback for editor logging | 2026-09-07 | Cancelled; GitHub issue #549 was closed as not planned. |
| 485 | Lazy-load project export formatting | 2026-09-07 | Cancelled; lazy-loading export formatting is no longer planned. |
| 484 | Lazy-load context-menu builders | 2026-09-07 | Cancelled; lazy-loading context-menu builders is no longer planned. |
| 468 | Add shader-batched raster caches to glugglugglug | 2026-09-07 | Cancelled; the shader-batched raster-cache design is no longer planned. |
| 377 | Batch-parse modules and validate shared ids | 2026-09-07 | Cancelled; GitHub issue #559 was closed as not planned. |
| 295 | Unify code render rows and width derivation | 2026-09-07 | Cancelled; GitHub issue #554 was closed as not planned. |
| 170 | Toggle post-process effects via function key | 2026-09-07 | Cancelled; GitHub issue #402 was closed as not planned. |
| 155 | Add Framebuffer Memory Accounting in glugglugglug | 2026-09-07 | Cancelled; GitHub issue #548 was closed as not planned. |
| 057 | Research JavaScript/WebAssembly Runtimes for Step-by-Step Execution | 2026-09-07 | Cancelled; GitHub issue #543 was closed as not planned. |
| 052 | Simplify Cache Rendering Order | 2026-09-07 | Cancelled; GitHub issue #540 was closed as not planned. |
| 016 | Runtime Loading UI Improvements | 2026-09-07 | Cancelled; GitHub issue #538 was closed as not planned. |
| 479 | Pass constant namespaces into groups | 2026-08-27 | Added explicit same-name namespace forwarding with `pass`, ordinary per-block `use` imports, immediate-parent aliases, source-contextual diagnostics, editor round trips, and cache-safe semantic recomputation. |
| 478 | Resolve group memory exposures through an alias table | 2026-08-26 | Added structured aliases across layout-aware and semantic resolution while preserving source ASTs, canonical memory provenance, and backing declaration types. |
| 477 | Establish compiler-owned ProjectObjectModel | 2026-08-24 | Added compiler-owned typed block collections, recursively owned groups, direct root compilation, text parsing, and repository-wide consumer migration. |
| 476 | Extract web UI render projection | 2026-08-21 | Extracted renderer-specific sprite projection into a dedicated package while retaining logical layout and caret data in editor state. |
| 470 | Add no-op cacheGroup compatibility helper to glugglug2 utilities | 2026-08-19 | Added a temporary migration shim; removed it on 2026-08-20 after web-ui switched to direct drawing. |
| 474 | Add RGBA texture layer plugin to glugglug2 | 2026-08-19 | Added fixed-phase RGBA8 texture uploads, same-storage updates, nearest/linear filtering, top-left rectangle draws, and independent texture/plugin ownership. |
| 473 | Add post-process plugin to glugglug2 | 2026-08-19 | Added an inactive-zero-cost postDraw effect using a resize-aware RGB8 GPU framebuffer copy, ordered overlay inclusion, atomic replacement, and whole-scene visual coverage. |
| 472 | Add shader underlay plugin to glugglug2 | 2026-08-19 | Added an atomic fullscreen preDraw effect with old-compatible varyings, optional time/resolution uniforms, independent cleanup, and combined visual coverage. |
| 471 | Expose raw WebGL render hooks in glugglug2 | 2026-08-19 | Exposed the shared WebGL2 context and ordered pre/post hooks with defensive state restoration, plus an exported instanced line-overlay example plugin. |
| 469 | Add optional drawing utilities to glugglug2 | 2026-08-19 | Added an optional SpriteTarget-based DrawContext with reusable nested offsets and allocation-free fixed-cell sprite text under `glugglug2/utils`. |
| 467 | Add instanced sprite-only glugglug2 renderer | 2026-08-19 | Added a sprite-only WebGL2 package with a persistent atlas, compact ordered instance uploads, one instanced draw call, focused tests, and a browser-verified example. |
| 464 | Require explicit stdlib include exports | 2026-06-19 | Include-local `#export` now marks public stdlib functions, private helpers are prefixed, and `readInterpolated` exercises the private-helper path. |
| 458 | Decouple module execution order from memory layout | 2026-06-18 | Memory layout now allocates modules alphabetically by id while execution order remains driven by entry/module source order. |
| 460 | Fix cross-block constant cache dependencies | 2026-06-17 | Constant resolution now returns per-line facts beside source-shaped cached ASTs, and recompiling with a changed constants block re-resolves unchanged cached module ASTs correctly. |
| 463 | Refactor stack analyzer to return fact report | 2026-06-17 | Stack analysis now returns explicit keyed facts consumed by compiler orchestration and code generation without mutating AST lines. |
| 462 | Extract semantic reference resolver | 2026-06-17 | Semantic reference resolution now runs once in compileSubProgram and returns a report consumed by stack analysis and WASM codegen alongside unchanged ASTs. |
| 384 | Add compiler algorithmic regression metrics | 2026-06-14 | Release-level compiler execution counters and dashboard accepted as complete; maintainer reaffirmed completion on 2026-10-14. |
| 381 | Add #follow module layout directive | 2026-06-14 | Cancelled; no strict `#follow` module layout adjacency directive is planned. |
| 280 | Add reverse stack instruction with explicit item count | 2026-06-14 | Cancelled; no explicit `reverse <count>` stack instruction is planned. |
| 211 | Add WASM memory to GLSL float uniform bindings via project config | 2026-06-14 | Project config now supports shader uniform bindings from WASM memory for postprocess and background effects. |
| 203 | Use CodeBlock name instead of recomputing from code | 2026-06-14 | Code block names are now treated as stable stored data instead of being recomputed from code during normal update paths. |
| 062 | Editor Command Queue Refactor | 2026-06-14 | Cancelled; no command-queue refactor is planned for this editor host-callback cleanup. |
| 054 | Benchmark Unrolled vs Normal Loop in Audio Buffer Filler | 2026-06-14 | Cancelled; no benchmark work is planned for this old audio-buffer loop strategy investigation. |
| 446 | Store project block type during project parse | 2026-06-11 | Superseded first by project-preparser classification and later by the compiler-owned typed collections in `ProjectObjectModel`. |
| 449 | Add function paramShape instruction | 2026-06-14 | Archived with the exact completion date unknown; `paramShape <prototypeId>` now expands prototype memory declarations into function pointer params while prototypes remain memory-shape-only. |
| 451 | Add pushShape instruction | 2026-06-14 | Archived with the exact completion date unknown; `pushShape <prototypeId>` now pushes effective module memory addresses in prototype order for `paramShape` call sites. |
| 456 | Improve function overload mismatch diagnostics | 2026-06-13 | Failed overload resolution now reports inferred call signatures while listing available overload signatures, without changing true missing-function diagnostics. |
| 455 | Unify assert and assertf with polymorphic overloads | 2026-06-12 | Float assertion fixtures now use polymorphic `assert` consistently, and any remaining `assertf` behavior is treated as compatibility. |
| 435 | Add polymorphic function overloads | 2026-06-09 | Implemented in PR #784: functions can share a source name across exact parameter signatures, use signature-derived ids, and resolve calls through stack-based overload matching. |
| 441 | Migrate binary asset directives to config | 2026-06-04 | Binary asset loading now uses schema-backed `@config bin...` entries; old `@defAsset` / `@loadAsset` parsing and compatibility names were removed. |
| 440 | Migrate keyboard memory directives to config | 2026-06-04 | Keyboard memory targets now use schema-backed `@config keyboard...` entries, and the keyboard plugin activates from config paths instead of custom directives. |
| 439 | Migrate @midiIn to config directive | 2026-06-04 | MIDI input bindings now use schema-backed `@config midi.inputs...` entries, with no live `@midiIn` support remaining. |
| 447 | Remove duplicated constants block validation | 2026-06-01 | `parseConstantsAST()` now only asserts block type; invalid constants-block contents are rejected by the shared instruction-spec validation path during namespace collection. |
| 444 | Use parser-collected shape lines for prototype expansion | 2026-06-01 | Module ASTs now carry parser-collected `shapeLines`, and prototype expansion uses those parsed lines instead of rescanning/reparsing shaped module source. |
| 438 | Add generic function imports | 2026-05-29 | `#import <field-name>` now declares host-provided functions, imported functions participate in normal `call` resolution and stack typing, WebAssembly import/function indexes are emitted correctly, and invalid import shapes have compiler coverage. |
| 437 | Add execution entries | 2026-05-29 | `entry` / `entryEnd` now partitions modules into exported execution entries, `initDefaults` only initializes memory defaults, old test/init-only grouping was removed, and examples/runtime/CLI paths use the new entry exports. |
| 150 | Add Test Module Type | 2026-05-29 | Completed by the `entry test` CLI test runner flow and superseded by execution entries plus generic function imports. |
| 433 | Add dash argument continuation lines | 2026-05-28 | Parser now folds `- <arg>` continuation lines into the previous source instruction before validation; docs and tokenizer coverage describe valid and invalid forms. |
| 428 | Add pointer-aware count and min metadata queries | 2026-05-27 | `min(*ptr)` and `count(*ptr)` now classify explicitly and resolve from pointer metadata; pointer count uses tracked memory-start pointee element counts when available and falls back to `1`. |
| 323 | Add `min(*name)` pointee min value prefix for pointers | 2026-05-27 | Completed as part of pointer-aware metadata query work; `min(*name)` now has parser, semantic, helper, docs, and public compiler coverage. |
| 423 | Narrow AST line metadata interfaces | 2026-05-26 | `ASTLineBase` now only carries core line identity; memory, semantic, directive, and block metadata live on concrete line interfaces, and snapshots were updated to show the narrower public AST shape. |
| 410 | Consolidate release action commits | 2026-05-19 | Release workflow now uses the two-commit fallback: Nx keeps the version commit, and bundle-size, bytecode-size, compiler-coverage, and docs-coverage logs are committed together as release metrics before the atomic tag push. |
| 409 | Track block context flags during stack analysis | 2026-05-19 | Stack analysis now carries cached block-context flags, `validateInstruction` reads them directly, and shared block-stack helpers maintain the flags with focused test coverage. |
| 405 | Avoid AST cache hashing when no cache entry exists | 2026-05-19 | Tokenizer AST cache lookup now skips `hashSource(...)` on initial misses and obvious line-count misses while preserving hash validation for existing same-line-count entries. |
| 421 | Clean up AST construction helper scans | 2026-05-26 | Tokenizer AST construction now accumulates module/function/constants metadata through source-block-specific builders during parsing; generic post-processing scans over `CompilerASTLine[]` were removed. |
| 422 | Split namespace discovery and layout prepass | 2026-05-26 | Namespace discovery now uses an explicit internal discovery path, final layout/default resolution uses `layoutNamespace(...)`, and the old mode flag/prepass naming was removed without typed-AST compatibility wrappers. |
| 419 | Merge instruction source argument specs into instruction specs | 2026-05-26 | Source argument arity and shape metadata now lives in language-spec instruction specs; tokenizer validation consumes the shared contract, and duplicated argument/no-argument tables were removed without compatibility shims. |
| 420 | Add typed compiler AST entry indexes | 2026-05-26 | Compiler-owned AST inputs now use typed module/function/constants entry objects with required ids and derived metadata, so compiler passes no longer rediscover those facts from raw line arrays. |
| 417 | Tighten compiler AST union and source block types | 2026-05-25 | Compiler AST lines are now a discriminated union with source-block tuple types; tokenizer validation owns fixed arity, and namespace metadata no longer revalidates syntax-guaranteed prologue or return shapes. |
| 416 | Add resolved identifier line forms | 2026-05-25 | Semantic normalization now carries resolved memory, local, pointer, function, and local-set targets through stack analysis and codegen; old push-target rediscovery was removed. |
| 415 | Discriminate compiler block stack frames | 2026-05-25 | Block stack frames are now a discriminated union; map frames require `mapState`, loop frames require counter metadata, and codegen consumers no longer use the old block-frame non-null assertions. |
| 418 | Replace serialized function type registry keys | 2026-05-25 | Function type registry signatures are now typed records with structural equality through a registry helper; serialized JSON keys and `signatureMap` were removed without compatibility shims. |
| 414 | Split compiler context phase types | 2026-05-25 | Namespace prepass, module compilation, and function compilation now use phase-specific context types; function codegen receives required signature/type-registry state and module layout fallbacks were removed. |
| 413 | Split compiled function lifecycle types | 2026-05-25 | Pre-codegen function metadata is now separate from final compiled function output; final functions require `wasmIndex`, `typeIndex`, and `ast`, removing lifecycle-field non-null assertions from compiler assembly. |
| 411 | Move compiler analysis metadata into instruction specs | 2026-05-25 | Generic fixed stack effects, block-close behavior, and memory operation metadata now live in `instructionSpecs.ts`; stack analysis and memory codegen consume the metadata while dynamic function, map, and arithmetic metadata algorithms stay explicit. |
| 412 | Expose compiler stack analysis results | 2026-05-21 | `includeStackAnalysis` now returns compact per-line stack analysis for compiled modules and functions, independently from AST output. |
| 397 | Finish compiler stack analysis/codegen separation | 2026-05-20 | Stack analysis now produces analyzed lines for codegen, and instruction emitters consume analysis results instead of mutating validation stack state directly. |
| 399 | Consolidate instruction compiler utilities | 2026-05-12 | Instruction-compiler-only helpers moved under `packages/compiler/src/instructionCompilers/utils/`; `saveByteCode` split out, unused word-alignment helper removed, and numeric binary instruction codegen centralized. |
| 055 | Implement strength reduction optimization techniques in compiler | 2026-05-12 | Archived original TODO; remaining bytecode peephole optimization work is tracked in `398`. |
| 392 | Move shared compiler constants to language-spec | 2026-05-11 | Shared memory layout, integer range, logic level, memory access-width, and Wasm page constants now resolve from `@8f4e/language-spec`; compiler-only bytecode header/export-count constants remain private. |
| 394 | Extract compiler stack analysis into a separate pass | 2026-05-08 | `withValidation` was removed, stack validation helpers moved under `packages/compiler/src/stackAnalysis/`, and compiler instruction contracts were centralized in `instructionSpecs.ts`; remaining codegen separation is tracked in `397`. |
| 381 | Review compiler compileSegment usage for unnecessary self-compilation | 2026-05-08 | Archived after verification: no current compiler `compileSegment(...)` call sites remain under `packages/compiler/src`; removal landed in `e73dd2486`. |
| 387 | Add lazy editor environment plugins | 2026-05-01 | Directive-triggered lazy editor environment plugins now load keyboard memory and binary asset integrations only when matching directives are present. |
| 262 | Add float64 support for equal instruction | 2026-05-10 | `equal` now emits `F64_EQ` for float64 operands and has unit/public regression coverage. |
| 263 | Add float64 support for lessThan instruction | 2026-05-10 | `lessThan` now emits `F64_LT` for float64 operands and has unit/public regression coverage. |
| 264 | Add float64 support for lessOrEqual instruction | 2026-05-10 | `lessOrEqual` now emits `F64_LE` for float64 operands and has unit/public regression coverage. |
| 265 | Add float64 support for greaterThan instruction | 2026-05-10 | `greaterThan` now emits `F64_GT` for float64 operands and has unit/public regression coverage. |
| 266 | Add float64 support for greaterOrEqual instruction | 2026-05-10 | `greaterOrEqual` now emits `F64_GE` for float64 operands and has unit/public regression coverage. |
| 267 | Add float64 support for greaterOrEqualUnsigned instruction | 2026-05-10 | `greaterOrEqualUnsigned` now emits `F64_GE` for float64 operands and has unit/public regression coverage. |
| 268 | Add float64 support for sqrt instruction | 2026-05-10 | `sqrt` now emits `F64_SQRT`, preserves float64 metadata, and no longer marks the result as always non-zero. |
| 395 | Add exported 8f4e functions | 2026-05-10 | `#export <exportedName>` now exports user functions through the generated WebAssembly ABI with positional JS numeric arguments and duplicate-name validation. |
| 396 | Add MIDI input editor environment plugin | 2026-05-11 | The editor MIDI plugin now lazy-loads from `@midiIn`, lists devices via `@info midi`, and forwards MIDI input bytes to exported 8f4e callbacks through a shared-memory Wasm instance. |
| 402 | Restrict compiler directives to block prologue | 2026-05-19 | Compiler directives are now validated as module/function prologue metadata, with late directives rejected by a dedicated compiler diagnostic. |
| 404 | Refactor address metadata into first-class shape | 2026-05-19 | Address metadata now lives under `StackItem.address` / normalized literal `address`, replacing scattered safe/clamp/access-width fields. |
| 403 | Add logical memory regions for multi-memory | 2026-05-19 | Historical implementation, removed before release in favor of one shared linear address space. |
| 391 | Add compiler AST cache for incremental compiles | 2026-05-04 | `compile()` now returns and accepts an opaque AST cache for unchanged expanded module and function inputs. |
| 329 | Replace literal-only const collection with semantic namespace prepass | 2026-03-27 | Replaced `collectConstants(ast)` bootstrap with semantic namespace prepass. |
| 330 | Centralize compile-time folding as an AST normalization pass | 2026-03-27 | Compile-time folding now runs as a semantic normalization pass before codegen. |
| 331 | Delete duplicate downstream compile-time resolution paths | 2026-03-27 | Removed duplicate downstream compile-time resolution, including old `push` metadata fallbacks. |
| 370 | Move if result type to ifEnd and drop explicit void | 2026-04-08 | `if`/`ifEnd` pairing now happens in the tokenizer/parser, with source-faithful AST metadata and no compiler-side rewrite pass. |
| 332 | Extract syntax and AST parsing into a separate compiler package | 2026-03-27 | `source -> AST` now lives in `packages/tokenizer`. |
| 334 | Move locals out of namespace and into codegen state | 2026-03-27 | Locals now live in `CompilationContext.locals` instead of `namespace.locals`. |
| 340 | Move compiler-generated hidden resources into a separate internal address space | 2026-03-27 | Hidden resources now allocate separately from user/module memory and no longer affect module layout. |
| 319 | Add `sizeof(*name)` pointee element word size prefix for pointers | 2026-03-30 | Pointer metadata now supports `sizeof(*name)` for pointee element word size. |
| 322 | Add `^*name` pointee max value prefix for pointers | 2026-03-30 | Pointer metadata now supports `^*name` for pointee max value. |
| 324 | Add `int16*` pointer types to compiler and runtime | 2026-03-30 | Compiler, runtime metadata, and docs now support `int16*` pointer types. |
| 325 | Add literal-only `*` and `/` folding at argument parse time | 2026-03-30 | Tokenizer now folds literal-only mul/div expressions to literals during argument parsing, with parser and compiler integration coverage. |
| 326 | Unify remaining editor/runtime memory ids to `module:memory` syntax | 2026-03-30 | Editor/runtime cross-module memory-id plumbing now consistently uses `module:memory`; compiler metadata-operator dot syntax remains intentionally separate. |
| 343 | Move arity and raw argument-shape validation into tokenizer | 2026-03-28 | Tokenizer now owns the syntax-only arity and raw argument-shape validation surface. |
| 344 | Move identifier existence validation into semantic pass and shrink codegen validation | 2026-03-29 | Identifier existence validation now lives in semantic normalization/prepass instead of being rediscovered in codegen. |
| 345 | Tighten tokenizer-to-compiler contract with typed AST lines | 2026-03-29 | Parsed and normalized AST stages now have stronger typed contracts across tokenizer, semantics, and compiler consumers. |
| 346 | Split semantic normalization into instruction-specific files | 2026-03-28 | normalization/ folder with per-instruction files; normalizeCompileTimeArguments.ts is now a thin dispatcher wrapper. |
| 347 | Move function name collection and call target validation into semantic prepass | 2026-03-29 | Function IDs now collected via `collectFunctionIdsFromAsts()` before codegen; `call` target existence validated in `normalizeCall` before codegen. |
| 348 | Add viewport-anchored code block directive | 2026-03-30 | Archived by user request. |
| 349 | Add always-on-top editor directive for code blocks | 2026-03-30 | Archived by user request. |
| 308 | Simplify memory instruction default value resolution | 2026-03-31 | `memoryInstructionParser.ts` now centralizes split-byte and default-value resolution into smaller semantic helpers. |
| 350 | Remove intermodule default placeholder handling from memory parser | 2026-03-31 | Removed the fake `0` intermodule-default path from `memoryInstructionParser.ts`; deferred state is now owned earlier in semantic normalization. |
| 351 | Update editor intermodule reference renaming for current syntax | 2026-03-31 | Editor paste/rename flows now rewrite the current `module:`-based intermodule syntax and function-style queries instead of obsolete dotted/operator forms. |
| 352 | Unify semantic const collection and namespace import rules | 2026-03-31 | Module compilation now reapplies semantic lines directly instead of seeding const/import state from copied prepass snapshots. |
| 306 | Refactor graphOptimizer to precompute module dependencies | 2026-03-31 | `graphOptimizer.ts` now precomputes per-module metadata and shared intermodule dependency extraction before deterministic ordering. |
| 336 | Move identifier reference classification into tokenizer | 2026-03-30 | Identifier-shaped argument classification now lives in tokenizer metadata instead of compiler-side raw string reclassification. |
| 337 | Add structured address and query extraction to tokenizer | 2026-03-30 | Address/query identifier structure now flows through AST metadata instead of compiler-side syntax reconstruction. |
| 338 | Add richer compile-time expression AST nodes | 2026-03-30 | Compile-time expression nodes now carry richer parsed structure and precomputed intermodule metadata for compiler consumers. |
| 339 | Add instruction classification metadata to AST lines | 2026-03-30 | AST lines now carry parser-owned instruction classification metadata used for compiler routing. |
| 341 | Inline address references during semantic normalization | 2026-03-30 | Local `&name` and `name&` address references are now inlined to literals during semantic normalization; `pushMemoryReference.ts` deleted. |
| 342 | Inline intermodule address references during semantic normalization | 2026-03-30 | Intermodule `&module:memory`, `module:memory&`, `&module:`, and `module:&` address references are now inlined to literals in `resolveCompileTimeOperand` once cross-module layout is known. |
| 301 | Refactor constant namespace collection and remove duplicated const parsing | 2026-03-30 | Superseded by the current semantic const pipeline; the remaining work is tracked in `352`. |
| 310 | Simplify compiler project flattening and compilable block checks | 2026-03-30 | Archived by user request as already completed. |
| 309 | Extract shared module memory identifier parser | 2026-03-30 | Superseded by later tokenizer/compiler metadata work; the remaining issue is editor-side obsolete source-syntax renaming, tracked separately in `351`. |
| 353 | Nest tokenizer package under compiler | 2026-03-31 | Tokenizer now lives at `packages/compiler/packages/sub-program/packages/tokenizer`; Nx and TypeScript path resolution updated to the nested layout. |
| 254 | Fix max/min helpers for float64 memory | 2026-04-02 | `getElementMaxValue`/`getElementMinValue` now branch on `elementWordSize === 8` and return correct float64 bounds. |
| 257 | Fix collectConstants identifier RHS resolution | 2026-04-02 | Superseded by semantic normalization refactor; constant RHS now resolved via the normalization pipeline without force-casting. |
| 292 | Refactor error systems and document syntax vs compiler error boundaries | 2026-04-02 | `errors.ts` renamed to `compilerError.ts`; `SyntaxRulesError` centralized; policy comments added to both modules. |
| 303 | Dedupe font atlas rows for identical text colors | 2026-03-31 | Sprite generator now deduplicates font atlas rows for identical text color roles. |
| 354 | Extract WASM Utils to Separate Package | 2026-04-02 | WASM utility functions extracted from `packages/compiler/src/wasmUtils`; the package now lives under `packages/compiler/packages/wasm-codegen/packages/wasm-utils`. |
| 355 | Replace `isPointingToInt8`/`isPointingToInt16` booleans with a single `pointeeBaseType` field | 2026-04-07 | Archived after completion; `DataStructure` pointer metadata now uses `pointeeBaseType` as the single source of truth. |
| 356 | Consolidate declaration compilers into a single factory | 2026-04-08 | Archived after completion; scalar declaration compilers now share `createDeclarationCompiler` instead of duplicating per-type implementation logic. |
| 357 | Reuse single-block recompute in bulk viewport-anchored loop | 2026-04-15 | Archived after completion; viewport-anchored recomputation now delegates through one shared single-block path using the rounded viewport dimensions expected by the resolver. |
| 358 | Convert worldPositionToAnchoredPos to use an input object | 2026-04-15 | Archived after completion; viewport anchored reverse-position conversion now uses a named input object instead of an 11-argument positional call signature. |
| 359 | Audit borderLineCoordinates use of raw vs rounded viewport dimensions | 2026-04-15 | Archived after completion; offscreen arrow border lines intentionally continue using raw viewport dimensions so indicators target the visible pixel edge rather than the grid-snapped anchored-position bounds. |
| 362 | Refactor ArgumentIdentifier to a discriminated union | 2026-04-15 | Archived after completion; tokenizer identifier nodes now use a real discriminated union, and compiler consumers no longer rely on non-null assertions for reference-kind-specific fields. |
| 360 | Use `createMockState` in viewport-anchored dragging integration test | 2026-04-07 | Archived after completion; the viewport-anchored dragging test now relies on shared mock-state defaults instead of a hand-built state literal. |
| 365 | Unify editor directive parsing and alias normalization | 2026-04-15 | Archived after completion; editor directive parsing and alias normalization now share a single implementation path across direct parsing and cached directive derivation. |
| 366 | Add configurable loop cap directive and loop override | 2026-04-08 | Archived after completion; loop guards now support configurable ambient defaults and per-loop overrides instead of a fixed hardcoded cap only. |
| 367 | Refactor compiler directive plumbing and loop guard config | 2026-04-08 | Archived after completion; compiler directive handling and loop-guard configuration were cleaned up to remove repeated plumbing and centralize defaults. |
| 372 | Make `push <local>` fully equivalent to `localGet` | 2026-04-07 | Archived after completion; `push <local>` now matches `localGet` for local-read semantics, including metadata and identifier-resolution behavior. |
| 373 | Remove `localGet` and migrate sources to `push` | 2026-04-07 | Archived after completion; active compiler-owned sources, tests, docs, fixtures, and examples now use `push` for local reads. |
| 374 | Add local-vs-memory name collision errors | 2026-04-07 | Archived after completion; local declarations now fail immediately when they reuse a memory identifier in the same namespace. |
