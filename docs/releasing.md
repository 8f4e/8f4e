# Releases and Production Deployment

To release and deploy production, manually run the **Release** GitHub Actions workflow from `main`.
The workflow rejects other branches. Pushes and merges to `main` run checks without deploying.

The entry workflow in `.github/workflows/release.yml` only defines the stage order and permissions. The release and
deployment stages are implemented by `release-run.yml` and `release-deploy.yml` beside it.

The workflow performs these stages:

1. One job checks out and installs dependencies once, versions packages with Nx, and runs the `@8f4e/release:check` Nx
   target. Nx builds both websites while tests run in parallel on the same runner, records release metrics, saves
   the website artifacts, and atomically pushes the release commits and tags to `main`.
2. After the push succeeds, two jobs deploy the saved website artifacts in parallel: 8f4e.com to the `8f4e-website`
   Cloudflare Pages project and editor.8f4e.com to the `8f4e` project. Both deployments use their production `main`
   branch.

A failed check or build prevents the release push and deployments. A failed release push prevents deployments.
If `main` changes during a release, the atomic push rejects the stale release so it can be rerun from the new head.
Both deployments use immutable artifacts built from the versioned release checkout.
Each website artifact includes a top-level `404.html` that Cloudflare Pages serves with HTTP 404 for missing URLs.

The repository must provide the `CLOUDFLARE_API_TOKEN` Actions secret and the `CLOUDFLARE_ACCOUNT_ID` Actions
variable. Existing release tags are required; the workflow refuses to initialize a first release.

## Linux runtime releases

The standalone Linux runtime has separate **Linux runtime / Test** and **Linux runtime / Release** workflows.
Native builds and tests run in Debian 12 Bookworm containers on Linux x86-64 and ARM64; the web workflows do not
build/test the native projects or install JACK
development dependencies. The web Nx release excludes `@8f4e/runtime-linux` and `@8f4e/runtime-command`.

To publish native executables, manually run **Linux runtime / Release** from `main`. It builds and tests both
architectures, smoke-tests the extracted executable, and publishes `.tar.gz` archives on a GitHub release tagged
`@8f4e/runtime-linux@<version>`. The version
comes from `packages/runtime-linux/package.json`; update that manifest and the root lockfile in a PR before the
next native release. Existing release tags/assets are not overwritten. This workflow does not version web packages,
record web release metrics, or deploy Cloudflare sites. See the [runtime documentation](../packages/runtime-linux/README.md).
