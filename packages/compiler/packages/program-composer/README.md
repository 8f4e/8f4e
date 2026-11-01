# @8f4e/program-composer

Private compiler stage that parses recursive `ProjectObjectModel` trees, isolates group symbols, and produces one
ordered AST program for global allocation and code generation. It consumes the typed `execution` sequence directly,
expanding each group recursively at its declaration position. Later compiler stages receive the flattened module order.

Group names form canonical encoded paths. The root project keeps unqualified symbols, while nested symbols use readable
identities such as `audio/counter` and `audio/voices/counter`; these identities flow unchanged into compiler result maps.
Module-name segments use the language-spec character set `[A-Za-z_][A-Za-z0-9_-]*` and remain unencoded.

This package is internal to `@8f4e/compiler` and is not a second project object model or a public compilation API.

Group `init` lines remain in their owning group's `code`. The composer validates their syntax with the tokenizer and
records `projectMemoryInitializerScopes`, including the group's canonical path and its immediate parent's path. These
scoped records accompany the AST and alias table; memory-aware resolution owns target validation and initialization
facts. Initializer changes are re-read on every composition even when child ASTs are served from cache.
