# Reviewing Old npm Overrides

Use this check periodically, or whenever dependency security work touches `package.json` or `package-lock.json`.

## Goal

Remove overrides that no longer change the dependency graph for a useful reason.

## Why This Matters

Overrides are manual dependency steering. They are useful for security patches and compatibility workarounds, but they can outlive the problem they solved.

Old overrides can:

- keep packages pinned below newer safe versions;
- hide what upstream packages now resolve naturally;
- cause future install conflicts;
- make audit and lockfile reviews noisier.

## Steps

1. List the current overrides.

   ```sh
   node -e "const p=require('./package.json'); console.log(JSON.stringify(p.overrides ?? {}, null, 2))"
   ```

2. Inspect the resolved packages affected by those overrides.

   ```sh
   npm ls <package-name> --depth=8
   ```

   Look for packages marked `overridden`.

3. Remove one old override group at a time.

   Keep overrides that still have a current reason, such as an active audit finding, a documented upstream bug, or a tested compatibility requirement.

4. Refresh the lockfile.

   ```sh
   npm install --package-lock-only
   ```

5. Check what npm resolves without the override.

   ```sh
   npm ls <package-name> --depth=8
   npm audit --json
   ```

6. Sync and verify if the graph still looks healthy.

   ```sh
   npm install
   npx nx run @8f4e/editor-webapp:build
   ```

## Keep Or Delete

Keep an override when:

- it fixes a current vulnerability that upstream has not resolved;
- removing it reintroduces an audit finding;
- removing it breaks build, test, or runtime behavior;
- the reason is documented and still applies.

Delete an override when:

- npm now resolves the same or newer safe version without it;
- the parent package has updated its dependency range;
- the override only preserves an older patch version;
- no current issue or compatibility constraint explains it.
