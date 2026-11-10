# Code Rendering Plugin

- Own code/note text, syntax highlights, nested block backgrounds, line numbers and selected-line fill.
  Editor-state owns source/display geometry and hit testing. Web-ui owns generic sprite drawing.
- Prepare private cells and rectangles outside the frame loop for the settled blocks in
  `codeBlockLayoutsChanged`. Draw highlights and selected-line fill below text in the same block drawer.
