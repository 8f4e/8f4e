# Assertion Markers Plugin

`@8f4e/editor-plugin-assertion-markers` exports `assertionMarkersPlugin`. Install it in the editor's `plugins` array
to draw executed assertions over their source line numbers. Passed sites use `positiveBase`; failed sites use
`negativeBase`. Repeated invocations produce one marker per site, with failure taking precedence.

The drawer reads `state.assertionResults` and current block layout directly. It matches sites by physical block ID,
project path, and block type, and uses the source-to-display row mapping and gaps for positioning. Included source,
hidden lines, disabled blocks, and compiling projects have no markers. The plugin owns no core widget fields or
subscriptions; disposal unregisters its drawer.

Test-runtime publishes assertion results and raw errors to core state. `editor-plugin-error-messages` owns inline
assertion failure messages independently of these markers.

Verify with `npx nx run @8f4e/editor-plugin-assertion-markers:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-assertion-markers:test:screenshot`.
