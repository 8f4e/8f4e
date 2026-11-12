# Stack producers plugin

`@8f4e/editor-plugin-stack-producers` highlights the lines that immediately produced the selected instruction's
stack operands. It uses a secondary background color while the selected instruction keeps its primary highlight.

```ts
import { stackProducersPlugin } from '@8f4e/editor-plugin-stack-producers';
```

Install it with the compiler and code-rendering plugins. It can be installed lazily after the first render;
the default, gallery, and landing compositions load it alongside tooltips. Without compiler analysis or
code rendering, it draws nothing. It requires no browser resources or injected host dependencies.

The compiler's source-level `consumedOperandProducerLines` identifies one producer per consumed operand.
Only immediate producers are highlighted: conditional results point to `ifEnd`, block results to `blockEnd`,
call results to `call`, and local or memory reads to the instruction that pushes or loads the value.
Multiple operands from the same source line share one highlight. Inline operands remain part of their source
instruction and do not produce a highlight on that same instruction.

Each installation owns its prepared rows. Selection, accepted compiler metadata, compiler input revisions, and
settled block layouts refresh those rows outside the frame loop. Source/display mappings and contributed gaps
supply their positions. Missing or outdated compilation results, disabled blocks, and disabled line selection
suppress the highlights. The shared editor-state `getCurrentCompiledLineForCodeBlock` accessor checks accepted
input revisions and source snapshots, and maps unchanged instructions across blank/comment-only edits. Inserting
a favorite or moving a block preserves highlights without recompilation. Changed instruction text suppresses
highlights until matching source is restored or recompiled. The plugin observes accepted results and settled
layouts; core publishes a settled layout after source changes, so no separate source-change listener is needed.

The plugin registers a generic text-background drawer. Code rendering invokes it above nested block shading
and below the selected-line fill and source text, regardless of plugin installation order. Disposal removes
all subscriptions, event listeners, and the drawer.

Run `npx nx run @8f4e/editor-plugin-stack-producers:test|typecheck` for tests against core services and a draw mock,
using real compiler reports. Combined rendering and screenshot coverage lives in
`npx nx run @8f4e/editor-default:test:screenshot`.
