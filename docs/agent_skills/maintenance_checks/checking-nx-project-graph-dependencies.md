# Checking Nx Project Graph Dependencies

Use this check after dependency cleanup, package manifest edits, project moves, or changes to imports between workspace packages.

## Goal

Keep the Nx project graph aligned with package manifests and source imports, without stale manual edges.

## Why This Matters

Nx uses the project graph to decide task ordering, affected projects, and cache invalidation. If graph edges are missing or stale, builds can run in the wrong order, affected checks can miss projects, or task graphs can become noisier than they need to be.

## Steps

1. Generate the project graph as JSON.

   ```sh
   npx nx graph --file=/tmp/8f4e-nx-graph.json
   ```

2. Inspect workspace project edges.

   ```sh
   node - <<'NODE'
   const data = require('/tmp/8f4e-nx-graph.json');
   const graph = data.graph || data;
   const nodes = graph.nodes || {};
   const deps = graph.dependencies || {};

   for (const name of Object.keys(nodes).sort()) {
     const out = [...new Set((deps[name] || []).map(edge => edge.target).filter(target => nodes[target]))].sort();
     console.log(`${name}: ${out.join(', ')}`);
   }
   NODE
   ```

3. Compare graph edges with workspace package manifests.

   ```sh
   node - <<'NODE'
   const fs = require('fs');
   const path = require('path');
   const root = process.cwd();
   const packageByName = new Map();

   function walk(dir) {
     for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
       if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
       const fullPath = path.join(dir, entry.name);
       if (entry.isDirectory()) {
         walk(fullPath);
       } else if (entry.name === 'package.json') {
         const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
         if (pkg.name) packageByName.set(pkg.name, path.relative(root, fullPath));
       }
     }
   }

   walk(root);

   const data = require('/tmp/8f4e-nx-graph.json');
   const graph = data.graph || data;
   const nodes = graph.nodes || {};
   const deps = graph.dependencies || {};

   for (const [name, pkgPath] of [...packageByName].sort()) {
     if (!nodes[name]) continue;

     const pkg = JSON.parse(fs.readFileSync(path.join(root, pkgPath), 'utf8'));
     const manifestDeps = new Set(
       Object.keys({
         ...pkg.dependencies,
         ...pkg.devDependencies,
         ...pkg.peerDependencies,
         ...pkg.optionalDependencies,
       }).filter(dep => nodes[dep])
     );
     const graphDeps = new Set((deps[name] || []).map(edge => edge.target).filter(target => nodes[target]));

     const graphWithoutManifest = [...graphDeps].filter(dep => !manifestDeps.has(dep) && dep !== '@8f4e/config');
     const manifestWithoutGraph = [...manifestDeps].filter(dep => !graphDeps.has(dep));

     if (graphWithoutManifest.length || manifestWithoutGraph.length) {
       console.log(JSON.stringify({ name, pkgPath, graphWithoutManifest, manifestWithoutGraph }));
     }
   }
   NODE
   ```

4. Investigate any mismatch.

   ```sh
   rg "@8f4e/package-name" packages/<project>/src packages/<project>/tests packages/<project>/*.ts
   ```

   Add missing manifest entries when source or tests import another workspace package. Use `dependencies` for runtime/source imports and `devDependencies` for test-only imports.

5. Review manual implicit dependencies.

   ```sh
   rg "implicitDependencies" . -g 'project.json' -g 'package.json' -g 'nx.json'
   ```

   Remove an implicit dependency only when Nx already detects the same edge from a real source import. Keep manual edges for worker query imports, generated artifacts, scripts, or other relationships Nx cannot infer.

6. Check production versus test inputs.

   ```sh
   npx nx show target inputs @8f4e/sprite-generator:build --json
   npx nx show target inputs @8f4e/sprite-generator:test --json
   ```

   A dev dependency still creates an Nx graph edge. Prefer local sample fixtures when the dependency only supplies test data. Keep real implementation dependencies and affected-test coverage; do not remove edges solely because their imports live in tests. See `docs/build-input-audit.md` for shipped-asset exceptions and package-boundary follow-ups.

7. Verify after changes.

   ```sh
   npm install
   npx nx graph --file=/tmp/8f4e-nx-graph-after.json
   npx nx run-many --target=typecheck --all
   npx nx run @8f4e/editor-website:build
   ```

## Keep Or Fix

Keep an edge when:

- source imports the target package;
- tests import the target package and it is declared as a dev dependency;
- a target depends on generated files or worker assets Nx cannot infer;
- the dependency is a config-only edge such as shared `@8f4e/config` usage.

Fix an edge when:

- the graph sees an import but the package manifest does not declare it;
- the manifest declares a workspace package that has no import, config, script, or target relationship;
- an `implicitDependencies` entry duplicates a source-detected edge;
- a generated graph edge comes only from stale `dist` output or obsolete config.
