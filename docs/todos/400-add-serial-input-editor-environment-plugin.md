---
title: 'TODO: Add serial input editor environment plugin'
priority: Medium
effort: 1-2d
created: 2026-05-13
issue: https://github.com/8f4e/8f4e/issues/655
status: Open
completed: null
---

# TODO: Add serial input editor environment plugin

## Problem Description

The editor has a MIDI input plugin that can bind browser MIDI input events to exported 8f4e functions, but there is no equivalent path for browser serial input.

Browser serial input arrives through the Web Serial API as arbitrary `Uint8Array` chunks from a `ReadableStream`. Those chunks are not deterministic protocol frames: a JavaScript read can contain a partial message, one full message, multiple messages, or a split through any logical boundary. Calling into Wasm once per byte would be too frequent for many serial streams, while trusting browser chunk boundaries would make behavior device- and timing-dependent.

The serial plugin needs to define deterministic framing itself, copy completed frames into shared Wasm memory, and fan out completed frames to exported 8f4e callbacks.

## Proposed Solution

Add a serial input editor plugin with two directives:

```8f4e
; @info serial
; @serialIn <port> <baudRate> <bufferMemoryId> <frameBytes>
; @serialInCallback <port> <callbackExportName>
```

`@serialIn` defines one serial input pipeline for a port. `@serialInCallback` binds one exported 8f4e callback to that port's completed frames. Multiple callbacks may observe the same configured serial input pipeline.

Example:

```8f4e
; @info serial
; @serialIn 0 115200 serialBuffer 32
; @serialInCallback 0 onSerialFrame
; @serialInCallback 0 onSerialDebug
```

Example callback shape:

```8f4e
function onSerialFrame
#export onSerialFrame
	param int ptr
	param int length
	; parse length bytes starting at ptr
functionEnd
```

The plugin treats Web Serial chunks as arbitrary byte fragments. It appends all incoming bytes to a per-port queue, emits a frame whenever at least `frameBytes` bytes are available, copies exactly `frameBytes` bytes into `bufferMemoryId`, then calls every callback bound to the port as:

```ts
onSerialFrame(ptr, frameBytes);
```

Incomplete trailing bytes remain buffered until more serial data arrives. Queues are cleared when the Wasm exports or memory are rebound.

## Initial Decisions

- Use a dedicated editor plugin, following the regular plugin contract used by `editor-plugin-midi-input`.
- Use `@info serial` as the discovery surface for serial ports.
- Use `@serialIn <port> <baudRate> <bufferMemoryId> <frameBytes>` to define one input pipeline per port.
- Use `@serialInCallback <port> <callbackExportName>` to fan out completed frames to one or more callbacks.
- Include `baudRate` in the directive because Web Serial requires it when opening a port.
- Do not add delimiter-based framing in v1.
- Do not call exported callbacks once per byte.
- Do not trust JavaScript `ReadableStream` chunk boundaries as logical frames.
- Use fixed-size framing only: each callback receives exactly `frameBytes` bytes.
- Copy raw bytes into Wasm memory as `Uint8Array` data, one byte per address.
- Callback arguments are `(ptr, length)`.
- Do not check whether `frameBytes` fits inside the target buffer in v1; overflow behavior is acceptable for current 8f4e conventions.
- Clear queued partial frames whenever serial pipelines are rebound after compile, memory, or export changes.
- On disconnect, cancel/close the reader, clear the pending byte queue, update `info.serial`, and report the port as unavailable until resync/reconnect.
- Use already-granted Web Serial ports from `navigator.serial.getPorts()` in v1.
- Do not automatically call `navigator.serial.requestPort()` from the plugin, because browser permission prompts require a user gesture.
- Reject duplicate `@serialIn` definitions for the same port.
- Report an error when `@serialInCallback` references a port that has no matching `@serialIn`.

## Proposed File Organization

```text
packages/editor/packages/editor-plugin-serial-input/src/
  index.ts
  devices.ts
  directives.ts
  serialIn.ts
  types.ts
  index.test.ts
  devices.test.ts
  directives.test.ts
  serialIn.test.ts
```

Responsibilities:

- `index.ts` exports a plugin factory, starts device discovery and serial input pipelines, and owns cleanup.
- `devices.ts` owns `navigator.serial.getPorts()`, builds `state.info.serial`, tracks connect/disconnect events if available, and exposes current ports.
- `directives.ts` parses active `@serialIn` and `@serialInCallback` directives, returning pipeline configs, callback bindings, and directive errors.
- `serialIn.ts` opens configured serial ports, reads arbitrary `Uint8Array` chunks, performs fixed-size framing, copies frames into Wasm memory, resolves callback exports, and invokes callbacks.
- `types.ts` holds shared internal serial binding and pipeline types.

## Implementation Plan

### Step 1: Register the serial plugin

- Compose a serial plugin factory in the default editor, passing browser and compiler dependencies through its factory.
- Activate pipelines from `serialIn` and `serialInCallback` directives. Keep `@info serial` as an info display directive.
- Use the regular plugin installer; lazy implementation loading remains a separate design task (TODO 508).

### Step 2: Add serial device discovery

