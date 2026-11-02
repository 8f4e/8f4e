# ADR-010: Reuse a Host-Owned Audio Context Across Editor Instances

**Date**: 2026-10-21

**Status**: Accepted

## Context

Browsers restrict starting audible playback until an `AudioContext` has been resumed from a user interaction. The
8f4e website mounts and disposes embedded editor instances as visitors move between projects in the examples and
test galleries. If every editor instance owns and closes its own context, returning to an audio project creates a
new context and requires another explicit Allow action before playback can start.

The permission belongs to the host page's playback session rather than to one transient editor instance. Repeatedly
creating contexts also repeats audio-device setup and worklet-module loading even though the page is still serving
the same interaction.

At the same time, editor-specific audio resources must not be shared accidentally. Each mounted audio runtime has
its own worklet node, compiled program, WebAssembly memory, routing configuration, and optional microphone stream.
Those resources need to be released when their editor is disposed.

## Decision

Hosts may create one page-owned `AudioContext` and pass it to each embedded editor through the
`sharedAudioContext` mount option.

The 8f4e website does this for gallery and standalone editor mounts. The first compatible audio project asks the
user to allow playback and resumes the shared context from that interaction. Later compatible editor instances may
start automatically while that context remains running.

Ownership is explicit:

- The host owns the shared context and decides when to close it.
- An editor runtime borrows the shared context only while it is not closed and its sample rate matches the
  project's requested sample rate.
- Disposing an editor disconnects and terminates that editor's worklet node, stops its microphone tracks, and
  releases its other runtime-specific resources.
- Disposing an editor must not close a borrowed context.
- A runtime that cannot borrow the shared context creates and owns a private context, which it closes during
  disposal.
- Worklet modules may be cached per context and URL, while worklet nodes, program state, and memory remain
  editor-specific.

Future lifecycle fixes may change how worklet nodes are handed off or terminated. They must preserve the distinction
between disposing an editor's audio graph and ending the host page's authorized audio session. In particular, do not
move shared-context creation back into each editor or close the shared context during ordinary project navigation as
a cleanup or simplification.

## Consequences

### Positive

- **One user activation per page session**: After the shared context is allowed and running, compatible audio
  projects can start without repeatedly interrupting navigation with permission dialogs.
- **Stable playback session**: Switching editors does not unnecessarily tear down and recreate the browser's audio
  device connection.
- **Less repeated setup**: Compatible editors reuse the loaded worklet module for the shared context.
- **Clear resource ownership**: The host owns the long-lived context; each editor owns and disposes its short-lived
  audio graph and runtime state.

### Negative

- **More lifecycle coordination**: Editor disposal must reliably terminate the old worklet node without closing the
  shared context.
- **Host responsibility**: Embedders that supply a shared context must eventually close it when the page no longer
  needs audio.
- **Sample-rate limits**: Projects requesting another sample rate cannot borrow the shared context and retain the
  private-context permission flow.
- **Browser state remains relevant**: Sharing does not prevent the browser or operating system from suspending or
  interrupting the context.

## Alternatives Considered

### 1. Create an Audio Context Per Editor Instance

Rejected because every newly mounted audio editor would need to establish a new browser-authorized playback
session. This makes history navigation and gallery browsing repeatedly require user interaction.

### 2. Keep Previous Audio Editors Mounted and Mute Them

Rejected because it retains editor state, worklet processors, memory, microphone resources, and rendering resources
solely to preserve playback permission. The page-level context provides that continuity without keeping old editors
alive.

### 3. Close and Recreate the Shared Context During Project Navigation

Rejected because closing the context discards the authorization and reusable worklet environment that sharing is
intended to preserve. Project navigation should replace editor-owned nodes while leaving the host-owned context
running.

## Implementation

The decision was implemented on 2026-09-07 in commit
`a44d402a1774c6196d5d081c1ed2c67f5f3077a1`, `fix(editor-default): reuse host audio contexts across editors`.
This ADR records the existing architecture and its user-interaction rationale.

The current implementation is reflected in:

- [Shared context owned by the 8f4e website](../../packages/8f4e-website/src/shared-audio-context.ts);
- [Gallery editor lifecycle](../../packages/8f4e-website/src/gallery.ts);
- [Default editor mount option](../../packages/editor/packages/editor-default/src/index.ts);
- [AudioWorklet context borrowing and disposal](../../packages/editor/plugins/audio-runtime/src/runtime.ts);
- [Shared audio context documentation](../shared-editor-audio.md).

## Related Decisions

- [ADR-007: Prefer Off-Main-Thread Runtime Execution](007-prefer-off-main-thread-runtime-execution.md)
