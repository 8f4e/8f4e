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

The repository must provide the `CLOUDFLARE_API_TOKEN` Actions secret and the `CLOUDFLARE_ACCOUNT_ID` Actions
variable. Existing release tags are required; the workflow refuses to initialize a first release.