- Use `navigator.serial.getPorts()` to list already-granted serial ports.
- Populate `state.info.serial` with stable numeric indexes while the plugin is active.
- Use browser serial connect/disconnect events when available to refresh the list.
- Expose `getPort(portIndex)` for input pipeline setup.
- Clear `state.info.serial` during plugin cleanup.

### Step 3: Parse serial directives

- Parse `@serialIn <port> <baudRate> <bufferMemoryId> <frameBytes>`.
- Parse `@serialInCallback <port> <callbackExportName>`.
- Require exactly four arguments for `@serialIn` and exactly two arguments for `@serialInCallback`.
- Validate that `baudRate` and `frameBytes` are positive integer literals.
- Reject duplicate `@serialIn` definitions for the same port.
- Allow multiple `@serialInCallback` bindings for the same port.
- Reject exact duplicate `<port>, <callbackExportName>` callback pairs.
- Report callback bindings that reference a port without a matching `@serialIn`.

### Step 4: Resolve buffer memory and Wasm callbacks

- Resolve `bufferMemoryId` through the public memory-resolution helpers used by other editor plugins.
- Own Wasm instantiation and export caching inside the plugin, following the MIDI input plugin pattern.
- Resolve each callback export by name.
- Report plugin-owned directive errors for missing ports, missing memory ids, missing exports, or non-callable exports.

### Step 5: Open serial ports and frame input

- Open each configured serial port with the directive baud rate.
- Read from `port.readable` using a `ReadableStreamDefaultReader<Uint8Array>`.
- Append each received chunk to a per-port byte queue.
- While the queue has at least `frameBytes`, copy one frame into the configured buffer and invoke all callbacks for that port.
- Keep leftover partial bytes in the queue until more serial data arrives.
- Continue calling later callbacks if one callback throws, and surface callback errors as plugin-owned errors.

### Step 6: Handle lifecycle and disconnects

- On directive changes, compile completion, memory changes, or port list changes, close/cancel active readers and rebuild pipelines.
- Clear partial byte queues when rebuilding pipelines.
- On disconnect or read failure, cancel/close the reader, clear the queue, update serial info, and report the input port as unavailable until resync.
- On plugin disposal, cancel readers, release reader locks, close ports where appropriate, clear queues, unsubscribe store listeners, clear `info.serial`, and clear plugin-owned errors.

### Step 7: Test and document

- Unit test serial device listing without real Web Serial ports.
- Unit test directive parsing and diagnostics.
- Unit test fixed-size framing across arbitrary chunk boundaries.
- Unit test callback fanout for one configured port.
- Unit test lifecycle cleanup, queue clearing on resync, and disconnect/read failure behavior.
- Update editor directive docs with `@serialIn`, `@serialInCallback`, and `@info serial`.

## Validation Checkpoints

- `npx nx run @8f4e/editor-plugin-serial-input:test`
- `npx nx run @8f4e/editor-plugin-serial-input:typecheck`
- `npx nx run @8f4e/editor-website:build`

## Success Criteria

- [ ] `@info serial` lists already-granted serial ports while the plugin is active.
- [ ] `@serialIn <port> <baudRate> <bufferMemoryId> <frameBytes>` configures one fixed-frame serial input pipeline.
- [ ] `@serialInCallback <port> <callbackExportName>` binds one or more exported callbacks to completed frames.
- [ ] Serial `ReadableStream` chunks are buffered and reframed deterministically by `frameBytes`.
- [ ] Completed frames are copied into the configured Wasm memory buffer as raw bytes.
- [ ] Callbacks receive `(ptr, length)`.
- [ ] Partial queues are cleared on compile/memory/export rebinding.
- [ ] Disconnects cancel readers, clear queues, refresh `info.serial`, and surface unavailable-port errors.
- [ ] Malformed directives, duplicate pipelines, missing ports, missing buffers, and missing exports produce plugin-owned editor directive errors.
- [ ] Device discovery, directive parsing, framing, callback fanout, and lifecycle cleanup have focused tests.

## Affected Components

- `packages/editor/packages/editor-plugin-serial-input` - new serial plugin implementation, WASM access, and tests.
- `packages/editor/packages/editor-default/src/index.ts` - compose the factory with navigator and current compiler-resource getters.
- `packages/editor/packages/editor-core/docs/editor-directives.md` - document `@serialIn`, `@serialInCallback`, and `@info serial`.

## Risks & Considerations

- **Permission flow**: Web Serial `requestPort()` requires a user gesture, so v1 should only bind already-granted ports unless a separate UI action is added.
- **Browser support**: Web Serial is not universally available; unsupported browsers should show an empty serial info map and plugin-owned unavailable-port errors.
- **Port lifecycle**: Ports can disconnect while a reader is active, so cleanup must be robust and idempotent.
- **Chunk boundaries**: Browser read chunks are transport details and must never be treated as protocol frames.
- **Buffer overflow**: v1 intentionally does not validate that `frameBytes` fits in the target buffer.
- **Backpressure**: High baud rates or slow callbacks can accumulate input; fixed-size framing reduces callback frequency but does not eliminate the need for efficient handlers.

## Related Items

- **Related**: `docs/todos/archived/396-add-midi-input-editor-environment-plugin.md`
- **Related**: `docs/todos/archived/395-add-exported-8f4e-functions.md`
- **Related**: `docs/todos/508-design-editor-plugin-lazy-loading.md`
