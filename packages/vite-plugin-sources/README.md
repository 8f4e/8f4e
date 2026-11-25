# @8f4e/vite-plugin-sources

Discover source files and load their exact text on demand in Vite 7. Collections use a typed virtual module with
`ReadonlyMap<string, () => Promise<string>>`. The plugin has no dependency on the 8f4e compiler or standard library.

```sh
npm install --save-dev @8f4e/vite-plugin-sources
```

Register a collection in `vite.config.ts`:

```ts
import { sourceFiles } from '@8f4e/vite-plugin-sources';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sourceFiles({
			name: 'programs',
			root: new URL('./src/programs/', import.meta.url),
			include: ['**/*.8f4e'],
			exclude: ['drafts/**'],
		}),
	],
});
```

Enable virtual-module types with `/// <reference types="@8f4e/vite-plugin-sources/client" />` in a declaration file,
or add `@8f4e/vite-plugin-sources/client` to your TypeScript `compilerOptions.types`.

```ts
import sources from 'virtual:8f4e-sources/programs';

// src/programs/audio/synth.8f4e has the ID audio/synth.
const load = sources.get('audio/synth');
const text = load ? await load() : undefined;
```

Importing the collection loads its IDs and import functions. Each source is a separate lazy module, loaded only when
its function is called. Successful module imports are cached by the JavaScript module loader. Loading failures reject
the returned promise. Unknown IDs have no map entry. The plugin returns text; consumers own parsing and compilation.

## Configuration

| Option | Meaning |
| --- | --- |
| `name` | Unique collection name containing letters, digits, `_`, `.`, or `-`. |
| `root` | Source directory as a filesystem path or file URL. Relative paths resolve against Vite's root. |
| `include` | Glob patterns relative to `root`; defaults to `['**/*.8f4e']`. |
| `exclude` | Glob patterns relative to `root` to omit. |

IDs use `/` separators and remove the final filename extension. For example, `tests/stack.test.8f4e` becomes
`tests/stack.test`. Multiple extensions such as `['**/*.{8f4e,8f4em}']` are supported. Colliding IDs cause a build error
that identifies both files. Matching files must remain inside the configured root. An empty collection is valid.

Collections are independent and may be registered together. Files are sorted for deterministic output. The plugin
uses Vite's built-in `?raw` imports and supports development and build watch: additions and removals refresh the
collection, with a full page reload during development. Existing source edits use Vite's normal module invalidation.
Vite's usual restrictions on watching installed files inside `node_modules` also apply.
The configured source directory is added to Vite's development file allowlist so collections can live outside
the host application directory. Vite's file deny patterns remain in effect.

To discover an installed package, resolve an exported file through Node's package resolution and use its directory
as the root. For example, `dirname(createRequire(import.meta.url).resolve('@8f4e/stdlib/package.json'))` locates
the stdlib package without assuming a `node_modules` location. Set `include: ['std/**/*.8f4e']` to retain its
`std/math/fract` style IDs. The plugin discovers the files directly without a separate source catalog.

## Development

Within the 8f4e workspace, run `npx nx run @8f4e/vite-plugin-sources:build`, `:test`, or `:typecheck`.
The integration tests use synthetic source trees and exercise Vite builds, consuming builds, and watch behavior.

### Default editor integration

The default editor's [Vite configuration](../editor/compositions/editor-default/vite.config.ts) resolves the stdlib and
examples package directories through their exported `package.json` paths. It registers collections matching
`std/**/*.8f4e` and `src/modules/**/*.8f4em`. The [stdlib resolver](../editor/compositions/editor-default/src/stdlib-resolver.ts)
looks up IDs such as `std/math/fract`. The [module catalog](../editor/plugins/example-modules/src/catalog.ts)
derives metadata from paths and maps filename-based slugs to lazy source loaders. Parsing and compilation stay in
the consuming packages. Example/test galleries continue using their existing file URLs.

The plugin's integration tests own file discovery and exact source-text coverage using synthetic source trees. The
editor's [resolver tests](../editor/compositions/editor-default/src/stdlib-resolver.test.ts) verify compilation and execution
with a real stdlib include and handling of unknown IDs. The CLI and compiler test resolvers load exported source files
directly by include ID. Stdlib has no generated manifest or build step.

Build tooling must depend on the plugin package and on the package containing its sources. Nx builds the plugin
before building the default editor; the editor's stdlib and examples dependencies include source changes in its build
inputs and run the example module generators before discovery.
