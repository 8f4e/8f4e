# Context Menu Presentation

- Own formatted labels, geometry, hover, hit testing and drawing. Core owns raw items, navigation and
  dispatch.
- Prepare layout outside the frame path. Draw through `registerContextMenuOverlay` and use forwarded
  context-menu pointer events to request activation or closure.
