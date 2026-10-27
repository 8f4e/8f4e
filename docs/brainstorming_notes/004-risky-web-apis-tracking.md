---
title: 'Brainstorming: Risky Web APIs Used in 8f4e Project'
priority: Medium
effort: TBD
created: 2025-09-06
status: Open
completed: null
---

# Brainstorming: Risky Web APIs Used in 8f4e Project

**Purpose**: Document Web APIs with limited or inconsistent browser support for future compatibility evaluation

> **⚠️ Important Note**: The browser support information in this document should be verified by an AI agent with web search capabilities before making implementation decisions. Browser support status changes frequently, and this document may not reflect the most current compatibility information.

## Overview

This document catalogs Web APIs currently used in the 8f4e project that may have compatibility risks across different browsers and versions. This serves as a reference for implementing a browser compatibility evaluator to ensure the application works correctly on users' browsers.

## High-Risk APIs (Limited Browser Support)

### File System Access API
**Risk Level**: 🔴 **Very High**
**Browser Support**: Chrome/Edge 86+, Safari/Firefox: Not supported

**Usage Locations**:
- `packages/editor/packages/editor-core/src/state/effects/menu/menus.ts`: `FileSystemFileHandle` operations

**Context**: Used for advanced file picking and OPFS (Origin Private File System) operations
**Fallback**: Currently uses traditional `<input type="file">` as fallback
**Recommendation**: Always check for API availability before use

```typescript
// Current pattern in codebase
const entries = (opfsRoot as unknown as { 
  entries: () => AsyncIterator<[string, FileSystemFileHandle]> 
}).entries();
```

### AudioWorklet API
**Risk Level**: 🔴 **High**
**Browser Support**: Chrome 66+, Firefox 76+, Safari 14.1+

**Usage Locations**:
- `packages/editor/packages/runtime-audio-worklet/src/index.ts`: Core AudioWorklet implementation
- `src/runtime-audio-worklet-factory.ts`: AudioWorklet factory and management

**Context**: Used for low-latency audio processing in separate thread
**Compatibility Issues**: 
- Not available in older browsers
- Requires HTTPS in production
- SharedArrayBuffer dependency (COOP/COEP headers required)
**Recommendation**: Provide WebAudio fallback for unsupported browsers

### Web MIDI API
**Risk Level**: 🟡 **Medium-High**
**Browser Support**: Chrome 43+, Edge 79+, Safari: Not supported, Firefox: Behind flags or not supported

**Usage Locations**:
- `src/runtime-web-worker-midi-factory.ts`: `navigator.requestMIDIAccess()`

**Context**: Used for MIDI device access and control
**Compatibility Issues**:
- Requires user permission
- Limited browser support
- May not work in secure contexts without proper setup
**Recommendation**: Graceful degradation when MIDI not available

## Medium-Risk APIs (Compatibility Considerations)

### WebAssembly
**Risk Level**: 🟡 **Medium**
**Browser Support**: Chrome 57+, Firefox 52+, Safari 11+, Edge 16+

**Usage Locations**:
- Multiple `createModule.ts` files across packages
- `packages/editor/packages/editor-core/src/state/index.ts`: Memory management
- Extensive usage in compiler and runtime packages

**Context**: Core technology for compiled code execution
**Compatibility Issues**:
- Not available in very old browsers
- SharedArrayBuffer features require COOP/COEP headers
- Memory allocation limits vary by browser
- Some security-focused IT environments disable WebAssembly entirely due to perceived exploit risk
**Recommendation**: Critical API - provide clear error messaging if not supported

### MediaDevices.getUserMedia()
**Risk Level**: 🟡 **Medium**
**Browser Support**: Chrome 53+, Firefox 36+, Safari 11+

**Usage Locations**:
- `src/runtime-audio-worklet-factory.ts`: Audio input capture

**Context**: Accessing user's microphone for audio input
**Compatibility Issues**:
- Requires HTTPS and user permission
- Different constraint support across browsers
- Privacy-sensitive API
**Recommendation**: Handle permission denials gracefully

### Web Workers
**Risk Level**: 🟢 **Low-Medium**
**Browser Support**: Widely supported (IE 10+)

**Usage Locations**:
- `src/compiler-callback.ts`: Compiler worker
- `src/runtime-web-worker-midi-factory.ts`: MIDI worker
- Multiple runtime packages for web worker implementations

