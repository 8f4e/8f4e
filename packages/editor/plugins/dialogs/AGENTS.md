# Dialogs Plugin

- Own dialog layout, wrapping, hit testing and drawing. Core owns dialog content, stack, actions and
  modal input blocking.
- Prepare geometry outside the frame path and draw through `registerModalOverlay`. Use forwarded
  modal presses to request activation of the visible dialog's button.
