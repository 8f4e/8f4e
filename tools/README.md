# Repository tools

Shared workspace infrastructure and standalone development utilities live here, separately from the
[application entry points](../apps/).

## Workspace packages

- [config](config/README.md): shared TypeScript, Vite and Vitest configuration.
- [test-runner](test-runner/README.md): shared assertion execution and source reporting for the compiler, CLI and editor.
- [vite-plugin-sources](vite-plugin-sources/README.md): discover and lazily load source collections in Vite.

## Development utilities

- [dx7-to-8f4e](dx7-to-8f4e/README.md): convert DX7 SysEx patches into movable 8f4e constants blocks.
- [project-preview](project-preview/README.md): generate project preview images with the editor renderer.
- [Release tooling](../docs/releasing.md): prepare and validate repository releases.

The [runtime command generator](../apps/runtime-command/README.md) is an Nx application alongside the native runtimes in `apps/`.
