# Coordinate grid

`coordinateGridPlugin` draws a small dot and its `x, y` label behind the code blocks every 100 editor grid columns
and 50 rows, including at negative coordinates. It converts grid positions using the current font
cell dimensions and follows the rendered camera, without the extra lag applied to elastic blocks.

Install it through the editor's regular plugin list. It needs no configuration or browser resources. Disposing the
plugin removes its background drawing; it never changes editor state or input behavior.
