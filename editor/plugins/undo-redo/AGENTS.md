# Undo/Redo Plugin

- Own the per-installation undo and redo stacks, typing debounce, checkpoint policy and action subscriptions.
- Subscribe to the keyboard editing plugin's undo and redo action events; do not expose history on core or host APIs.
- Use core's detached project snapshots and transaction restoration. Do not write project trees directly or capture view
  state, generated source or renderer data in history.
- Install before initial project loading in editing compositions; no history is recorded without the plugin.
