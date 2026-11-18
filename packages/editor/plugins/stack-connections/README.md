# Stack Connections Plugin

`@8f4e/editor-plugin-stack-connections` draws a box-character path just outside the selected code block's left edge.
The path starts at the first instruction that produced an operand, branches at each additional producer, and ends
at the highlighted instruction. It uses the same immediate producer rows as the stack producer highlights.
Multiple operands from one instruction share a branch.

Install `stackConnectionsPlugin` with the compiler and code-rendering plugins. It draws when line
selection is enabled and the compiler's stack analysis matches the current source. Selection, compiler results,
and settled block layouts refresh the path, including when a layout contribution inserts extra rows. Disposal
removes the drawer, subscriptions, and layout listener.
