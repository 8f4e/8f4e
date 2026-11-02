# Direct intermodular push migration

This audit implements [#1364](https://github.com/8f4e/8f4e/issues/1364), following fixed references from
[#1361](https://github.com/8f4e/8f4e/issues/1361). The baseline is commit
`3c8801780a301ada416530550db9c607c637e0a2`. Direct intermodular operands remain legal; this change does not
change compiler acceptance rules.

## Scope and counting

The inventory covers example projects, benchmark projects, reusable `.8f4em` modules, compiler fixtures,
and source embedded in TypeScript tests, including screenshot tests. Searches covered named and indexed
starts, module bases, memory and module ends, and `count`, `sizeof`, `min`, and `max` queries. TypeScript
string literals, literal arrays, and template strings were inspected as source. The review followed
continuations back to their owning instruction and included inline operands and arithmetic expressions.

Generated copies and build outputs are excluded. Counts are textual operand occurrences, including expected source strings in editor tests. A metadata
expression containing two intermodular queries counts twice. Declaration initializers, project `expose`
and `init` declarations, editor directives, and current-module operands such as `&this:0` are excluded.
For example, a continuation after `float*` initializes a declaration; a continuation after `push` supplies
a pushed operand. Existing mutable pointers and their declaration initializers remain intact.

There were **371 original occurrences in 39 files**. This migration replaces or relocates **318** and
retains **53**, accounted for below. A dedicated compatibility fixture adds **16** intentional occurrences,
so the resulting executable-source/fragment inventory contains **69** direct occurrences. Raw identifier
parser/resolver inputs are accounted for separately because they do not contain source push instructions.
No pushed cross-module dependency was found in reusable `.8f4em` modules or screenshot-test source.

## Example migrations

Indexed formant and BLEP dependencies now use `float&` slots. Grids output resets use `int&` slots. For a
slot, `slot` supplies the target address, `*slot` reads its current contents, and queries such as
`count(*slot)` inspect its target declaration.

`sampleNumberToAddr` and `patternRow` now receive an explicit `int* addressTable` and its element count;
`selectRows` forwards both parameters. Each calling module binds the shared table with an `int&` reference
and supplies `count(*slot)`. The address tables use legal declaration initializers, including indexed
pattern references. Entry zero holds the fallback; subsequent entries correspond directly to sample
numbers or flattened Grids cells. Sparse sample numbers and silence mappings occupy explicit entries.

The helpers select the fallback for out-of-range indices, including negative values and integer overflow,
using an unsigned bounds check. They calculate offsets with `sizeof(*addressTable)`, so no map of numeric
byte offsets encodes the table layout. These tables add 56–132 bytes per sample project and 104 bytes to
Grids, plus one load per lookup.

The `lowerIntentions` fallback to `&samplePack1:` remains a declaration initializer in the table, where
module-base addresses are supported. This does not add module-base support to fixed-reference initializers.
Pattern-order pointers remain mutable because playback advances and resets them.

## Per-file inventory

The line numbers below refer to the baseline commit, before declarations were inserted. Repeated operands
on one line appear once in the line list but each occurrence contributes to the count. Paths link to the
current files. “Boundary blocker” and “callback blocker” are described after the table.

| Source | Baseline lines | Before | Remaining | Resolution |
| --- | --- | ---: | ---: | --- |
| [packages/8f4e-website/src/lazy-plugins.test.ts](../packages/8f4e-website/src/lazy-plugins.test.ts) | 146 | 1 | 1 | Retain host callback writes; callback blocker. |
| [packages/compiler/packages/program-composer/tests/fixtures/intermodule-references.8f4e](../packages/compiler/packages/program-composer/tests/fixtures/intermodule-references.8f4e) | 11 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/packages/sub-program/packages/tokenizer/tests/compileToAST.integration.test.ts](../packages/compiler/packages/sub-program/packages/tokenizer/tests/compileToAST.integration.test.ts) | 32 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/argument-continuation.test.8f4e](../packages/compiler/tests/argument-continuation.test.8f4e) | 50 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/compilerFloat64AllocationBounds.test.ts](../packages/compiler/tests/compilerFloat64AllocationBounds.test.ts) | 26, 28 | 2 | 1 | Fixed start slot; retain the end-address metadata regression. |
| [packages/compiler/tests/errors/modules/overridden-memory.error.8f4e](../packages/compiler/tests/errors/modules/overridden-memory.error.8f4e) | 13 | 1 | 0 | Resolve a fixed slot against overridden memory; retain undeclared-identifier diagnostic. |
| [packages/compiler/tests/execution-entries/entries-and-init.test.8f4e](../packages/compiler/tests/execution-entries/entries-and-init.test.8f4e) | 11, 16, 21, 26 | 4 | 0 | Caller owns fixed slots and passes pointer parameters to the assertion function. |
| [packages/compiler/tests/execution-entries/skip-execution.test.8f4e](../packages/compiler/tests/execution-entries/skip-execution.test.8f4e) | 11, 15 | 2 | 0 | Caller owns fixed slots and passes pointer parameters to the assertion function. |
| [packages/compiler/tests/functions/directives.test.8f4e](../packages/compiler/tests/functions/directives.test.8f4e) | 48 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/groups/local-entries.test.8f4e](../packages/compiler/tests/groups/local-entries.test.8f4e) | 17, 25, 26, 34, 37, 71, 101 | 7 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/groups/memory-exposures.test.8f4e](../packages/compiler/tests/groups/memory-exposures.test.8f4e) | 22 | 2 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/groups/scalar-initializers.test.8f4e](../packages/compiler/tests/groups/scalar-initializers.test.8f4e) | 13 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/groups/templates.test.8f4e](../packages/compiler/tests/groups/templates.test.8f4e) | 77, 80, 83, 84 | 4 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/includes/group-bindings.test.8f4e](../packages/compiler/tests/includes/group-bindings.test.8f4e) | 48, 52 | 2 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/instructions/indexed-reference-slots.test.8f4e](../packages/compiler/tests/instructions/indexed-reference-slots.test.8f4e) | 31 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/instructions/inline-operands.test.8f4e](../packages/compiler/tests/instructions/inline-operands.test.8f4e) | 167 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/instructions/reference-slots.test.8f4e](../packages/compiler/tests/instructions/reference-slots.test.8f4e) | 35, 90, 92 | 3 | 0 | Use explicit operands; move legacy coverage to its dedicated fixture. |
| [packages/compiler/tests/intermodular-references/addresses.test.8f4e](../packages/compiler/tests/intermodular-references/addresses.test.8f4e) | 204, 207, 210, 213 | 4 | 4 | Retain four float64 end-address regressions; boundary blocker. |
| [packages/compiler/tests/modules/module-overrides.test.8f4e](../packages/compiler/tests/modules/module-overrides.test.8f4e) | 30, 36, 39, 63, 66, 81, 92, 108, 112, 116 | 10 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/prototypes/prototype-memory-shapes.test.8f4e](../packages/compiler/tests/prototypes/prototype-memory-shapes.test.8f4e) | 84 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/stdlib/copy-intermodule.test.8f4e](../packages/compiler/tests/stdlib/copy-intermodule.test.8f4e) | 22 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/compiler/tests/testRunner.test.ts](../packages/compiler/tests/testRunner.test.ts) | 203 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/codeBlockCreator/copyPaste.test.ts](../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/codeBlockCreator/copyPaste.test.ts) | 341, 359 | 2 | 0 | Rename a fixed slot initializer; query local slot metadata. |
| [packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/codeBlockCreator/pasteMultipleBlocks.test.ts](../packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/codeBlockCreator/pasteMultipleBlocks.test.ts) | 34, 39, 43, 48, 52, 57, 61, 66, 70, 78, 82, 90, 91, 104, 111 | 22 | 22 | Retain intentional legacy operand-renaming fragments. |
| [packages/editor/plugins/midi-input/src/index.test.ts](../packages/editor/plugins/midi-input/src/index.test.ts) | 27, 30, 33 | 3 | 3 | Retain host callback writes; callback blocker. |
| [packages/examples/src/benchmarks/bytecode-size/hymnToAurora.8f4e](../packages/examples/src/benchmarks/bytecode-size/hymnToAurora.8f4e) | 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 883, 887 | 15 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/benchmarks/bytecode-size/minBLEP.8f4e](../packages/examples/src/benchmarks/bytecode-size/minBLEP.8f4e) | 326 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/examples/src/projects/audio/amigaMods/aftertouch.8f4e](../packages/examples/src/projects/audio/amigaMods/aftertouch.8f4e) | 375, 376, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 402, 1009, 1013 | 30 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/projects/audio/amigaMods/chiller.8f4e](../packages/examples/src/projects/audio/amigaMods/chiller.8f4e) | 479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 495, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 1125, 1129 | 34 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/projects/audio/amigaMods/chronodemon.8f4e](../packages/examples/src/projects/audio/amigaMods/chronodemon.8f4e) | 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530, 531, 532, 533, 534, 535, 1161, 1165 | 34 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/projects/audio/amigaMods/escapeFromSuicide.8f4e](../packages/examples/src/projects/audio/amigaMods/escapeFromSuicide.8f4e) | 479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 495, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 1156, 1160 | 34 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/projects/audio/amigaMods/hymn_to_aurora.8f4e](../packages/examples/src/projects/audio/amigaMods/hymn_to_aurora.8f4e) | 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 687, 691 | 15 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/projects/audio/amigaMods/lowerIntentions.8f4e](../packages/examples/src/projects/audio/amigaMods/lowerIntentions.8f4e) | 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 939, 943 | 19 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/projects/audio/amigaMods/movinShadows.8f4e](../packages/examples/src/projects/audio/amigaMods/movinShadows.8f4e) | 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530, 531, 532, 533, 534, 535, 1150, 1154 | 34 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/projects/audio/amigaMods/pneumatic.8f4e](../packages/examples/src/projects/audio/amigaMods/pneumatic.8f4e) | 466, 467, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477, 478, 479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 495, 496, 497, 1067, 1071 | 34 | 2 | Sample maps take an explicit table; retain two pattern-order boundary operands. |
| [packages/examples/src/projects/audio/formantSynth.8f4e](../packages/examples/src/projects/audio/formantSynth.8f4e) | 214, 218, 247, 251, 323, 327 | 6 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/examples/src/projects/audio/gridsPatterns.8f4e](../packages/examples/src/projects/audio/gridsPatterns.8f4e) | 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 408, 412, 416, 420, 424, 428 | 31 | 0 | Fixed output slots and an explicit pattern-address table. |
| [packages/examples/src/projects/audio/minBLEP.8f4e](../packages/examples/src/projects/audio/minBLEP.8f4e) | 427 | 1 | 0 | Use typed fixed slots and target metadata queries. |
| [packages/examples/src/projects/midi/midiIn.8f4e](../packages/examples/src/projects/midi/midiIn.8f4e) | 61, 65, 70, 74 | 4 | 4 | Retain host callback writes; callback blocker. |

