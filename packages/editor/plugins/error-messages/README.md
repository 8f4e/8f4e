# Error Messages

`@8f4e/editor-plugin-error-messages` reserves rows and draws inline source errors. Install
`errorMessagesPlugin` through an unconditional deferred registry.

Raw errors remain in `state.codeErrors`, keyed by contributor. Each publisher replaces its own list:

```ts
store.set('codeErrors.my-plugin', [{
	codeBlockId: block.creationIndex,
	lineNumber: 2,
	message: 'Describe the problem here',
}]);
```

Use zero-based source lines. Project-scope errors use `codeBlockId: -1` with `projectGroupPath`. Compiler errors use
the `compiler` key, core directive validation uses `editor-directives`, and test-runtime publishes failed source
assertions under `test-runtime`. Contributors clear or remove their own lists; display-plugin disposal preserves raw errors.

The plugin owns wrapping, the `Error:` heading, colors, source-to-display mapping, and prepared pixel coordinates.
It reserves space through `layout.createContribution` and draws through the ordered `registerCodeBlockDrawer` registry.
Messages on the same row stack after other contributed space. Hidden source lines reserve no rows and draw no message.
Core's `getCodeBlockErrors(state, block)` from `@8f4e/editor-state` supplies document/project-scope matching.
Prepared render data stays private; navigation uses core's source-line geometry independently.

Removing errors or disposing the plugin releases its layout requests and drawer. Layout changes do not change source
or advance project/compiler revisions.

Verify through the package's Nx `build`, `test`, `typecheck`, and `test:screenshot` targets. Rendering fixtures use local
plain text; combined compiler/runtime rendering belongs in editor composition tests.
