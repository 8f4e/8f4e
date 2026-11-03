# Screenshot Plugin

- Own the Take Screenshot main-menu item, its event, temporary overlay visibility, PNG encoding, and browser saving.
- Export `createScreenshotPlugin({ canvas, renderFrame })` without import-time browser access or installation.
- Receive browser resources through the factory. Keep the shared editor plugin context independent of browser APIs.
- Use the canvas's owner document and window for file picking and downloads. Begin the picker synchronously from
  the action, before awaiting PNG encoding.
- Use public workspace APIs. Generic menu composition and export filename resolution remain in editor-state.
- Return an explicit disposer for menu and event registrations. The host does not track plugin resources.
- Run `npx nx run @8f4e/editor-plugin-screenshot:build|test|typecheck` after changes.
- Run `npx nx run @8f4e/editor-plugin-screenshot:test:screenshot` for real renderer and PNG capture coverage.
