# Code block background

- Own only the base rectangle's palette choice and drawing. Keep loop/culling, corners, and arrows in web-ui.
- Register through the shared `registerCodeBlockDrawer`; return its unregister function as plugin disposal.
- Install eagerly before code rendering in both compositions. Drawing order is registration order.
- Use shared dimensions and generic palette indices. Do not add flags, derived state, or browser dependencies.
- Test this plugin's backgrounds without installing sibling plugins. Local fixture text is fine in browser tests.
- Verify through the package's Nx build, test, typecheck, and test:screenshot targets.
