# Cloudflare Pages deployment

This app is a Vite SPA. Cloudflare Pages should build from GitHub source and publish the generated `dist` directory.

## Repository policy

- Do not commit `dist/`.
- `dist/` is ignored in `.gitignore`.
- Cloudflare builds `dist/` from source on each deployment.

## Cloudflare Pages settings

Use these settings when connecting the GitHub repository:

| Setting | Value |
|---|---|
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | repository root / empty |
| Install command | `npm ci` |
| Node version | `20` |

Set the Node version either via the dashboard environment variable:

```text
NODE_VERSION=20
```

or rely on the repository `.node-version` file.

## SPA routing

`public/_redirects` is copied into `dist/` by Vite and makes all routes serve `index.html`:

```text
/* /index.html 200
```

## Wrangler metadata

`wrangler.toml` declares the Pages output directory:

```toml
pages_build_output_dir = "dist"
```

Dashboard Git deployments still need the build command/output directory above configured in Cloudflare Pages.