## Remaining language support

### Module-base and end addresses: 18 example occurrences

Every `amigaMods/*.8f4e` project and the `bytecode-size/hymnToAurora.8f4e` benchmark retain the
`patternOrder:&` / `&patternOrder:` pair in the pattern-order reader. Those operands clamp and reset a
moving playback pointer across the complete module allocation. Fixed references currently accept named
or indexed memory starts, not complete module boundaries. Before removing direct pushes, provide an
explicit fixed dependency for module bounds or another supported way to pass these bounds while
preserving their range metadata. Do not replace the live playback pointer with a fixed slot.

### End-address regression coverage: 5 compiler occurrences

`intermodular-references/addresses.test.8f4e` retains four float64 end-address reads that verify alignment
and the final four-byte word. `compilerFloat64AllocationBounds.test.ts` now binds its start through a fixed slot and retains the
direct end operand. It compares the produced stack items' `memory-start` and `memory-end` ranges with identical allocation layouts. Converting the end to arithmetic
on a start slot would discard the exact end-range metadata under test. When the language supports an
explicit end dependency, migrate these tests; retain direct forms as rejection tests when removal lands.

### Host MIDI callbacks: 8 occurrences

`midiIn.8f4e` retains four writes in `onMidiEvent`; the MIDI plugin fixture retains three writes in
`onMidi`; the website lazy-plugin fixture retains one. The host supplies the fixed MIDI value arguments,
and functions cannot declare module-owned fixed slots. An extra destination pointer would change that
host contract. These need an explicit callback-environment binding or another language/runtime mechanism
that makes the destination dependency available without changing the MIDI argument ABI. Existing callback
execution assertions remain in place. This limitation does not apply to ordinary functions: entry-test
assertion functions and example lookup helpers now take explicit dependency parameters.

