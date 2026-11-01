# 8f4e single memory removal audit

Recorded on 2026-10-16 against commit `682c069bd2fb16df339c3e0fd1d63d96d015af48` on `main`.

The intended change is to remove support for multiple WebAssembly linear memories throughout 8f4e. The user states
that the feature is unused and the project is unreleased, so obsolete syntax, public fields, and internal contracts
can be removed directly without compatibility aliases or a deprecation period. The requested scope includes adjacent
helpers, state, adapters, and tests that would become unnecessary after removing the feature.

Implementation is complete on branch `ai/remove-multiple-wasm-memories`. The repository was clean apart from this
saved audit before implementation. Implementation started from commit `dc612a3cc06319c6993689e7aca5b3801200449f`.
The findings below describe the pre-removal code and preserve the rationale for
the cleanup; the outcome and validation are recorded here.

## Implementation outcome

- Removed region configuration, `#region`, its AST and argument rules, four region-specific diagnostics, region
  identity helpers, and the per-memory allocation cursor. All modules now allocate into one address space.
- Emission creates one `host.memory` import. Initialization, loads/stores, pointer dereferences, bounds guards,
  clamping, bulk-memory operations, and passive segments no longer select a memory index.
- Removed memory identity from public results, layout/declaration records, addresses, pointers, patches, and
  compiler contexts. The test runner now accepts and returns one `memory`; supplied memory remains borrowed.
- Removed redundant namespace summaries, unused semantic context fields, identity-only local assignment facts,
  the codegen operand adapter, empty per-pointer metadata records, and redundant pointer-map rebuilding. Pointer
  element counts, address/value distinctions, range proofs, function registration, and declaration ordinals remain.
- Removed both `@memoryRegions` fixture parsers, region-only fixtures and snapshots, and website gallery exclusions.
  Converted the mixed group-initializer fixture to single-memory coverage of pointee type and element count.
- Updated editor/worker/CLI contracts, current docs, test-runner guidance, and relevant active TODOs. Historical
  archived designs remain unchanged. This audit also preserves the original PR and merge-commit findings.
- Removed the test-only pointee-count fallback helpers and their obsolete unit test. The defaults resolver now
  consumes only declaration-reference facts and returns the defaults record directly, with no pointer metadata
  forwarding or compatibility wrapper. Compiler orchestration reads counts from the memory-reference report.
