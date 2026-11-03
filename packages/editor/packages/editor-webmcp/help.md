# Getting started with 8f4e

8f4e is a stack-based programming language with a spatial editor. Programs compile to WebAssembly. It is often used for audio, signal processing, interactive controls, and other programs that run repeatedly.

## How the language works

- Instructions execute in source order. `push` puts a value on the stack; operations such as `add` consume operands and push their result.
- Modules declare persistent memory and executable code. `int`, `float`, and `float64` declare memory values. `push value` reads a value; `push &value` pushes its address. `store` consumes an address followed by a value and writes that value to memory.
- An `entry` contains modules to execute. A runtime selects which entry to invoke and how often. Functions provide callable code; constants and prototypes provide shared declarations.
- Groups organize a nested project scope. `use` declares dependencies, and `expose` publishes group memory. Read the source-syntax and identifier-prefix documentation before wiring blocks together.
- Compiler directives start with `#`, such as `#impure`. They control compilation and have placement rules.
- Editor directives live in comments, such as `; @pos 10 20`, `; @watch count`, and `; @slider &gain 0 1 0.01`. They configure layout and editor features.

This complete project increments a persistent counter whenever its `main` entry runs:

```8f4e
8f4e/v1

entry main
module counter
; @pos 0 0
int count 0
push &count
push count
push 1
add
store
moduleEnd
entryEnd
```

## Finding documentation and examples

Use `search_docs({ query: 'push' })` or search for a concept such as pointers, groups, runtime, or slider. Results provide exact `topic` values for `get_docs({ topic })`, which returns Markdown. An empty query browses the catalog. Useful starting topics are `compiler/source-syntax`, `compiler/prefixes`, `compiler/directives`, and `editor/editor-directives`.

Use `search_examples({ query: 'filter', kind: 'block' })` to find reusable blocks, or `{ query: '', kind: 'project' }` to browse complete projects. Pass a returned `kind` and `path` to `get_example`. Block results list dependency paths: fetch those blocks too when their declarations are absent from your project. Block source is the reusable public block with its library-only `@public` marker removed. Project source is the complete original file, including nested groups. Fetching an example does not open or insert it.

Searches return up to 20 matches with `total` and `nextOffset`. Pass `offset: nextOffset` with the same query and kind to retrieve the next page. Documentation and examples ship with this bridge build.

## Editing the open project

1. Call `get_project` to read the currently expanded group or root. Deeper groups appear as shells. `expand_group`, `go_to_parent`, and `go_to_root` change the same view the user sees; call `get_project` after navigating.
2. Target an existing block by its source type and name in the current scope, for example `{ type: 'module', name: 'counter' }`. `get_block` returns its source. Duplicate names of the same type are ambiguous.
3. Use `patch_block` for one unique literal replacement, `update_block` for a complete source replacement, or `apply_edits` for a batch of inserts, updates, and deletions. Positions come from `; @pos` in the source. Every successful write applies immediately and forms one undo step; `undo` and `redo` operate on that history.
4. The bridge tracks revisions. Fetch live source before the first write. Consecutive bridge writes work without another fetch. If another actor changes the project, re-fetch with `get_project` or `get_block` before retrying. Help, documentation, example, metadata, and navigation reads do not acknowledge live source changes.
5. If `get_compiler_diagnostics` is available, use it after editing. `pending` and `compiling` mean the result is not final; `ready` identifies a completed compilation. Read diagnostics before assuming new code works.
