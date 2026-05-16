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
| Deploy command | leave empty |
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

## Troubleshooting: `npx wrangler deploy` fails

Do not set a custom deploy command to `npx wrangler deploy` for this project.

That command deploys a Workers project and expects a Worker entry point or an `[assets]` directory. This repository is configured as a Cloudflare Pages project, so Git deployments should stop after:

```text
npm run build
```

Cloudflare Pages then publishes the configured output directory:

```text
dist
```

If you need a manual CLI deployment instead of Git integration, use Pages deploy explicitly:

```bash
npx wrangler pages deploy dist
```
