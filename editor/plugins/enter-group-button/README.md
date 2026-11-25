# Enter group button

`enterGroupButtonPlugin` adds a centered **Enter group** button below the first source line of each project group
block. It reserves two display rows without altering project source. The flat face is one character row tall and
centered to the nearest grid column, with a CP437 half-block shadow softened on light palettes. Pressing it hides the
shadow without moving the face or label.

The plugin uses core's settled block layout and captures primary pointer gestures. Releasing inside the button opens
the child project through the existing `openProjectGroup` event; releasing outside or cancelling leaves the view unchanged.
This works with mouse and touch input in both editor modes. Disposal removes input handlers, drawing, and reserved rows.

Install `enterGroupButtonPlugin` from `@8f4e/editor-plugin-enter-group-button` after the code rendering plugin.
The default and gallery compositions load it after the first render.

Run `npx nx run @8f4e/editor-plugin-enter-group-button:build|test|typecheck` and
`npx nx run @8f4e/editor-default:test:screenshot` for composition coverage.
