# Keyboard Editing Plugin

- Own edit-mode keyboard actions, caret movement and drawing. Use core source and tab geometry. Keep caret
  placement and keyboard bindings in the plugin.
- Load the editing implementation on first entry to edit mode. Buffer only keystrokes in the bridge until it is
  ready. Handle native plain-text paste in the loaded implementation as one edit batch.
