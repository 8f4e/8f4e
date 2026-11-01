# @8f4e/compiler

Core compiler that transforms an 8f4e project into WebAssembly plus runtime metadata.

## Quickstart

After completing the [repository setup](../../CONTRIBUTING.md#getting-started), build the compiler and its dependencies
from the repository root. `@8f4e/compiler` is a workspace package in this checkout.

```sh
npx nx run @8f4e/compiler:build
```

Save the following as `quickstart.mjs` in the repository root:

```js
import { compileProject, parseProjectSource } from '@8f4e/compiler';

const project = parseProjectSource(`8f4e/v1
entry main
module counter
int value 41
push &value
push value
push 1
add
store
moduleEnd
entryEnd

function double
#export
param int value
push value
push 2
mul
functionEnd int
`);

const firstResult = await compileProject(project, { disableSharedMemory: true });
const pages = Math.max(1, Math.ceil(firstResult.requiredMemoryBytes / 65536));
const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
const { instance } = await WebAssembly.instantiate(new Uint8Array(firstResult.codeBuffer), {
	host: { memory },
});

instance.exports.initDefaults();
instance.exports.main();

const valueAddress = firstResult.memoryPlan.modules.counter.memory.value.byteAddress;
console.log(new DataView(memory.buffer).getInt32(valueAddress, true)); // 42
console.log(instance.exports.double(21)); // 42

const secondResult = await compileProject(project, {
	disableSharedMemory: true,
	cache: firstResult.cache,
});
```

Run it with `node quickstart.mjs`; it prints `42` twice. `requiredMemoryBytes` determines the number of 64 KiB
WebAssembly pages to allocate. Call `initDefaults()` before invoking entries so declared defaults, such as `41`, are
present. The `byteAddress` field is measured in bytes, and the `true` argument to `getInt32` selects little-endian reads.

The example uses non-shared memory, so both compilations set `disableSharedMemory: true`. The compiler enables shared
memory by default; hosts using that mode must supply matching memory created with `shared: true` and a maximum.

The second compilation reuses the returned cache. It produces a new compilation result; to execute it, instantiate
`secondResult.codeBuffer` with suitable memory and initialize that instance's defaults too.

Next, see [standard-library includes](docs/standard-library.md#include-syntax) and supply `resolveInclude` to load their
source text. For executable assertions, see the [testing instructions](docs/instructions/testing.md) and
[@8f4e/test-runner](../test-runner/README.md). The [compiler design](docs/compiler-design.md) describes the pipeline in
more detail.

## Compilation boundaries

```text
.8f4e text -> parseProjectSource --\
                                    ProjectObjectModel
editor state ---------------------/         |
                                             v
                                      compileProject
                                             |
                                             v
  program-composer (recursive traversal, parsing, symbol isolation, declaration-ordered module/group expansion)
                                             |
                                             v
  private global compiler stages
  -> WebAssembly emission
  -> CompileResult
```

`parseProjectSource(source)` converts the textual `.8f4e` representation to the compiler-owned `ProjectObjectModel`.
`compileProject(project, options)` compiles that object model directly. Editors that already hold typed blocks can skip
the text representation without invoking a second block-classification or whole-project preparation step.

`ProjectObjectModel` is defined by `@8f4e/language-spec`. Each scope owns an `entries` name table (including empty entries)
and one `execution` sequence containing
`type: 'module'` and `type: 'group'` nodes, each with an id and entry membership. Modules and groups share declaration
order. The separate `functions`, `constants`, `prototypes`, `includes`, `notes`, and `unknown` collections retain
hoisted declarations and non-executable blocks. `getProjectModules(project)` and `getProjectGroups(project)` select
only direct children of the corresponding type, retaining their relative order.

The composer walks `execution` in order and builds a dispatcher plan for every local entry. At a group node, the
child's `main`, when present, is called from the node's parent entry; the child's `init`, when present, is called from
the parent's `init`. Other child entries run only through explicit local calls. Missing `main` is valid and contributes
no automatic work. Root entries are host exports; child entries have scoped identities. Empty entries remain valid.

For example, with `voiceA` and `voiceB` in `synth`'s `main`, `rootA`, `synth`, `rootB` executes as
`rootA -> synth/voiceA -> synth/voiceB -> rootB`. Functions, constants, and prototypes remain hoisted, and memory
references do not reorder execution. The editor creates this ordered model from spatial position at each scope.

Composition qualifies nested module, function, constant-namespace, and prototype names so sibling groups may reuse
source-level names safely. It hands one flattened validated-AST program to the compiler, allowing memory addresses,
function indexes and type indexes to be planned once. Resolved entry plans pass through semantic compilation to
emission without reconstructing project scopes. Each composed module carries its canonical `executionEntryName`,
which code generation forwards to the compiled module result. Project parsing establishes structure and parsed group
metadata; composition consumes those typed nodes directly. Module/function syntax is parsed at its own tokenizer
boundary. Later stages trust these outputs and consume the established order without reclassifying source blocks or
reconstructing group structure.

Groups can make a parent constants-block namespace available locally with `pass <namespace>`. The pass is explicit at
every parent-to-child boundary and preserves the local namespace name; each consuming block still imports it with the
ordinary `use <namespace>` instruction. The compiler resolves passes as qualified namespace aliases, so it does not
copy constants or inject declarations into block ASTs.

Groups may publish direct-module memory items to their enclosing project with
`expose <name> &<module>:<memory>`. Exposures are symbolic aliases: references such as `&audio:level` resolve through
the alias table to the backing declaration, so aliases allocate no memory and source references remain unchanged.
Group names and exposure target-module names follow the source module-name rules so canonical paths remain referenceable.
Each exposure inherits its backing declaration's type. `CompileResult.projectMemoryExposuresByGroupPath`
retains each resolved exposure together with its backing `PlannedMemoryDeclaration` for editors and other hosts.

Inside a group, `init &<exposed-memory> <number>` overrides a scalar declaration's default without changing its source.
An address value, as in `init &input &source:output`, resolves against the immediate parent project. Initializers share
ordinary default conversion and `initDefaults()` timing, including for inherited scalar declarations.

## Public API quickstart

The following example completes the whole lifecycle with only the public `@8f4e/compiler` entry point. It parses a
self-contained `8f4e/v1` document, so no editor state, include resolver, or project file is required.

```js
import { compileProject, parseProjectSource } from '@8f4e/compiler';

const source = `8f4e/v1

function double
#export
param int value
push value
push value
add
functionEnd int

entry main
module counter
int value 41
push &value
push value
push 1
add
store
moduleEnd
entryEnd`;

const project = parseProjectSource(source);
const result = await compileProject(project, { disableSharedMemory: true });

const pages = Math.max(1, Math.ceil(result.requiredMemoryBytes / 65536));
const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
const { instance } = await WebAssembly.instantiate(result.codeBuffer, { host: { memory } });

instance.exports.initDefaults();
instance.exports.main();

const address = result.memoryPlan.modules.counter.memory.value.byteAddress;
const counter = new DataView(memory.buffer).getInt32(address, true); // 42
const doubled = instance.exports.double(21); // 42
```

Four details make the example work:

- `initDefaults()` writes declaration defaults into linear memory. Call it before invoking any entry, otherwise
  `counter` reads the allocation's initial zeroes instead of `41`.
- `result.requiredMemoryBytes` is the exact byte count the program needs. WebAssembly memory is sized in pages of
  `65536` bytes, so the page count is that value rounded up, with a floor of one page.
- `result.memoryPlan.modules.counter.memory.value.byteAddress` is the byte address of a declaration. Hosts read it
  from their own view of `memory.buffer`; 8f4e stores integers little-endian, so pass `true` to `getInt32`.
- `#export` publishes the `double` function under its source name, which becomes `instance.exports.double`.

`disableSharedMemory: true` matches the non-shared `WebAssembly.Memory` created above. The compiler enables shared
memory by default, so hosts that want the default must supply shared memory instead of passing this option.

Recompiling the same project reuses the returned cache. Pass it back through the `cache` option; there is no need to
construct stage inputs or cache internals yourself.

```js
const recompiled = await compileProject(project, {
	disableSharedMemory: true,
	cache: result.cache,
});

recompiled.cache.ast.stats.hits; // 2: the module and the function ASTs were reused
```

From here, [`docs/source-syntax.md`](docs/source-syntax.md) covers the document format,
[`docs/directives.md`](docs/directives.md) covers directives such as `#export`, and
[`docs/instructions/testing.md`](docs/instructions/testing.md) covers native assertions. Projects that pull in shared
code pass a `resolveInclude` callback to `compileProject`, and [`docs/standard-library.md`](docs/standard-library.md)
lists the helpers those includes provide.

## Compiler Passes

```text
composed, validated ASTs
  -> check module identities
  -> resolve constants
  -> plan module/declaration addresses in one memory
  -> resolve memory references, pointer element counts, and defaults
  -> register functions and resolve semantic references
  -> analyze stacks and plan assertions/functions
  -> emit module/function bytecode and passive initialization segments
  -> assemble WebAssembly and runtime metadata
```

Module execution retains the composer-provided order; memory layout allocates modules alphabetically by id.
Semantic resolution and stack analysis consume the authoritative memory plan and pointer counts directly. Codegen
consumes resolved bodies and stack reports without replaying source declarations.

## Runtime memory

Compiled programs import one WebAssembly linear memory as `host.memory`. All module declarations share this address
space. The memory planner lays modules out alphabetically by id, while module execution follows the composer-provided
order. `CompileResult.requiredMemoryBytes` reports the allocation size, and `initDefaults()` initializes that memory.

Layout addresses and counts use fixed 4-byte allocation units. Typed element widths remain independent of that grid:
one `float64` occupies two units, while four `int8[]` elements fit in one unit. See
[allocation units and API migration](docs/allocation-units.md) for the layout fields and renamed public APIs.
