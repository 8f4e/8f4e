# @8f4e/examples

Example modules and projects used by the editor and tooling. Exports example modules under `modules/` and full projects under `projects/`.

## Contents

- `modules/`: reusable example modules.
- `projects/`: complete example projects.
- `src/benchmarks/bytecode-size/`: benchmark cases for measuring emitted bytecode size.

## Loading Examples

- The default editor discovers `.8f4em` files with `@8f4e/vite-plugin-sources` and derives module titles and categories
  from their paths. Opening the module menu loads only catalog metadata; selecting a module loads its source chunk
  on demand. Module sources ship with each website build.
- The product website bundles project `.8f4e` sources as downloadable assets for its homepage and examples gallery.
  The website gallery owns the project catalog.

The WebMCP bridge also bundles these sources for agent discovery. Start reusable public blocks with a short prose-comment paragraph explaining their purpose, using terms someone might search for (for example, bitcrusher's bit-depth reduction, distortion, and quantization). Project descriptions come from explanatory note blocks. The bridge uses the first paragraph as a short summary and indexes the full descriptive prose; editor directives remain metadata.

## Generated modules

The package build regenerates the deterministic module sources before consumers discover them. The editor compiles
project sources when they are loaded.

The minBLEP lookup table is checked in but deliberately excluded from normal builds and development startup. Its
JavaScript floating-point pipeline can produce different values across platforms, so automatic regeneration creates
unrelated changes in contributor branches. Regenerate it only when intentionally updating the table:

```sh
npx nx run @8f4e/examples:generate-minblep-lut
```

Review the resulting table diff before committing it.