## Deliberate compatibility tests and removal follow-up

- `intermodular-references/legacy-direct-pushes.test.8f4e` is the dedicated acceptance fixture for named
  and indexed starts, module bases and ends, memory ends, inline operands, address arithmetic, pushed
  continuation lines, and all four metadata queries, including expressions and continued expressions.
  Convert each form to a compiler rejection fixture when direct pushes are removed. Keep the modern
  equivalents in `instructions/reference-slots.test.8f4e` as successful execution tests.
- `pasteMultipleBlocks.test.ts` retains 22 direct occurrences across input and expected strings. These
  deliberately test renaming current-language projects, including multiple operands and partial-name
  matching. On removal, keep a narrowly named legacy-import test if old source remains supported by the
  editor; otherwise migrate these fragments to fixed declarations. Compiler rejection coverage belongs
  in the compiler fixtures, not these string-renaming tests. The ordinary paste integration test already
  uses a fixed declaration and `count(*source)`.
- Tokenizer classifier/extractor tests and `syntax/parseArgument.test.ts` intentionally accept the raw
  direct-reference spellings. `resolveLineReferences.test.ts`, memory-reference-resolver `index.test.ts`,
  `metadataQuery.test.ts`, and its integration fixtures inspect classified/resolved reference objects.
  Keep these stage-specific inputs while the feature is legal. When removal lands, move rejection checks
  to the phase that owns the restriction and remove only acceptance cases made unreachable by that phase.
  Metadata used by declaration defaults remains supported and must retain its coverage.
- Program-composer and tokenizer integration fixtures now use fixed declarations. Identifier strings in
  source-scope/exposure tests, memory-default tests, and declaration validation tests remain declaration
  coverage rather than pushed operands. Editor directive tests remain address-configuration coverage.

## Validation

- Nx compiler tests: 478 passed, including native assertions and refreshed compile/diagnostic snapshots.
- Nx program-composer tests: 10 passed; tokenizer tests: 589 passed; affected snapshots refreshed.
- Nx examples target: passed, including all 54 CLI tests. The module test runner currently reports
  “No tests found” for the reusable `.8f4em` catalog; it is not counted as additional executed assertions.
- `exampleAddressDependencies.test.ts` executes every sample map key, unmapped/default cases, every Grids
  cell, representative step offsets, invalid cells, and integer bounds against the shipped helpers and memory plans.
  Existing Grids clock scheduling assertions still verify runtime pulses and pointer changes.
- Nx editor-state tests: 698 passed; MIDI-input tests: 20 passed.
- Browser homepage/gallery suite: all 19 tests passed against the existing screenshot reference.
- Nx type checks for compiler, CLI, tokenizer, program-composer, editor-state, and MIDI-input: passed.
- Biome checks and `git diff --check`: passed.
