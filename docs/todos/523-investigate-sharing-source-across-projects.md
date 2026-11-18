---
title: 'TODO: Investigate sharing source across projects'
priority: Medium
effort: TBD
created: 2026-11-18
issue: null
status: Open
completed: null
---

# TODO: Investigate sharing source across projects

## Problem Description

People who maintain several 8f4e projects need a way to share their own source files. The CLI and editor ship an
`include` workflow for exported standard-library functions, and group templates support reuse within a project.
Project authors currently copy shared functions and templates between project files, so changes can drift.

Two pairs of examples exercise different kinds of reuse.

- Self-playing Piano and Felt Piano One Shot carry the same `oneShotSampler` template. Each project supplies its
  own note events. [Self-playing Piano](../../packages/examples/src/projects/audio/selfPlayingPiano.8f4e) ·
  [Felt Piano One Shot](../../packages/examples/src/projects/midi/feltPianoOneShot.8f4e)
- The single- and double-buffered Mandelbrot examples share escape calculation, drawing, and coloring functions.
  Each example manages its own display buffer. [Single-buffered Mandelbrot](../../packages/examples/src/projects/visuals/mandelbrotZoomSingleBuffered.8f4e) ·
  [Double-buffered Mandelbrot](../../packages/examples/src/projects/visuals/mandelbrotZoomDoubleBuffered.8f4e)

## Proposed Investigation

Compare extending the existing include resolver to load user-owned files with a separate project dependency
or packaging workflow. Use the two example pairs to evaluate which units can be shared, how they receive
project-specific inputs, and whether one mechanism serves both functions and group templates.

## Investigation Plan

1. Trace how the CLI and browser editor find source today. Identify what each can resolve for a project opened
   from a local folder, a URL, or a downloaded project file.
2. Sketch how each candidate would resolve a source reference, expose names, and report missing files, cycles,
   or conflicting definitions. Consider how shared source would appear during editing, saving, and export.
3. Record a recommendation and a small first implementation scope. Use the piano and Mandelbrot examples to
   show how the proposed workflow would reduce duplication.

## Success Criteria

- [ ] The design describes how users can maintain shared source separately from the bundled standard library.
- [ ] The recommendation accounts for shared functions and larger definitions such as group templates.
- [ ] The design explains how the CLI and editor open, diagnose, and share projects that depend on other files.
- [ ] Syntax and implementation choices are documented when the investigation reaches a recommendation.

## Affected Components

- Compiler and project preparser for source resolution, symbol scope, and diagnostics.
- CLI and editor for locating dependencies and preserving projects when users save, export, or share them.
- Example projects for exercising both levels of reuse.

## Risks & Considerations

The location of a shared file can affect whether a project works after it is moved or downloaded. Compare
how the candidate workflows handle portability and how diagnostics point to both the source reference and
the resolved definition.

## Related Items and References

- [Standard-library includes](../../packages/compiler/docs/standard-library.md#include-syntax)
- [Group-scoped source templates](archived/519-add-group-scoped-source-templates.md)

## Archive Instructions

When the investigation is complete, record the recommendation, mark the todo completed, and move it and its
index entry to the completed sections.
