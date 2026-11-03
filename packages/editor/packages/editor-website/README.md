# Editor Website

`@8f4e/editor-website` is the deployable website for the default 8f4e editor. It owns the HTML page, static hosting
files, and Vite configuration. Its TypeScript entry point mounts `@8f4e/editor-default`, then dynamically imports
the external WebMCP bridge. The bridge and its search catalog load after editor initialization, outside the initial
script graph. Bridge loading or registration failures are logged independently of editor startup.

From the workspace root:

```bash
npx nx run @8f4e/editor-website:dev
npx nx run @8f4e/editor-website:build
npx nx run @8f4e/editor-website:serve
```

Cloudflare Pages should use `npx nx run @8f4e/editor-website:build` as its build command. The output directory is
`packages/editor/packages/editor-website/dist`, which is also configured in the root `wrangler.toml`.