- The pre-existing count-one bug is documented separately in
  [TODO 501](todos/501-preserve-known-pointee-counts-of-one.md) and
  [issue #1042](https://github.com/8f4e/8f4e/issues/1042). Its behavior is deliberately unchanged in this cleanup.

## Implementation validation

Validated with Node 24.16.0 through Nx:

- `npx nx run-many --target=build --all --parallel=1`: passed for 38 projects, including both websites.
- `npx nx run-many --target=test --all --parallel=1`: passed for 33 projects, including compiler passes, codegen
  utilities, editor widgets/state, live compiler memory updates, test/audio/worker runtimes, and CLI example snapshots.
- `npx nx run-many --target=typecheck --all --parallel=1`: passed for 37 projects.
- `@8f4e/examples:test` completed successfully; it found no embedded module tests. Example project compilation is
  covered by `packages/cli/tests/exampleProjectsCompilation.test.ts`.
- Added regression coverage for exactly one `host.memory` import with zero or multiple modules, rejection of
  `#region`, and borrowing supplied test-runner memory without resetting it.
- All 122 programs that compiled in the saved pre-change Wasm baseline retain identical SHA-256 hashes and required
  memory sizes. The initial on-disk build could not compile the float64-math fixture, so that fixture has no byte
  baseline; its current compiler fixture test passes. The converted group initializer also passes.
- Refreshed metadata snapshots and checked the diffs for obsolete fields and intentional fixture-layout changes.
- A fresh base-versus-current-source comparison covered 852 compiler scenarios: 711 successful compilations and
  141 rejected inputs. Wasm bytes, retained metadata, and diagnostics matched after excluding removed memory fields.
  The independent helper/forwarding cleanup retained those results and changed only the defaults-pass snapshot shape.
- Biome and `git diff --check` pass. A final search found no removed memory-identity identifiers or fixture directives
  in active packages; `#region` appears only in the rejection test. The Wasm encoding comment about the mandatory
  zero immediate and legitimate declaration/storage terminology remain.

The local dependency installation was missing the workspace link for `@8f4e/vite-plugin-sources`; running
`npm install --ignore-scripts` restored it without changing manifests or the lockfile. Sequential Nx validation
avoided tests observing dependencies while build output was being replaced.

## Scope and current behavior

The feature is a medium-sized refactor across shared language contracts, compiler passes, WebAssembly generation,
the shared test runner, CLI result metadata, and editor integration. Most changes are mechanical, but pointer facts
and address safety need careful handling.

An initial reference inventory found roughly 70 production/shared helper files, 76 test or fixture files, and more than
100 snapshot files containing related identifiers. These are search counts, not an exact list of files requiring edits.
The broader compiler scan covered 334 production source files and traced relevant readers and writers through the
pipeline. An AST scan checked property accesses and destructuring for suspected unused context fields.

Current source differs from historical descriptions of broad runtime support:

- The compiler supports custom memories through `CompileOptions.memoryRegions` and the module directive `#region`.
- The shared `@8f4e/test-runner` allocates and imports multiple memories using compiled size metadata.
- The audio runtime, worker runtime, compiler worker, and CLI execution path already instantiate only `host.memory`.
- The editor compiler worker allocates one memory, returns one memory reference, and applies live patches through
  typed views of that memory. Its change records still carry unused memory identity fields.
- No multiple-memory configuration or `#region` usage was found in bundled examples or the product website sources.
  The website bundles compiler fixtures, so removal of region-specific fixtures also affects its test gallery.
- Some historical documents and the original compiler PR description claim that extra memories are plumbed through
  all runtimes. The runtime wiring was split into PR 670, which was closed without merging. The merged compiler diff
  and current source are the implementation baseline.

The target behavior is one linear memory per compiled program, imported as `host.memory`. Shared versus non-shared
allocation, memory sizing, typed views, live patching, and separate program instances retain their existing purposes.

## Preservation decision

The user explicitly confirmed that useful functionality should stay. Preserve infrastructure that serves the
single-memory compiler and runtimes, including code introduced alongside the original region feature:

- The shared compilation-context factory and active compiler passes.
- Address/value distinctions, pointer types and depths, pointee counts, address provenance, safe ranges, clamps, and
  runtime bounds checks.
- Module/declaration layout, alignment, numeric declaration references, groups, memory exposures, and initializers.
- Passive data segments, default initialization, bulk memory operations, ordinary instruction encoding, and required
  single-memory zero immediates.
- Shared/non-shared allocation, typed views, editor live updates, and fresh-versus-borrowed test-runner memory behavior.
- General directive parsing, host-function imports, and tests for retained behavior.

Remove memory selection, identity-only metadata, and helpers or plumbing that lose their purpose after that removal.
Adjacent existing dead-state findings remain cleanup candidates only where their lack of useful consumers is verified.
Historical presence in the feature PR is evidence for investigation, not by itself a reason to delete code.

## Original implementation and later changes

The original feature and its encoding prerequisite were checked against their complete changed-file lists and
production diffs. The compiler PR changed 115 files; the instruction-encoding prerequisite changed 26. The comparison
confirms the current removal inventory without identifying an additional live subsystem that needs removal.

| Change | Original PR and status | Commit in GitHub metadata | Equivalent commit in current main history |
| --- | --- | --- | --- |
| Logical memory regions in the compiler | [PR 641](https://github.com/8f4e/8f4e/pull/641), merged 2026-05-20 | `263f78e1e3f6324401d17d76a21331b5ac50d20f` | `1d72e79aa8c72b7c2e480430cf06de53b24a6f8e` |
| Multiple-memory load and store encoding | [PR 669](https://github.com/8f4e/8f4e/pull/669), merged 2026-05-20 | `b87bef5fb5aff86a5d31de2236708d69063deef1` | `e87942426ea6ffd4cb4a8559f7ad0a4501d3eace` |
| Runtime region wiring | [PR 670](https://github.com/8f4e/8f4e/pull/670), closed without merging | No merge commit | No merged counterpart |

For both merged changes, the GitHub commit and the corresponding current-history commit have identical tree contents.
The different object ids should not be mistaken for missing merges. The current-history commits are ancestors of the
audited `HEAD`.

PR 670 was stacked on PR 641. It proposed extra memories for the compiler worker, CLI runner, and browser/audio
runtimes, including routing reads and writes and exposing region memory references. Its branch commits appear in
`git log --all`, but that proposed runtime machinery is not present in the audited main tree. The shared test runner's
current multiple-memory support was assessed separately from this unmerged runtime branch.

Historical areas and their current disposition:

| Area in the original diff | Current disposition and removal boundary |
| --- | --- |
| `packages/compiler-spec/src/` | Now `packages/compiler/packages/language-spec/src/`; the audit covers region syntax, errors, options, address/pointer facts, and result metadata there. |
| `packages/compiler/packages/wasm-utils/src/` | Now under `packages/compiler/packages/wasm-codegen/packages/wasm-utils/src/`; remove memory selection while retaining alignment, offsets, and ordinary encoding utilities. |
| Compiler allocation, defaults, semantic instructions, and bytecode emission | Split into the current planner, resolver, analyzer, and codegen packages. Follow the current owners instead of reverting the old monolithic files. |
| `memoryAccessTarget.ts` and `getAddressMemoryIndex` | Removed in the later stack value/address refactor (`9929daf8f`). Current `requireStackAddress` is the normalization helper whose role becomes redundant after removing memory selection. |
| `createCompilationContext.ts` | Added by PR 641, but now general shared compiler infrastructure under `semantic-utils`. Keep the factory and remove its obsolete memory/context fields. |
| `packages/cli/src/compile/traceInstructionFlow.ts` | Deleted by `f0e99100fbaf51b90cff54667f4152d4643f5faa` on 2026-06-03. There is no remaining trace export path to clean up. |
| Internal resource allocation and initial data candidates | Deleted by `6b98b82ef037916556c68ac8a79225a32e9d4b85` on 2026-06-08. Their original default-memory special cases and tests are already gone. |
| Pointer initializer `defaultAddress` extraction in the old compiler memory parser | That parser was replaced during later defaults/reference-resolution extraction. Current address provenance still supports pointee counts and safety; remove region identity from its current owners. |
| Literal and local push handlers | Memory provenance moved into reference resolution and stack analysis. Current codegen `pushLiteral` and `pushLocal` do not carry region handling, so remove the facts from the analyzer rather than deleting these emitters. |
| Original `tests/memoryRegions.test.ts` and its custom instantiation helper | Replaced by the fixture-program harness and region fixtures. The current fixture comment parsers, helper imports, and snapshots are the relevant cleanup targets. |

[PR 991](https://github.com/8f4e/8f4e/pull/991), merged as
`485f2e8141fb188a2fbac1dc2a2f2e16c33a9757` on 2026-10-08, later moved region resolution and validation into the memory
planner and removed repeated handlers from semantic resolution, stack analysis, and codegen. It also added the repeated
selection/invalid-earlier-directive fixtures and documented `; @memoryRegions`. These current planner and fixture
changes are already included in the removal scope.

Address safety metadata was introduced separately by
[PR 640](https://github.com/8f4e/8f4e/pull/640) before the region feature. The original feature extended that
metadata with memory identity. Preserve the address/safety model and its later pointer typing improvements while
removing those extensions. A direct revert of the original feature commits would also undo shared infrastructure and
would not account for the subsequent package and pass reorganizations.

## Language syntax and public contracts

Primary files:

- `packages/compiler/packages/language-spec/src/options.ts`
- `packages/compiler/packages/language-spec/src/compiled.ts`
- `packages/compiler/packages/language-spec/src/runtime.ts`
- `packages/compiler/packages/language-spec/src/ast.ts`
- `packages/compiler/packages/language-spec/src/instructionSpecs.ts`
- `packages/compiler/packages/language-spec/src/instructions.ts`
- `packages/compiler/packages/language-spec/src/errors.ts`
- `packages/compiler/packages/language-spec/src/compilerError.ts`
- `packages/compiler/packages/sub-program/packages/tokenizer/src/syntax/validateInstructionArguments.ts`

Remove:

- `CompileOptions.memoryRegions` and its propagation through the compiler facade, sub-program planner, and emitter.
- `CompileResult.requiredMemoryBytesByRegion` and copies in CLI compile results and shared CLI types.
- The `#region` instruction specification, `RegionLine`, and its entries in AST unions.
- The `regionReference` source-argument rule and its tokenizer validation case; its only instruction consumer is
  `#region`.
- Region-specific error codes and central message cases: `INVALID_MEMORY_REGION_NAME`,
  `DUPLICATE_MEMORY_REGION_NAME`, `UNKNOWN_MEMORY_REGION`, and `MEMORY_REGION_INDEX_OUT_OF_BOUNDS`.
- The corresponding exports, tests, fixtures, and documentation.

Existing unknown-instruction validation can reject `#region` after its registration is removed. Add focused coverage
for that behavior. General directive placement and prologue handling still serve directives such as `#loopCap`,
`#skipExecution`, `#impure`, `#import`, and `#export`.

## Memory identity helpers and allocation

### Region helper module

Delete `packages/compiler/packages/language-spec/src/memoryRegions.ts` and its barrel export. The whole module exists
for memory identity selection and validation:

- `DEFAULT_MEMORY_INDEX`
- `RESERVED_MEMORY_REGION_NAMES`
- `getDefaultMemoryRegion`
- `getCustomMemoryRegionName`
- `getMemoryRegionFields`
- `getMemoryRegionByIndex`
- `getMemoryRegionByName`
- `validateMemoryRegionOptions`
- `resolveMemoryRegionByIndex`
- `resolveMemoryRegionName`
- Its private synthetic `fallbackLine` diagnostic helper

Update all callers directly. Retaining default-memory objects or constant-zero fields in place of this module would
leave the unnecessary abstraction in the data model.

### Planner

Primary files:

- `packages/compiler/packages/sub-program/packages/memory-planner/src/index.ts`
- `packages/compiler/packages/sub-program/packages/memory-planner/src/declarations.ts`
- `packages/compiler/packages/sub-program/packages/memory-planner/src/modules.ts`
- `packages/compiler/packages/sub-program/packages/memory-planner/src/modules.test.ts`
- `packages/compiler/packages/sub-program/src/compileSubProgram.ts`

Remove `resolveModuleRegion`, the `#region` collection branch, source-module `region` records, and region parameters
threaded through module and declaration layout functions. Remove region option validation and planner input fields.

Replace per-memory module placement with one scalar byte-address cursor. Preserve alphabetical module layout order,
the configured starting word address, alignment, empty allocation behavior, and declaration/source ordering. Memory
layout order remains independent of execution order.

The entire `modules.ts` helper file implements the per-memory cursor abstraction. Its only production caller is the
planner. Its functions `createModuleAddressCursor`, `getNextModuleByteAddress`, and `advanceModuleByteAddress`, together
with `ModuleAddressCursor`, can disappear when the scalar cursor is local to the planner. The dedicated test only
checks independent memory indexes; keep meaningful placement coverage in planner tests.

`MemoryLayoutPlan.nextByteAddressByMemoryIndex` has no production reader. Remove the returned field outright rather
than introducing a scalar replacement unless a real consumer needs one. Update empty-plan constructors and fixtures.

Layout arithmetic, declaration flags, and 64-bit alignment helpers retain their independent roles.

## Shared address and pointer data

Primary files:

- `packages/compiler/packages/language-spec/src/memory.ts`
- `packages/compiler/packages/language-spec/src/semantic.ts`
- `packages/compiler/packages/language-spec/src/memoryData.ts`
- `packages/compiler/packages/language-spec/src/addressValues.ts`
- `packages/compiler/packages/language-spec/src/functionTypes.ts`
- `packages/compiler/packages/sub-program/packages/semantic-utils/src/memoryState.ts`

Remove `MemoryRegionIdentity` and all linear-memory identity fields from planned modules/declarations, address ranges,
address metadata, pointee metadata, scalar/pointer locals, clamp facts, memory-value changes, and compilation contexts:

- `memoryIndex` and `memoryRegionName`
- `pointeeMemoryIndex` and `pointeeMemoryRegionName`
- `currentMemoryIndex` and `currentMemoryRegionName`
- Context `memoryRegions`

Keep byte addresses, allocation sizes, pointee base type, pointer depth, element counts, known values, safe ranges,
clamp ranges, and proven access widths. They support operations within a single memory.

Specific adjacent simplifications:

1. The three-way `PointerMetadata` adapter union in `memoryData.ts` becomes structurally redundant after removing
   memory identity. Collapse it into a smaller shared shape without taking on a broader pointer-model redesign.
2. `MemoryPointerMetadata` retains only `pointeeElementCount`. Narrow the representation and its adapters accordingly;
   avoid creating empty records whose former purpose was carrying memory identity. Preserve the distinction between
   a known count and an unknown count.
3. `getPointerMetadataWithDefinedFields` in `memoryState.ts` becomes a one-field operation and can be simplified or
   inlined with its caller. Its surrounding declaration and count-resolution logic still has consumers.
4. Address construction and pointer arithmetic can stop copying identity through `getMemoryRegionFields`.
5. Some address values will have no range proof after the identity fields disappear. Preserve the distinction between
   an address and an ordinary integer: pointer overload/type checks still use it, and `kindToStackItem` currently
   recognizes an address through the presence of `extras.address`.

Numeric references such as `&module:0` index declarations within a module. In particular,
`IntermodularModuleNthReferenceIdentifier.targetMemoryIndex` is a declaration ordinal, not a WebAssembly memory index.
Keep that language feature and its parser/resolver paths.

## Reference resolution and stack analysis

Primary files:

- `packages/compiler/packages/sub-program/packages/memory-reference-resolver/src/index.ts`
- `packages/compiler/packages/sub-program/packages/memory-reference-resolver/src/resolveMemoryExpressionOperand.ts`
- `packages/compiler/packages/sub-program/packages/memory-reference-resolver/src/evaluateResolvedValueExpression.ts`
- `packages/compiler/packages/sub-program/packages/semantic-reference-resolver/src/index.ts`
- `packages/compiler/packages/sub-program/packages/semantic-utils/src/addressClamp.ts`
- `packages/compiler/packages/sub-program/packages/stack-analyzer/src/analyzeStack.ts`
- `packages/compiler/packages/sub-program/packages/stack-analyzer/src/utils/stackAddressMetadata.ts`
- `packages/compiler/packages/sub-program/packages/stack-analyzer/src/instructionAnalyzers/push.ts`
- `packages/compiler/packages/sub-program/packages/stack-analyzer/src/instructionAnalyzers/pushShape.ts`
- `packages/compiler/packages/sub-program/packages/stack-analyzer/src/instructionAnalyzers/memory.ts`

Remove region facts from pointer default resolution, local/function pointer construction, arithmetic propagation,
module context setup, address clamps, and nth-declaration address resolution. Keep address provenance and element-count
inference needed by `count(*pointer)` and group initializers.

### Local assignment propagation can disappear

`StackAnalysisLocalPointerFact` contains only a binding id and pointee memory identity. Its complete producer/consumer
chain becomes unnecessary:

- Delete `applyLocalSetLine` in stack analysis.
- Remove the special `localSet` case in `applyStackLineEffect`.
- Remove `StackAnalysisLineFacts.localPointer` and `StackAnalysisLocalPointerFact`.
- Remove the `facts` parameter from `applyStackLineEffect`; only that special case reads it.
- Remove codegen's matching local metadata mutation in
  `packages/compiler/packages/wasm-codegen/src/instructionCompilers/localSet.ts`.

The `localSet` instruction and its operand validation remain necessary. Its code generation can emit the local
assignment directly.

### Shape pointers need less propagation

`analyzePushShape` merges memory identity from each produced address into pointer type metadata. Once identity is
removed, assign the remaining pointee type facts directly. Preserve shape expansion, pointer depth/type, allocation
addresses, and safety metadata.

## WebAssembly generation and instruction utilities

### Program emission and initial data

Primary files:

- `packages/compiler/packages/wasm-codegen/src/emitWasmProgram.ts`
- `packages/compiler/packages/wasm-codegen/src/initialMemoryDataSegments/types.ts`
- `packages/compiler/packages/wasm-codegen/src/initialMemoryDataSegments/createMemoryDataSegmentCandidate.ts`
- `packages/compiler/packages/wasm-codegen/src/initialMemoryDataSegments/mergeAdjacentInitialMemoryDataSegments.ts`

Replace `getRequiredMemoryBytesByIndex` and `getRequiredMemoryBytesByRegion` with one total required byte size. Remove
the highest-used-index calculation, allocation of placeholder import entries for index gaps, and construction of
region-dependent import names. Emit one `host.memory` import with the existing page sizing and sharing behavior.

Initialization needs one clear of the required byte range followed by passive data segment loads into that memory.
Keep the order of clearing and loading defaults, the behavior on repeated initialization, and initialization of
implicit zero values. Passive segments and the data-count section remain useful for single-memory programs.

Remove identity from initial segment records and candidates. Segment merging can sort by byte address alone and drop
`segmentMemoryIndex`, `segmentMemoryRegionName`, `memoryChanged`, and all flush/gap branches used only to separate
different memories. Preserve the existing maximum zero-gap merge behavior.

### Operand normalization becomes redundant

`packages/compiler/packages/wasm-codegen/src/instructionCompilers/utils/stackItem.ts` contains only
`requireStackAddress`. It converts integer operands to address records so callers can access `address.memoryIndex`,
and repeats a type check already performed by stack validation.

After memory selection is removed, its five callers (`load`, `loadFloat`, `store`, `storeBytes`, and `memoryCopy`) can
use their consumed operands directly. `isSafeMemoryAccess` and `isSafeMemoryCopy` already accept `StackItem`, and
guarded byte generation does not need a normalized address record. Delete the helper file and its imports while
retaining upstream operand checks and runtime bounds guards.

### Instruction selection and guard options

Primary files:

- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/load.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/loadFloat.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/store.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/storeBytes.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/memoryCopy.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/clampAddress.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/push/shared.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/utils/memoryAccessGuard.ts`

Simplify `loadVariantByteCode` and `loadOpcode`: their memory-index-dependent factories can become fixed instruction
sequences or direct no-argument emitters. Remove memory identity from `PointerLoadStep` and its construction, and from
`getFinalDereferenceLoad` and guarded pointer-load calls.

In `buildPointerDereferenceByteCode`, remove slot/pointee index extraction, property-existence tests on the adapter
union, and fallback-zero logic. The pointer-slot and pointer-value paths still emit different loads and have different
guarding behavior; retain those distinctions and partial/final dereference handling.

Remove memory indexes from guard option types and bounds helper parameters. `GuardedMemoryCopyOptions` can also lose
`memoryCopyByteCode`, because the copy instruction is fixed after removing memory selection. Continue checking both
source and destination ranges and preserve overlapping-copy semantics.

Global clamping uses the single memory's size. Module and inferred-range clamping retain their current bounds.

### Low level encoding

Primary directory: `packages/compiler/packages/wasm-codegen/packages/wasm-utils/src/`.

- Delete `MULTI_MEMORY_MEMARG_FLAG` and the explicit-memory-index branch in `memory/memarg.ts`.
- Remove memory-index arguments from all load and store helpers and their callers.
- Remove memory-index arguments from `memoryCopy`, `memoryFill`, and `memoryInit`.
- Keep the zero immediates required by the single-memory encodings of bulk-memory operations and `memory.size`.
- Keep `memoryInit`'s data-segment index; it has a different role and still needs encoding.
- Remove imports made unused by replacing memory-index encoding, such as `unsignedLEB128` in guard construction.
  The shared unsigned integer encoder remains widely useful.
- Keep `memarg`'s alignment and offset encoding, memory import limit/sharing options, and the single-entry memory
  section helper. Their purposes are independent of selecting multiple memories.

## Runtime and editor integration

### Shared test runner

`packages/test-runner/src/index.ts` currently accepts either a supplied `memories` map or compiled requirements from
which it allocates all regions. It also returns that map.

Use one supplied/allocated `memory` and one memory import. Remove iteration over `requiredMemoryBytesByRegion` and
update returned results and callers. Preserve both lifetime contracts: fresh memory is initialized once before the
test entry; supplied memory is borrowed without initialization or reset.

Update `packages/editor/packages/runtime-test-runner/src/executeTests.ts`, which currently calls the runner with
`memories: { memory }`. Update compiler runner integration tests using `result.memories.memory` and the runner README
and `AGENTS.md`.

### Compiler worker and editor state

Primary files:

- `packages/editor/packages/compiler-worker/src/compileAndUpdateMemory.ts`
- `packages/editor/packages/compiler-worker/src/getMemoryValueChanges.ts`
- `packages/editor/packages/compiler-worker/src/didProgramOrMemoryStructureChange.ts`
- `packages/editor/packages/compiler-worker/src/index.ts`
- `packages/editor/packages/editor-default/src/compiler-callback.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/resolveMemoryIdentifier.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/program-compiler/effect.ts`
- `packages/editor/packages/editor-core/packages/editor-state-types/src/features/program-compiler/types.ts`

Remove region fields from patch records and structure comparisons. The underlying allocation, size-change handling,
memory reinitialization reporting, and integer/float/float64 views remain necessary.

Pointer target resolution currently filters modules by an effective pointee memory index before searching declaration
addresses. Remove that filtering and fallback calculation.

That calculation is the only production reader of `compiler.pointerMetadataByModuleId` in editor state. Once removed,
stop transporting the map through compiler-worker results/messages, editor-default callbacks, editor compilation
results, state types, state updates, default state, and testing helpers. The compiler's internal count facts remain
needed. Removing the entire public compiler metadata output is a separate API choice; it is also used by compiler
snapshot and metadata tests.

Audio and worker `createModule` implementations already import just `host.memory`. Their main work is regression
coverage and updating fixtures affected by shared type changes.

### CLI

Remove region-size fields from:

- `packages/cli/src/compile/compileProject.ts`
- `packages/cli/src/compile/compileProjectModules.ts`
- `packages/cli/src/shared/types.ts`

Update the empty-plan result and compile snapshots. `packages/cli/src/run/runtimeRunner.ts` already allocates and
imports one memory. Declaration names, `module:memory` lookup, and binary-asset target maps identify allocations
within that memory; they are separate features.

## Compiler fixture metadata and tests

The special fixture comment is:

```8f4e
; @memoryRegions sampleMemory displayMemory
```

It is parsed independently in two files:

- `packages/compiler/tests/testUtils.ts`: `memoryRegionsDirective` and `getTestMemoryRegions`, used by direct fixture
  compilation and executable fixture runs.
- `packages/compiler/tests/errors.test.ts`: a duplicate regex/parser used by diagnostic fixtures.

Both pass custom names as compiler options. The compiler itself treats the text as an ordinary comment. The shared
test-runner package receives compiled output and does not parse this directive.

Remove both parsers, option propagation at all call sites, source comments, and the compiler README fixture-config
section. The rest of fixture discovery and execution remains useful.

`createMemoryImports` in `tests/testUtils.ts` has one caller. Replace it with one `createMemory(requiredMemoryBytes)`
allocation in the host imports object. Keep injected host functions, which are exercised by compiler host-import tests.
Remove obsolete region and pointer-identity fields from the custom snapshot serializers as well as production types.

Specific fixtures to address:

- `packages/compiler/tests/memory-regions.test.8f4e`: delete region-only scenarios; retain useful copy/pointer behavior
  elsewhere if it is not already covered.
- `packages/compiler/tests/region-selection.test.8f4e`: remove the region-selection fixture and snapshot.
- `packages/compiler/tests/groups/pointer-initializer-regions.test.8f4e`: convert to a single-memory case preserving
  group initializer, pointee width, and element-count coverage where useful.
- `packages/compiler/tests/errors/memory-regions/`: remove seven obsolete diagnostic fixtures and their snapshots.
- Tokenizer, planner, data-segment merging, encoding, and editor pointer-resolution tests: remove feature-only cases
  and retain broader behavior covered by fixtures that happen to include memory identity.

Delete abandoned snapshot files explicitly. Snapshot regeneration alone may not remove files whose source fixtures
have disappeared. Many remaining snapshots will change only because redundant metadata fields disappear.

## Adjacent compiler state already unused

These findings came from the broader compiler scan. They are adjacent existing cleanup opportunities rather than
behavior required solely by multiple memories.

### Semantic context fields

In `packages/compiler/packages/language-spec/src/semantic.ts`, the following fields have no production property reads
or destructuring consumers in the compiler:

- `currentMemoryIndex`
- `currentMemoryRegionName`
- `currentModuleNextWordOffset`
- `currentModuleWordAlignedSize`

Semantic contexts also carry unused `startingByteAddress` and `memoryDefaults`. Actual reads of a property named
`startingByteAddress` occur in memory-planner input/layout code, whose configuration remains useful. The destructured
`memoryDefaults` variable in the default resolver is also useful; it is distinct from the unread context property.

Remove the unused context fields and their module/function constructors and test overrides. Consequently,
`memoryDefaultsByModuleId` can leave semantic-reference-resolution and stack-analysis inputs: those stages currently
only copy the values into the unread context field. Defaults remain essential to initial data emission and live
memory patching.

`NamespaceBuildContext` has no repository consumers and can be removed. Module and function context types still have
real users; update their inherited/redeclared fields accordingly.

### Redundant namespace summaries

`collectNamespacesFromASTs` in `packages/compiler/packages/sub-program/src/semantic/buildNamespace.ts` creates
`CollectedNamespace` records containing kind, memory identity, byte address, word size, defaults, and pointer metadata.
The only production read of `context.namespace.namespaces` is the pointer-metadata lookup in
`packages/compiler/packages/sub-program/packages/semantic-utils/src/memoryState.ts`.

Replace that lookup with access to the already-owned per-module pointer metadata map. This allows removing the
summary construction, `CollectedNamespace`, `Namespaces`, `Namespace.namespaces`, and their pipeline parameters rather
than maintaining a redundant second table. Preserve pointer count access for cross-module resolution. Function
registration, constant namespaces, and the remaining active namespace state have separate purposes.

### Pointer metadata forwarding

The default resolver currently forwards the pointer metadata produced by the memory-reference resolver. When narrowing
that metadata to count facts, consider consuming the existing reference report directly rather than rebuilding a
parallel map solely for forwarding. This is an additional simplification to evaluate during implementation, not a
reason to remove element-count inference or validation.

## Documentation and related work

Update current guidance and examples in:

- `packages/compiler/README.md`
- `packages/compiler/docs/directives.md`
- `packages/compiler/docs/compiler-design.md`
- `packages/compiler/packages/language-spec/README.md`
- `packages/compiler/packages/sub-program/packages/memory-planner/README.md`
- Resolver/analyzer READMEs whose input/output contracts change
- `packages/test-runner/README.md` and `packages/test-runner/AGENTS.md`

Related active work to reconcile:

- [TODO 430 Nest pointer metadata shape](todos/430-nest-pointer-metadata-shape.md): remove region assumptions; narrowing
  the existing adapters does not require completing the whole redesign.
- [TODO 431 Separate pointer type and provenance facts](todos/431-separate-pointer-type-and-provenance-facts.md): retain
  the type/provenance distinction while removing memory identity.
- [TODO 461 Decouple language spec from Wasm output contracts](todos/461-decouple-language-spec-from-wasm-output-contracts.md):
  logical memory indexes and regions no longer belong in its proposed contracts.
- [TODO 495 Index editor pointer targets by memory and address](todos/495-index-editor-pointer-targets-by-memory-and-address.md):
  indexing by byte address may still be useful, but the outer memory-index key and cross-memory criteria disappear.
  Preserve first-match behavior for duplicate addresses, empty allocations, and changing pointer values.
- [TODO 500 Keep planned memory and its source together](todos/500-keep-planned-memory-and-its-source-together.md):
  overlaps shared planner contracts and fixtures; preserve declaration/source associations during either refactor.
- [TODO 475 Remove dead compiler block state caches](todos/475-remove-dead-compiler-block-state-caches.md): separate
  adjacent context cleanup; its presence does not make active loop/map state part of memory removal.

Update affected descriptions in `docs/todos/_index.md` as appropriate. Historical references include archived
brainstorming note 041 and TODO 403. Preserve their historical meaning rather than rewriting the original feature
design as if it never existed; current documentation should clearly describe the resulting single-memory behavior.

## Implementation sequence

1. Remove syntax/options/diagnostics and narrow shared memory, address, pointer, and result contracts.
2. Simplify layout planning and delete per-memory cursor and region helpers.
3. Update reference-resolution and stack-analysis producers/consumers, including the identity-only local assignment
   chain and shape-pointer propagation. Apply the verified adjacent context/namespace cleanup deliberately.
4. Simplify instruction helpers, guards, pointer dereferences, initial data handling, and final emission.
5. Update the shared test runner, compiler worker, editor result/state transport, CLI results, and test builders.
6. Delete obsolete fixture parsers, feature-only fixtures, snapshots, exports, imports, and docs; preserve mixed-purpose
   coverage through single-memory cases.
7. Run the checks below and review snapshot changes for intentional metadata removal versus unintended behavior changes.

The changes should land as a coordinated refactor. All compiler passes still have useful single-memory work; no
entire pass package was identified for removal.

## Validation and completion criteria

Run focused tests through Nx for `@8f4e/language-spec`, `@8f4e/tokenizer`, `@8f4e/memory-planner`,
`@8f4e/memory-reference-resolver`, `@8f4e/memory-default-resolver`, `@8f4e/semantic-utils`,
`@8f4e/semantic-reference-resolver`, `@8f4e/stack-analyzer`, `@8f4e/compiler-wasm-utils`, `@8f4e/wasm-codegen`,
`@8f4e/compiler`, `@8f4e/test-runner`, and affected editor/runtime/CLI projects. Build dependency packages before
relying on aliases to generated output.

Then run repository typechecks, example tests, and both product builds:

```sh
npx nx run-many --target=typecheck --all
npx nx run @8f4e/examples:test
npx nx run @8f4e/editor-website:build
npx nx run @8f4e/8f4e-website:build
```

Use Biome on changed TypeScript files. Required behavior coverage:

- Exactly one imported memory named `host.memory`, including programs with no declared storage.
- Rejection of removed `#region` syntax.
- Stable layout, alignment, starting-address behavior, and declaration ordering for existing single-memory programs.
- Pointer depths, narrow signed/unsigned loads, float64 loads/stores, pointer locals, and partial dereferences.
- Pointee counts, unknown-count diagnostics, nested groups, exposures, and group pointer initializers.
- Raw integer addresses, safe range propagation, all clamp forms, and out-of-bounds behavior.
- In-memory copies including overlap, zero length, and both source/destination bounds.
- Initial clearing before defaults, sparse/zero defaults, repeated initialization, and passive segment merging.
- Fresh test-runner memory initialized once; supplied memory borrowed without reset.
- Editor live patching, memory recreation, pointer-based widgets, and project/recompile state replacement.
- Existing examples, audio/worker runtime instantiation, CLI execution/capture, and the website test gallery.

Compare existing single-memory execution results and, where practical, generated Wasm bytes. Metadata snapshots should
lose obsolete fields without silently changing memory contents or runtime semantics.

Finish with a repository-wide reference search for removed identifiers and obsolete feature documentation. Check
transitive orphaned code rather than stopping when `memoryRegions` has no matches. Keep legitimate declaration
ordinals, data-segment indexes, allocation names, binary-asset maps, and required zero Wasm immediates.

The audit itself has not validated these proposed edits by compiling or running tests. Implementation must confirm
the static dependency findings through the affected checks.
