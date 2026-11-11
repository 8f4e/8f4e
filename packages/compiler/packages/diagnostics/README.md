# @8f4e/compiler-diagnostics

Shared construction and transport of compiler diagnostics. Diagnostic types, source identities and semantic codes
belong to `@8f4e/language-spec`; this package owns `CompilerError`, semantic wording and source-error factories.
It depends on language-spec and does not depend on the tokenizer or compiler pipeline.

`getError(code, line, options?)` creates a semantic `CompilerError`. The line requires `diagnosticSource`
and a zero-based `lineNumber`. Options contain only `symbol`, stack item kinds/types, and message `details`;
they never supply or repair source ownership. Compiler passes preserve source ownership when copying or substituting lines.

`syntaxErrorAt(code, message, source, line)` constructs a syntax error at an explicitly supplied source position.
Pure syntax helpers return failure data for their caller to locate. Expected source errors use the single
`CompilerError` type, whose `diagnostic` carries the explicit domain and required location.

`includeErrorAt(code, message, location)` constructs an include diagnostic using a named `IncludeErrorCode` and
a zero-based location. Include wording contains no row prefix; hosts present source coordinates from the location.

`serializeDiagnostic(error, stage, location?)` returns a detached serializable record. A `CompilerError` keeps its
complete diagnostic through worker and include transports. Unexpected exceptions become explicit internal failures,
retaining the stage, stack and any known source location. There are no empty-context or fabricated-row defaults.

Locations distinguish document rows, block rows, project-scope rows, include-file rows, and included symbols with their
include site. Exposure declarations retain their row in the owning group's `code`; composition supplies the group's
scope identity before target validation. Hosts translate that complete scope location directly into editor errors.
Early include validation uses `include-file` with the file id and a row
relative to that file. Its `includeSite` identifies the loading declaration when the file belongs to a project;
standalone include parsing still retains file identity. Diagnostics inside an included symbol use a row relative to
that symbol. Hosts can navigate source diagnostics and present internal or unmappable failures persistently.
Inherited memory declarations retain their original source line and a separate `shapeLine` for module layout.

Run the package's Nx `build`, `test` and `typecheck` targets from the repository root.
