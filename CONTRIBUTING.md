# Contributing to 8f4e

Thanks for helping improve 8f4e. This repository contains the 8f4e language compiler, browser editor, runtime packages, examples, and supporting tools. The project is organized as an Nx monorepo, so most development tasks should be run through Nx.

## Looking for a Place to Start?

Welcome! Start with the [open good first issues](https://github.com/8f4e/8f4e/labels/good%20first%20issue), which are selected as entry points for new contributors.

Before starting, check the issue's assignees, recent comments, and linked pull requests to avoid duplicating work. If the scope or setup is unclear, ask in the issue; we're happy to help.

The notes in `docs/todos/` provide background on planned work. Use the current GitHub issue for the latest scope and discussion.

## Prerequisites

- Node.js `24.16.0` (see `.nvmrc`); run `nvm use` from the repository root.
- npm `10` or newer.
- Git submodules initialized. `npm install` runs this automatically through the `preinstall` script.

## Getting Started

```bash
nvm use
npm install
npx nx run @8f4e/editor-website:build
npx nx run @8f4e/editor-website:dev
```

The development server runs at <http://localhost:3000>.

If another dev server is already using port `3000`, stop it with:

```bash
npx nx run @8f4e/editor-website:kill-dev
```

## Repository Layout

- `packages/editor/packages/editor-default/src/`: default editor composition.
- `packages/editor/packages/editor-website/src/`: thin browser website entry point.
- `packages/compiler`: core compiler from 8f4e source to WebAssembly.
- `packages/editor`: composed editor, minimal editor core, compiler worker, and runtime packages.
- `packages/examples`: example modules and projects.
- `packages/cli`: command-line compiler tooling.
- `packages/config`: shared workspace configuration.
- `docs/`: language documentation, ADRs, postmortems, and agent guidance.

Use package README files for package-specific context. Some package directories also contain `AGENTS.md` files with extra instructions for automated contributors.

## Development Workflow

Prefer Nx commands over direct tool invocations so dependencies, caching, and target defaults are respected.

```bash
npx nx run @8f4e/editor-website:dev    # build packages in watch mode and start Vite
npx nx run @8f4e/editor-website:build  # type-check and build the default editor website
npx nx run @8f4e/editor-website:serve  # preview the production build
npx nx run-many --target=build --all
npx nx run-many --target=test --all
npx nx run-many --target=typecheck --all
npx nx run-many --target=lint --projects=@8f4e/editor-default,@8f4e/editor-website
npx nx graph
```

When changing package APIs, build the affected package dependencies before relying on aliases such as
`@8f4e/editor-core` from the default composition and `@8f4e/editor-default` from the website.

## Documentation

Update docs when behavior, public APIs, examples, or contributor workflows change. Start with:

- `README.md` for project-level setup and architecture.
- `docs/README.md` for language documentation.
- Package-level README files for package-specific APIs and workflows.

## Commits

Use Conventional Commits:

- `feat(package-name): <summary>` for package-specific features.
- `fix(package-name): <summary>` for package-specific fixes.
- `feat: <summary>` or `fix: <summary>` for root-level or cross-package changes.
- `docs: <summary>` or `docs(scope): <summary>` for documentation-only changes.
- `chore(ci): <summary>` or `chore(tooling): <summary>` for non-release maintenance.

Release semantics are driven by commit type: `fix` creates patch releases, `feat` creates minor releases, and breaking changes create major releases. Do not use `chore(release): ...` for hand-written commits; that scope is reserved for generated release commits.

## Pull Requests

Good pull requests include:

- A concise summary of what changed.
- The rationale for the change.
- Test notes with exact commands run.
- Linked issues when applicable.
- Screenshots or GIFs for editor or UI changes.
- Documentation updates when behavior or APIs change.

Before opening a PR, run the narrowest useful validation for your change. For shared compiler, editor, or runtime changes, prefer type-checking and testing all affected projects through Nx.
