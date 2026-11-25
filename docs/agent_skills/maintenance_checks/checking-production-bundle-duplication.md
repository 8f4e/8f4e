# Checking Production Bundle Duplication

Use this check after changing package bundling, Vite aliases, workspace package exports, dependency declarations, or externalization settings.

## Goal

Catch bundle duplication: the same implementation detail emitted into multiple production chunks.

## Why This Matters

Duplicated code can inflate the app bundle and hide dependency-boundary problems. Repeated functions, classes, constants, generated tables, registries, helper blocks, or whole module bodies can mean a dependency is being bundled into more than one output instead of being shared, split, or externalized consistently.

## Steps

1. Build the production app without reusing stale output.

   ```sh
   npx nx run @8f4e/editor-webapp:build --skip-nx-cache
   ```

2. Search built assets for a distinctive repeated fragment.

   Pick something unlikely to appear by accident, such as a function name, class name, constant value, generated table entry, registry key, or helper function body.

   ```sh
   rg "distinctiveFunctionOrConstantName" dist packages/*/dist
   ```

3. Count where the fragment appears.

   Multiple appearances are expected only when the code must run in separate execution targets, such as the main app and a worker. Repeated copies across ordinary app chunks usually indicate bundle duplication.

4. Trace each repeated copy back to its package boundary.

   Check the importing package's Vite config, package manifest, and emitted chunk. If the repeated code comes from a workspace package, decide whether it should be externalized by intermediate library builds, split into a shared chunk by the final app build, or moved behind a clearer package boundary.

5. Verify the fix with another production build.

   ```sh
   npx nx run @8f4e/editor-webapp:build --skip-nx-cache
   ```

## Review Notes

- Prefer fixing package boundaries over renaming generated code to make searches quieter.
- Keep real execution-target duplication, such as main-thread and worker bundles, when sharing would change runtime behavior.
- If externalizing a workspace package, confirm its published `dist` output is directly loadable by the consuming runtime.
