# GitHub Pages deployment

The `Deploy GitHub Pages` workflow builds and publishes `dist/web/browser` on pushes to `main`.
The workflow is .github/workflows/pages.yml. It checks lint, types and Vitest unit specs before building; it does not run Playwright or formatting checks. No database server or secrets are required.

In the GitHub repository, open **Settings → Pages**, then choose **GitHub Actions** as the source.
Run the workflow from **Actions → Deploy GitHub Pages → Run workflow**, or push to `main`.

Expected URL: https://dewchan01.github.io/JpMj_Calculator/

The Pages configuration uses hash routes (for example `/#/score`) so refreshing a match does not
require a server rewrite. The workflow takes the base path from GitHub Pages configuration, and
the web manifest uses relative URLs to keep installation within the repository path. Development
and regular production builds retain their existing routing behavior.

To build this configuration locally:

```powershell
npm.cmd run build -- --configuration production,pages --base-href /JpMj_Calculator/
```

GitHub serves only the build artifact, including public assets. Test photos, source files and local
IndexedDB data are not bundled. The hosted origin has its own database; local matches are not
automatically transferred. Use Others > Data CSV import/export or QR/ID transfer to move selected games. API photo recognition requires the configured provider to allow CORS
from this Pages origin. API URLs are public client-side settings; never put secret keys in them.

See [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
