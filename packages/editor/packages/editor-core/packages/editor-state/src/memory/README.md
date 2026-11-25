# Memory lookup and access

Memory references use the `MemoryScope` type exported through `@8f4e/editor-state/memory`. A module scope
(`{ kind: 'module', moduleId }`) resolves unqualified names in that module's allocated declarations and fixed references. A project scope
(`{ kind: 'project', groupPath }`) resolves unqualified names in the group's exposed aliases; the root project uses
the empty group path. Qualified names resolve relative to the scope's project path, while paths containing `/` are
canonical. Local module declarations and group exposures remain distinct even when a module and group share a name.

Widgets, connectors, and other code-block consumers use `getCodeBlockMemoryScope` to convert graphical blocks at the
editor boundary, using the settled child-level path for a group. Configuration and renderer consumers construct scopes from their known project paths or canonical
module IDs. `resolveMemoryTarget` handles target lookup using these explicit scopes, and `resolveMemoryIdentifier`
adds address operators, dereferencing, and indexing. The watch plugin owns binary/hex formatting prefixes and
end-address display syntax. The resolvers accept no graphical blocks or implicit string scopes.

Fixed references such as `float& buffer &source:samples` resolve to the backing declaration and its owning module,
with the original reference metadata retained in `ResolvedMemoryTarget.reference`. A bare `buffer` supplies the
fixed target address; `*buffer` reads the target value, and `*buffer[1]` selects its second element. `&buffer` is
unresolved because a fixed reference allocates no addressable slot. Buffer displays derive their sample format and
`count(buffer)` from the backing declaration; live count arguments read its current value.

Consumers prepare names once with `prepareMemoryAccess`. Its `PreparedMemoryAccess` retains the resolved declaration
and parsed address/dereference/index options without reading runtime memory. `prepareAddressBinding` turns an address
source into a fixed byte address or a plan for up to two pointer loads. `readByteAddress` reads the current
32-bit pointer words using that plan.

`prepareNumericRead` describes scalar storage or an explicit dereference. Each `*` follows one allocated pointer.
For a fixed reference, the first `*` selects the bound declaration, and additional dereferences follow its live
pointers. For example, `**doublePointer` follows two live pointers, while `**fixedPointer` follows one pointer stored
in the bound slot. The declaration determines the resulting type and supported depth.
`prepareAddressedRead` describes samples at an address source, following a typed pointer implicitly or both pointer
levels for `*doublePointer`. Both produce `PreparedNumericRead`, which holds the typed-view kind, element byte size,
default display bounds, and a fixed typed-element index or live address binding. `readNumericValue`
reads current structural numeric views; `readElementIndex` supplies the index for buffer drawing loops. These helpers
depend on no renderer and retain no runtime views. Plugins keep radix, precision, text, colors, and overload behavior.

Offsets are normalized during preparation: `&samples[1]` advances by one stored element, `pointers[1]` selects the
second 32-bit pointer slot, and `*pointer[1]` advances by one pointee element after reading the live pointer. Byte
addresses, allocation-unit pointer indices, and typed-element indices remain distinct fields.

`prepareBuffer` combines source, sample type, and `prepareElementCount` for wave, bars, and plot. Counts can be literal,
`count(declaration)` metadata, or a live typed read; `readElementCount` returns the current count. The buffer retains
the source's public identity and backing module/declaration. Source/compiler invalidation refreshes prepared bindings
through each plugin's existing lifecycle. Watch end-address displays reuse the memory-plan address index and
`readDeclarationEndAddress` for live target boundaries.

One-off metadata consumers can still use `resolveMemoryAccess` or `resolveMemoryIdentifier`. Their `ResolvedMemoryAccess`
result includes storage and access flags plus the original source target; frame readers use the prepared primitives.

Memory controls use `resolveMemoryAddress` to accept either an explicit allocated address (`&samples`) or a bare
fixed reference (`buffer`). It rejects ordinary memory values and runtime pointers without an address operator.
Directive arguments use `isMemoryTarget` for control targets and `isPointerSource` for display sources. Pointer
sources additionally accept `*address` to follow a double pointer; controls use declaration addresses and references.
`getMemoryTargetAtSourceLine` resolves inline allocated or fixed declarations, including anonymous allocated memory.
It returns `undefined` for rows without a memory declaration and `{ target: undefined }` for declarations awaiting
matching accepted compiler metadata, allowing widgets to reserve layout space while compilation is pending.
`resolveMemoryAccess` applies the same address and dereference rules to those targets. Tooltips use the shared target
lookup during preparation. Connectors consume the resolved reference targets already supplied by the compiler;
each plugin retains its own value formatting and source-row geometry.
