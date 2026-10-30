# Example Modules Plugin

`@8f4e/editor-plugin-example-modules` owns the Add Built-in Module menu, nested categories, source caching,
public-block selection, and dependency insertion. It has no browser dependencies.

```ts
import { createExampleModulesPlugin } from '@8f4e/editor-plugin-example-modules';

const plugin = createExampleModulesPlugin({ sources });
```

`sources` is a `ReadonlyMap<string, () => Promise<string>>`. Keys are module-relative paths without `.8f4em`, such
as `audio/effects/gain`. The final path segment is the module slug; preceding segments form its category. Slugs must
be unique across the catalog. Titles and categories are derived without loading source text. The default editor
supplies this map through `@8f4e/vite-plugin-sources`.

The `./catalog` subpath exports `createModuleCatalog`, and `./public-block` exports the default `extractPublicBlockFromModuleSource` helper. Other consumers, including the WebMCP package's content build, can reuse these pure operations without installing the editor plugin.

Each source is a canonical `8f4e/v1` example file with a public module, function, constants, prototype, or note block marked
with `; @public`. Test-entry modules are excluded from selection, and the public marker is removed before insertion.
The plugin reads `use` dependencies that match catalog slugs and inserts missing blocks to the right, skipping
blocks of the same name and type already in the current project slice. Dependency discovery covers the requested
file's direct dependencies. Core owns ordinary block creation, unique naming, entry assignment, and persistence.
Color scheme presets use named public notes so palette configuration adds no executable modules.

The plugin registers its complete submenu through `menus.registerMenu` and contributes its opening item through
`menus.registerItem`. Editing must be enabled to show the item or insert source. Each installation owns its catalog,
cache, menu registrations, and action listener. Disposal unregisters them and prevents pending loads from inserting
blocks. Failed dependency chunks are reported to the browser console while other dependencies continue loading.

```bash
npx nx run @8f4e/editor-plugin-example-modules:build
npx nx run @8f4e/editor-plugin-example-modules:test
npx nx run @8f4e/editor-plugin-example-modules:typecheck
npx nx run @8f4e/editor-plugin-example-modules:test:screenshot
```
