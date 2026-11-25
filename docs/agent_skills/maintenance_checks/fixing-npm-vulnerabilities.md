# Fixing npm Vulnerabilities

Use this check when `npm install`, CI, or a dependency update reports npm audit vulnerabilities.

## Goal

Remove reported vulnerabilities with the smallest dependency change that keeps the workspace buildable.

## Steps

1. Inspect the current audit report.

   ```sh
   npm audit --json
   ```

2. Identify whether each vulnerable package is direct or transitive.

   ```sh
   npm ls <package-name> --depth=8
   ```

3. Prefer a non-forcing lockfile repair first.

   ```sh
   npm audit fix --package-lock-only
   ```

   Avoid `npm audit fix --force` unless the proposed major version or downgrade is intentional and reviewed.

4. If npm cannot fix a transitive vulnerability safely, consider a targeted `overrides` entry in the root `package.json`.

   Keep overrides as narrow as possible. For example, prefer overriding a dependency under the package that pulls it in instead of pinning it globally.

5. Sync the local install after changing the lockfile.

   ```sh
   npm install
   ```

6. Verify the result.

   ```sh
   npm audit --json
   npm ls <package-name> --depth=8
   npx nx run @8f4e/editor-webapp:build
   ```

## Review Notes

- Check whether npm is proposing a downgrade, especially for tooling packages such as Nx.
- Keep existing user changes in `package.json` and `package-lock.json`; do not reset the lockfile just to make the diff smaller.
- If adding overrides, record the reason in the PR summary so they can be reviewed later.
- Warnings about peer dependency ranges are not the same as audit vulnerabilities, but build verification should still cover them.
