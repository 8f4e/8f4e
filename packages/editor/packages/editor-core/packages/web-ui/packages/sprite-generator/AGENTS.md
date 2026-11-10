# Sprite Generator Guidelines

- Generate a color-independent R8 atlas with a fixed grid of CP437 glyphs and one fill cell. Share Unicode
  mapping across fonts and leave missing glyphs blank. Web-ui owns palette application and procedural backgrounds.
- Keep cached atlas pixels immutable. Keep font payloads lazy and register dimensions and imports in
  `src/fonts/catalog.ts`. Generate payloads from the font sources with `generate-fonts`.
- Use local palette fixtures for visual tests. Run `npx nx run @8f4e/sprite-generator:test:screenshot` for
  rendering changes. The owned preview uses port 3102.
