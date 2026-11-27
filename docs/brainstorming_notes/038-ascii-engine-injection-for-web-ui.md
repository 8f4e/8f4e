# ASCII Engine Injection For Web-UI

Date: 2026-04-08

This note captures the current plan for adding an ASCII/text renderer without rewriting the existing `@8f4e/web-ui` drawer logic.

## Goal

Reuse the existing `web-ui` rendering logic by passing in a renderer instance that follows the same API shape as `glugglugglug`.

The ASCII renderer is intended for:

- cheap snapshot-style visual regression tests
- whole-scene overlap and z-order assertions
- future text-UI style rendering

## Constraints

- Leave `glugglugglug` unchanged.
- Do not turn `glugglugglug` into a multi-backend package.
- Do not duplicate a handwritten engine interface if it can be derived from `glugglugglug`.
- Keep the current `web-ui` drawer logic as intact as possible.

## Current state

`@8f4e/web-ui` is already close to renderer injection because most drawers receive an `engine` instance as a parameter.

The main coupling today is:

- drawers import the `Engine` type directly from `glugglugglug`
- `editor/core/web-ui/src/index.ts` constructs `new Engine(...)` directly

There are currently many `glugglugglug` imports in `web-ui`, but they are concentrated in drawer type annotations and the top-level init path rather than being deeply scattered through unrelated logic.

## Proposed direction

Introduce a local `Engine` type inside `@8f4e/web-ui`, but derive it from `glugglugglug.Engine` instead of rewriting it by hand.

Example shape:

```ts
import type { Engine as GlugglugEngine } from 'glugglugglug';

export type Engine = Pick<
	GlugglugEngine,
	| 'startGroup'
	| 'endGroup'
	| 'setSpriteLookup'
	| 'drawSprite'
	| 'drawText'
	| 'drawLine'
	| 'drawRectangle'
	| 'cacheGroup'
>;
```

Then:

- `web-ui` drawer files import this local `Engine` type instead of importing `Engine` from `glugglugglug`
- `web-ui` init accepts an injected engine instance or engine factory
- the browser path passes a real `glugglugglug.Engine`
- the ASCII path passes a separate engine implementation with the same public API surface

## Why not use `glugglugglug.Engine` directly as the type?

Because `glugglugglug.Engine` is a class with private members such as:

- `renderer`
- `cachingEnabled`
- `savedOffsetX`
- `savedOffsetY`

That means a separate class with the same public methods is not assignable to the raw `glugglugglug.Engine` type.

Using `Pick<glugglugglug.Engine, ...>` avoids duplicating the contract while still allowing structural compatibility for a separate ASCII engine implementation.

## Resulting architecture

```text
editor-state
-> web-ui drawers
-> local web-ui Engine type (derived from glugglugglug.Engine via Pick)
   -> real glugglugglug engine instance
   -> separate ASCII engine instance
```

This keeps:

- `glugglugglug` as the source of truth for the method signatures
- `web-ui` as the owner of the renderer contract it actually needs
- the ASCII renderer as a separate package

## ASCII engine direction

The ASCII engine should expose the same method names and argument shapes as the picked `glugglugglug` surface, but render into a fixed-size mutable 2D text canvas.

Core idea:

- maintain a character-cell buffer similar to a framebuffer
- support immediate-mode drawing operations like groups, text, sprites, and rects
- let later draws overwrite earlier cells to model z-order naturally

This renderer should eventually support richer text-native widget representations, not just test markers. For example:

- switches rendered as `[ ]` or `[*]`
- unresolved values rendered as `[__]`
- inputs/outputs rendered in a readable text-native style rather than generic single-letter placeholders

## Notes

- `cacheGroup` can start as a no-op or direct draw pass in the ASCII engine and become smarter later if needed.
- Post-process and background effects should stay outside the shared drawer contract if the ASCII path does not support them.
- The important reuse target is the scene-composition and widget-drawing logic in `web-ui`, not strict internal parity with WebGL behavior.
