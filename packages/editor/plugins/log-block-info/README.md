# Log Block Info Plugin

`@8f4e/editor-plugin-log-block-info` contributes `Log <block kind> info to console` to the
clicked block's context menu. It logs the clicked block directly to the browser
console, without editing the project. Inspection is available in both editor modes and for read-only blocks.

The default editor loads `logBlockInfoPlugin` after the first render. Other compositions can omit the plugin.
Disposal unregisters its menu contribution and action listener.
