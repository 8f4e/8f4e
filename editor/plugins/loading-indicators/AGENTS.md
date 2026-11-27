# Loading Indicators Plugin

- Draw shared loading records through `registerCanvasOverlay`. Producers own status changes. Hide rows through
  private bookkeeping and preserve the original records. A replacement operation with the same ID is visible.
- Prepare rows outside drawing. Schedule elapsed refreshes and expiry only when needed, independently of the
  frame loop. Dispose timers with the plugin.