**Context**: Background thread processing for compilation and runtime execution
**Compatibility Issues**: 
- Module workers have more limited support
- SharedArrayBuffer features require headers
**Recommendation**: Well-supported, minimal compatibility concerns

## Low-Risk APIs (Widely Supported)

### Local Storage
**Risk Level**: 🟢 **Low**
**Browser Support**: Universally supported

**Usage Locations**:
- `src/storage-callbacks.ts`: Project and settings persistence
- `docs/usage.md`: Example implementations

**Context**: Persistent local data storage
**Considerations**: Storage quota limits, privacy mode restrictions

### FileReader API
**Risk Level**: 🟢 **Low**
**Browser Support**: Universally supported

**Usage Locations**:
- `src/storage-callbacks.ts`: File content reading
- `docs/usage.md`: Example implementations

**Context**: Reading file contents for project loading
**Considerations**: Large file performance, memory usage

### Blob & URL.createObjectURL()
**Risk Level**: 🟢 **Low**
**Browser Support**: Universally supported

**Usage Locations**:
- `src/storage-callbacks.ts`: File download functionality

**Context**: Creating downloadable files and object URLs
**Considerations**: Memory cleanup (URL.revokeObjectURL), size limits

### Performance API
**Risk Level**: 🟢 **Low**
**Browser Support**: Widely supported (IE 10+)

**Usage Locations**:
- `packages/editor/packages/editor-core/src/state/effects/compiler.ts`: Compilation timing
- Multiple runtime packages: Performance measurement

**Context**: High-resolution timing for performance monitoring
**Considerations**: precision may be reduced in some contexts for security

### RequestAnimationFrame
**Risk Level**: 🟢 **Low**
**Browser Support**: Universally supported

**Usage Locations**:
- `packages/editor/packages/editor-core/packages/web-ui/packages/glugglugglug/src/engine.ts`: Frame rendering loop

**Context**: Smooth animation scheduling
**Considerations**: Frame rate varies by display, may be throttled in background tabs

### Basic DOM APIs
**Risk Level**: 🟢 **Low**
**Browser Support**: Universally supported

**Usage Locations**:
- `document.createElement()`: Dynamic element creation
- `HTMLCanvasElement`: Graphics rendering
- Basic HTML5 Canvas 2D context

**Context**: Standard DOM manipulation and canvas rendering
**Considerations**: Performance differences across browsers

Font atlas generation expands packed font rows directly into a binary `Uint8Array` mask, which the WebGL renderer
uploads as an R8 texture. It requires no `OffscreenCanvas`, canvas feature detection, or `convertToBlob()` step.
Canvas 2D remains in sprite-generator's `screenshot-tests/test-cases/` for displaying mask previews; it is not part
of the production font-loading path. The former `visual-testing/index.ts` usage locations no longer exist.

## Browser Compatibility Strategy Recommendations

### 1. Feature Detection Pattern
```typescript
// Recommended pattern for checking API availability
if ('showOpenFilePicker' in window) {
  // Use File System Access API
} else {
  // Fallback to traditional file input
}
```

### 2. Progressive Enhancement
- Start with widely-supported APIs as baseline
- Layer advanced features for supported browsers
- Provide meaningful fallbacks or error messages

### 3. Critical Path Analysis
- **WebAssembly**: Critical - app won't function without it
- **AudioWorklet**: Important for audio features - provide WebAudio fallback
- **File System Access**: Nice-to-have - traditional file APIs work fine
- **Web MIDI**: Optional feature - graceful degradation

### 4. Future Compatibility Evaluator Implementation
Based on this analysis, a browser compatibility evaluator should:

1. **Check critical APIs first**: WebAssembly, SharedArrayBuffer support
2. **Test audio capabilities**: AudioWorklet vs WebAudio API availability
3. **Verify security context**: HTTPS, COOP/COEP headers for advanced features
4. **Progressive feature testing**: Enable advanced features based on support
5. **User-friendly messaging**: Clear explanations when features are unavailable

## Update Instructions

This document should be updated when:
- New Web APIs are introduced to the codebase
- Browser support for existing APIs changes significantly
- Compatibility issues are discovered during testing
- New fallback strategies are implemented

## References

- [MDN Web APIs](https://developer.mozilla.org/en-US/docs/Web/API)
- [Can I Use](https://caniuse.com) - Browser compatibility tables
- [Web Platform Status](https://chromestatus.com) - Feature implementation status
- [Baseline](https://web.dev/baseline/) - Cross-browser feature support
