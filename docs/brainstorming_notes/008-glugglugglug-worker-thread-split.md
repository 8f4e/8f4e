# Brainstorming: Splitting Glugglug for Web Worker Architecture

**Date:** 2025-11-10  
**Status:** Brainstorming  
**Context:** Exploring architecture to split glugglugglug package into WebGL-free buffer preparation (worker-capable) and WebGL rendering (main thread)

This is a proposal for a future worker split. The current renderer runs on the main thread, and font loading expands
packed glyph rows into binary R8 mask bytes for direct texture upload. Font generation uses no offscreen canvas.

## Idea Summary

Split the glugglugglug package into two parts:
1. **Core Package** - Buffer preparation logic (vertex buffers, texture coordinates) + Engine API - completely free of direct WebGL calls
2. **WebGL Package** - GPU-specific operations (context, shaders, uploads, rendering)

**Key architectural insight:** The entire application logic (user's game code) runs in the worker alongside the Engine. The worker produces vertex buffers via `SharedArrayBuffer`, and the main thread is just a thin rendering backend that uploads to GPU and executes draw calls.

This split would use a worker for application logic and shared buffers for prepared instances while keeping the
WebGL context on the main thread. It would not require transferring the canvas to the worker.

## Benefits

### Performance
- **True parallelism** - Application logic + buffer computation runs parallel to main thread
- **Smoother main thread** - UI remains responsive even during complex game logic
- **Zero-copy transfers** - `SharedArrayBuffer` avoids serialization overhead
- **Frame pipelining** - Worker prepares frame N+1 while GPU renders frame N
- **Scalability** - Multiple workers for different systems (physics, AI, rendering)

### Architecture
- **Clean separation** - Application runtime (worker) vs render backend (main thread)
- **State isolation** - All game state in worker, no synchronization complexity
- **API preservation** - Existing `Engine` API works unchanged in worker
- **Testability** - Worker code can be tested without browser/DOM
- **Reusability** - Core logic could target other backends (OffscreenCanvas, Canvas2D, WebGPU, native)

### Developer Experience
- **Natural mental model** - Game logic is self-contained in worker
- **No state serialization** - Don't need to serialize/deserialize game state across worker boundary
- **Easier debugging** - All application state in one place (worker)

## Current Architecture Analysis

### Already Well-Separated
The current codebase separates these responsibilities:

- **Instance buffer** (`src/instanceBuffer.ts`) - Reusable 20-byte sprite records containing pixel rectangles, cell IDs, and palette indices
- **Renderer** - WebGL context, shaders, textures, and GPU uploads; the vertex shader derives glyph UVs from the atlas grid
- **Engine** - Frame submission, sprite batching, and generic render hooks
- **Font loader** (`@8f4e/sprite-generator`) - Lazy binary glyph/fill masks and grid dimensions, generated without canvas APIs
- **Web-ui** - Transform groups, fixed ASCII glyph/fill IDs, and background, line, and RGBA overlay passes

The design sketches below would need adapting to this instance format. Their proposed worker builder and backend
interfaces are not existing engine APIs.

### Natural Split Points

**Worker Package (no WebGL/WebAPI):**
- **User's application logic** - The entire game/app code runs here!
- **Complete drawing API** - `Engine` class with `drawSprite()`, `drawLine()`, `drawText()`, etc.
- **Transform management** - `startGroup()`/`endGroup()` and offset stack
- **Buffer construction** - All `fillBuffer*` functions (already pure!)
- **Instance preparation** - Pixel rectangles and stable glyph/fill and palette IDs; source UVs remain a shader concern
- **Scene graph management** - Batching, draw order, visibility culling
- **Cache invalidation logic** - Decide what needs re-caching
- **Application state** - Game objects, physics, AI, etc.

**Main Thread Package (WebGL-specific):**
- **WebGL context & shader management** - Initialization, compilation
- **Font and palette uploads** - Install the R8 atlas and palette colors; send grid metadata to the worker
- **Buffer uploads** - `bufferData()` to GPU from shared buffers
- **Rendering** - `drawArrays()` calls
- **Post-processing pipeline** - Framebuffer switching, effects
- **Framebuffer management** - Including cache textures
- **Input forwarding** - Mouse/keyboard/touch events → worker
- **Asset loading** - Images, audio, then hand off to worker

**Key Insight:** The worker becomes a complete "game runtime" (application logic + engine) and the main thread becomes a thin "render backend" (GPU operations only). This solves the state management problem naturally - all application state stays in the worker where it's needed.

## Design Considerations

### 1. Shared Memory Layout

```typescript
// Example structure
class SharedRenderBuffers {
  // Vertex data
  vertexBuffer: Float32Array;      // SharedArrayBuffer-backed
  texcoordBuffer: Float32Array;    // SharedArrayBuffer-backed
  
  // Draw commands: [texture_id, start_index, count, ...]
  drawCommands: Uint32Array;       
  
  // Synchronization
  atomicCounter: Int32Array;       // Buffer state flags
  frameCounter: Uint32Array;       // For frame pacing
}
```

### 2. Communication Protocol

**Option A: Lock-free ring buffer**
- Use atomic operations for synchronization
- Worker produces, main thread consumes
- Best latency, complex implementation

**Option B: Double/Triple buffering**
- Worker fills buffer N while main thread reads N-1
- Simple, predictable latency
- Memory overhead: 2-3× buffer size

**Option C: Message passing + SharedArrayBuffer**
- Small messages for commands/state
- Bulk data in shared buffers
- Good balance of simplicity and performance

### 3. Texture Handling

Workers can't create `WebGLTexture` objects, so:
- Main thread loads images, creates textures
- Assigns numeric IDs to textures
- Worker references textures by ID
- Worker builds UV coordinates, main thread binds textures

```typescript
// Main thread
const textureId = textureManager.loadSpriteSheet(image);
worker.postMessage({ type: 'setSpriteSheet', id: textureId, width, height });

// Worker
function drawSprite(sprite: string) {
  const coords = spriteLookup[sprite];
  fillBufferWithSpriteCoordinates(buffer, offset, coords, SPRITESHEET_ID);
}
```

### 4. Cache Complexity

The `CachedRenderer` switches framebuffers mid-frame:

**Option A: Worker plans, main thread executes**
- Worker decides what to cache
- Main thread manages FBOs and renders caches
- Clean separation, worker stays pure

**Option B: Keep caching on main thread**
- Simple, less parallel
- Good for prototype

**Option C: Pre-compute cache recipes**
- Worker generates "render to cache" commands
- Main thread batch-executes them
- Most flexible

### 5. Input Handling

Since application logic runs in the worker, input events need forwarding:

```typescript
// Main thread - capture and forward input
canvas.addEventListener('mousemove', (e) => {
  worker.postMessage({
    type: 'input',
    event: 'mousemove',
    x: e.clientX,
    y: e.clientY
  });
});

canvas.addEventListener('click', (e) => {
  worker.postMessage({
    type: 'input',
    event: 'click',
    x: e.clientX,
    y: e.clientY
  });
});

// Worker - application code handles events
let mouseX = 0, mouseY = 0;

self.addEventListener('message', (e) => {
  if (e.data.type === 'input') {
    if (e.data.event === 'mousemove') {
      mouseX = e.data.x;
      mouseY = e.data.y;
    } else if (e.data.event === 'click') {
      handleClick(e.data.x, e.data.y);
    }
  }
});

engine.render(() => {
  // Use mouseX/mouseY in drawing logic
  engine.drawSprite(mouseX, mouseY, 'cursor');
});
```

**Consideration:** Input latency adds ~1 frame delay. For most games this is acceptable. For high-precision input (rhythm games, competitive shooters), may need hybrid approach.

### 6. Synchronization

```typescript
// Worker side
function prepareFrame(scene: Scene, buffers: SharedRenderBuffers) {
  // Fill buffers...
  fillBufferWithRectangleVertices(...);
  fillBufferWithSpriteCoordinates(...);
  
  // Signal ready
  Atomics.store(buffers.atomicCounter, 0, BUFFER_READY);
  Atomics.notify(buffers.atomicCounter, 0);
}

// Main thread side
function renderLoop() {
  // Wait for worker
  Atomics.wait(sharedBuffers.atomicCounter, 0, BUFFER_EMPTY);
  
  // Upload and render
  gl.bufferData(gl.ARRAY_BUFFER, sharedBuffers.vertexBuffer, gl.STATIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  
  // Signal consumed
  Atomics.store(sharedBuffers.atomicCounter, 0, BUFFER_EMPTY);
  Atomics.notify(sharedBuffers.atomicCounter, 0);
  
  requestAnimationFrame(renderLoop);
}
```

## Challenges

### 1. Engine/Renderer Split

Currently `Engine` wraps `Renderer` which holds the WebGL context. With application logic in the worker:

**Current architecture:**
```typescript
// Main thread
const engine = new Engine(canvas);
engine.render(callback); // callback calls engine.drawSprite(), which calls renderer methods
```

**New architecture needed:**
```typescript
// Worker - Engine without WebGL
class WorkerEngine {
  vertexBuffer: Float32Array;     // Fills these directly
  texcoordBuffer: Float32Array;
  drawSprite() { /* fills buffers */ }
  startGroup() { /* manages offsets */ }
}

// Main thread - Renderer with WebGL
class GLRenderer {
  uploadAndRender(vertexBuffer, texcoordBuffer) {
    gl.bufferData(...);
    gl.drawArrays(...);
  }
}
```

**Solution:** Refactor Engine to not depend on a GL context. It becomes a pure "buffer builder" with the same API, just filling `Float32Array`s instead of calling GL methods.

### 2. Transform Groups
Current `startGroup`/`endGroup` system modifies state during drawing:
```typescript
engine.startGroup(x, y);
  drawSprite(...); // Uses accumulated offset
engine.endGroup();
```

**Solution:** Move the entire application logic into the worker:
- The `Engine` class runs in the worker
- **User's drawing code executes in the worker** - the entire render callback
- Transform stack state (`offsetX`, `offsetY`, `offsetGroups`) stays in worker
- All application state and game logic can live in the worker
- Worker produces final buffers, main thread just uploads and renders
- Natural separation: worker = application + engine logic, main thread = GPU backend

**Initialization sketch for the proposed split:**
```typescript
// Main thread retains the canvas, WebGL context, and font texture.
const { image, grid } = await loadFontAtlas('ibmvga8x16');
const engine = new Engine(canvas);
engine.setSpriteAtlas(image, grid);
const worker = new Worker('game-worker.js');
worker.postMessage({ type: 'init', grid });
```

The proposed worker would own application state and transform groups, then publish completed instance buffers to
the main-thread rendering backend. This still requires a worker-safe buffer builder and a backend upload interface;
the existing `Engine` creates a WebGL renderer and would remain on the main thread.

### 3. Dynamic Buffer Growth
`growBuffer()` reallocates `Float32Array`. With `SharedArrayBuffer`:
- **Option A:** Pre-allocate large buffers (wasteful but simple)
- **Option B:** Message main thread to reallocate (complex coordination)
- **Option C:** Ring buffer with fixed size, flush when full

### 4. Post-Processing
Currently tightly coupled to WebGL. **Decision: Keep entirely on main thread.**
- Worker prepares scene geometry
- Main thread renders to texture
- Main thread applies post-processing
- No worker involvement in post-processing pipeline

### 5. Debugging
Worker code is harder to debug. **Mitigation:**
- Comprehensive logging with frame numbers
- Worker state inspection tools
- Ability to disable worker (fallback to main thread)
- Detailed error reporting with stack traces

### 6. Browser Support
`SharedArrayBuffer` requires COOP/COEP headers:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
**Good news:** Already configured in this project! (See `vite.config.mjs`)

## Proposed Package Structure

```
packages/editor/packages/
├── glugglugglug-core/          # Worker-safe buffer building (NEW)
│   ├── src/
│   │   ├── buffers/
│   │   │   ├── vertex-builder.ts      # High-level vertex generation
│   │   │   ├── texcoord-builder.ts    # UV coordinate generation
│   │   │   └── geometry.ts            # Existing buffer.ts functions
│   │   ├── scene/
│   │   │   ├── sprite-batch.ts        # Batching logic
│   │   │   ├── draw-commands.ts       # Draw call generation
│   │   │   └── transform-stack.ts     # Resolve transform groups
│   │   ├── shared/
│   │   │   ├── memory-layout.ts       # SharedArrayBuffer structure
│   │   │   └── protocol.ts            # Message types
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── glugglugglug-webgl/         # WebGL rendering (REFACTORED)
│   ├── src/
│   │   ├── context/
│   │   │   └── webgl-context.ts       # Context creation
│   │   ├── renderer.ts                # Core rendering (refactored)
│   │   ├── texture-manager.ts         # Texture lifecycle
│   │   ├── shader-manager.ts          # Shader compilation
│   │   ├── buffer-uploader.ts         # GPU buffer uploads
│   │   └── post-process/
│   │       └── PostProcessManager.ts  # Existing post-process
│   ├── package.json
│   └── tsconfig.json
│
└── glugglugglug/               # Integration layer (MODIFIED)
    ├── src/
    │   ├── engine.ts                   # High-level API (modified)
    │   ├── worker-bridge.ts            # Main thread <-> worker bridge (NEW)
    │   ├── render-worker.ts            # Worker entry point (NEW)
    │   ├── fallback-renderer.ts        # Non-worker path (NEW)
    │   └── index.ts
    ├── package.json
    └── tsconfig.json
```

## Migration Path

### Phase 1: Extract Pure Functions ✅ (Mostly Done)
- Move buffer utility functions to `glugglugglug-core`
- Ensure zero WebGL/DOM dependencies
- Add comprehensive tests

### Phase 2: Refactor Renderer Interface
```typescript
// Before: Renderer fills its own buffers
renderer.drawSpriteFromCoordinates(x, y, ...);

// After: Renderer accepts pre-filled buffers
const buffers = bufferBuilder.build(scene);
renderer.upload(buffers);
renderer.render();
```

### Phase 3: Create Worker Wrapper
- Implement `render-worker.ts` calling `glugglugglug-core`
- Implement `worker-bridge.ts` for main thread
- Keep synchronous fallback for debugging

### Phase 4: Add SharedArrayBuffer
- Replace message passing with shared memory
- Implement synchronization primitives
- Benchmark against message passing

### Phase 5: Optimize Lock-Free Algorithms
- Replace simple locks with atomic operations
- Implement ring buffer for command queues
- Profile and tune memory layout

## Performance Validation

**Before implementing, profile to validate:**

1. **Measure buffer construction time**
   ```typescript
   const start = performance.now();
   fillBufferWithLineVertices(...); // Has trigonometry
   const duration = performance.now() - start;
   ```

2. **Count sprites per frame**
   - Workers shine with >10,000 sprites/frame
   - Below 1,000 sprites: overhead likely exceeds benefit

3. **Identify main thread bottlenecks**
   - Is buffer construction actually slow?
   - Or is GPU upload/rendering the bottleneck?

4. **Measure worker overhead**
   - Message passing latency
   - Shared buffer synchronization cost

## Simpler Alternatives

Before going full worker architecture, consider:

### 1. Pre-compute Static Geometry
For scenes with static elements:
```typescript
const staticBatch = engine.createStaticBatch();
staticBatch.drawSprite(...);
staticBatch.finalize(); // Uploads once
// Later: just render, no buffer updates
staticBatch.render();
```

### 2. Instanced Rendering
For repeated sprites (particles, tiles):
```typescript
// Upload position/sprite data as instance attributes
// One draw call renders thousands of instances
gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
```

### 3. GPU-Driven Transforms
Move transform calculations to vertex shader:
```glsl
uniform mat4 u_transforms[100];  // Array of transforms
attribute float a_transformId;   // Which transform to use

void main() {
  gl_Position = u_transforms[int(a_transformId)] * a_position;
}
```

### 4. Alternative: Worker-Owned WebGL

A future backend could move WebGL rendering itself into a worker using `OffscreenCanvas`. That changes canvas and
context ownership and is independent of font-mask generation. It is an alternative proposal, not the current pipeline:

```typescript
const layerWorker = new Worker('layer-renderer.js');
const offscreen = canvas.transferControlToOffscreen();
layerWorker.postMessage({ canvas: offscreen }, [offscreen]);
```

## Questions to Answer

1. **What's the actual performance profile?**
   - Profile current implementation under realistic load
   - Identify true bottlenecks

2. **How many sprites per frame in typical use?**
   - <1K: Workers probably not worth it
   - 1K-10K: Maybe beneficial
   - >10K: Definitely beneficial

3. **Is the Engine API stable?**
   - Major refactor requires API stability
   - Breaking changes are disruptive

4. **What's the fallback strategy?**
   - Graceful degradation without `SharedArrayBuffer`?
   - Synchronous mode for debugging?

5. **What's the maintenance cost?**
   - Two codebases to maintain
   - More complex debugging
   - Higher cognitive load

## Recommendations

### Immediate Next Steps
1. **Profile current performance** - Identify actual bottlenecks
2. **Prototype pure function extraction** - Validate `glugglugglug-core` is viable
3. **Benchmark simple alternatives** - Try instanced rendering first

### Decision Tree
```
Is buffer construction >5ms/frame?
├─ NO → Try simpler optimizations first
│        (static batches, instancing, GPU transforms)
└─ YES → Continue with worker split
         ├─ Is rendering >10K sprites/frame?
         │  ├─ NO → Reconsider if complexity is worth it
         │  └─ YES → Worker split is justified
         └─ Prototype with message passing first
            └─ If successful, optimize with SharedArrayBuffer
```

## Related Work

- **PixiJS** - Uses batching and instancing, not workers
- **Three.js** - Some examples use workers for geometry generation
- **Unity WebGL** - Uses workers for physics, keeps rendering main-thread
- **WebGL Insights** (book) - Chapter on parallel command generation

## Success Criteria

If we proceed, success means:
- **Latency:** Frame time reduced by >20%
- **Throughput:** 2× sprites at same frame rate
- **Stability:** No regressions in existing features
- **Debuggability:** Can easily disable worker mode
- **Compatibility:** Works on target browsers (Chrome, Firefox, Safari)

## Notes
- Current architecture already has good separation
- `SharedArrayBuffer` infrastructure already in place (COOP/COEP headers)
- Buffer utility functions are already pure (easy to extract)
- Main complexity is in caching system and state management
- Consider incremental approach: extract, then parallelize

