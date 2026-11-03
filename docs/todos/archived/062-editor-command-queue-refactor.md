---
title: 'TODO: Editor Command Queue Refactor'
priority: Medium
effort: 3-4 days
created: 2025-10-09
issue: https://github.com/8f4e/8f4e/issues/544
status: Cancelled
completed: 2026-06-14
---

# TODO: Editor Command Queue Refactor

## Problem Description

The editor state currently stores host callbacks directly (`state.callbacks`). This makes the state non-serializable, complicates testing, and tightly couples effects to host-provided functions. The approach also obscures side-effects, making it difficult to inspect, replay, or batch operations.

## Proposed Solution

Introduce a command queue riding on the existing event bus. Effects will emit typed command objects describing the requested side-effect, and an external runner (host layer) will execute those commands and report results. This keeps the state pure data, enables logging/replay, and centralizes side-effect handling. Alternatives considered include simple closure-injected services and event-request/response patterns, but the command queue offers better observability and batching.

Events will continue as fire-and-forget notifications, but commands will share the dispatcher infrastructure via a discriminated envelope (e.g., `kind: 'event' | 'command'`). Commands carry IDs and promise resolvers; events remain lightweight broadcasts. This avoids introducing a second bus while keeping semantics distinct. The combined object will be renamed from `EventDispatcher` to a more generic `MessageBus` (or similar) to reflect the unified communication channel.

## Implementation Plan

### Step 1: Define Command Model
- Enumerate all existing callbacks and map them to command types in a new `Command` union module.
- Add payload typing, metadata (e.g., `id`, timestamps), and helper constructors.
- Expected outcome: A single source of truth for editor-issued commands with strong typing.
- Dependencies or prerequisites: None.

### Step 2: Extend Event Bus with Command Bus
- Rename `EventDispatcher` to `MessageBus` (or another generic name) to reflect shared command/event responsibilities.
- Add an `enqueueCommand` API on top of the bus, returning promises for results while preserving existing event dispatch APIs.
- Store pending resolvers keyed by command id, differentiate envelopes by `kind`, and expose subscription hooks for the host runner.
- Expected outcome: Effects can push commands and await results without touching host callbacks, and existing event consumers remain unaffected.
- Dependencies or prerequisites: Step 1.

### Step 3: Wire Command Bus into State Initialization
- Update `init` to accept a command bus in place of `options.callbacks` and pass it into effects.
- Remove callbacks from `State` and `Options`; adjust type definitions accordingly.
- Expected outcome: Editor state is serializable and effects receive the command bus interface.
- Dependencies or prerequisites: Steps 1-2.

### Step 4: Migrate Effects Incrementally
- Replace callback usage in each effect module with the command bus, starting with low-risk flows (export, storage).
- Update tests to assert commands rather than stubbing callbacks.
- Expected outcome: All effects issue commands instead of calling callbacks, with tests covering new behavior.
- Dependencies or prerequisites: Step 3.

### Step 5: Implement Host Runner and Cleanup
- Build a runner in the embedding layer that consumes commands and invokes existing host implementations.
- Ensure errors propagate, add logging/metrics, and remove obsolete callback wiring.
- Expected outcome: Host handles commands end-to-end with equivalent functionality; callbacks removed from codebase.
- Dependencies or prerequisites: Steps 1-4.

## Success Criteria

- [ ] Editor state and snapshots contain no function references.
- [ ] Command queue resolves all former callback-based flows (compile, storage, file IO, runtime).
- [ ] Automated tests cover command emission and runner integration.

## Affected Components

- `packages/editor/src/state` - Types, initialization, and effects will emit commands instead of invoking callbacks.
- `packages/editor/src/events.ts` - Event dispatcher becomes a generic message bus with command capabilities.
- `src/editor.ts` (or embedding entry) - Hosts the command runner and maps commands to host behaviors.

## Risks & Considerations

- **Risk 1**: Missing command coverage could break critical editor actions; mitigate by auditing all callbacks and adding regression tests.
- **Risk 2**: Promise resolution bugs may cause deadlocks; mitigate with timeouts/logging and integration tests.
- **Dependencies**: Existing host callbacks must be refactored into command handlers.
- **Breaking Changes**: Embedding APIs change; host apps must migrate to the new command bus interface.

## Related Items

- **Related**: `todo/033-editor-state-effects-testing.md`, `todo/034-editor-events-testing.md` (command bus improves testability).

## References

- [Command pattern overview](https://en.wikipedia.org/wiki/Command_pattern)
- Internal brainstorming on command queue (conversation 2025-10-09).

## Notes

- Document commands and handler expectations in developer docs after implementation.
- Consider telemetry/logging hooks once the queue is in place.
- Clarify in docs that events remain fire-and-forget notifications while commands expect host handling and responses.
- Coordinate renaming (`EventDispatcher` ➜ `MessageBus`) throughout code and docs to avoid confusion.

## Archive Instructions

When this TODO is completed, move it to the `todo/archived/` folder to keep the main todo directory clean and organized.
