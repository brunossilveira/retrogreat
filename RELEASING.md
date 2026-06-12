# Releasing

Publishing is automated by `.github/workflows/release.yml`: pushing a version tag
runs the tests, sets `manifest.json`'s version from the tag, zips the runtime
files, and uploads them to the Chrome Web Store.

## One-time setup

These steps can't be automated — they create the store listing and the
credentials the workflow uses.

1. **Register a Chrome Web Store developer account** (one-time $5 fee) at
   <https://chrome.google.com/webstore/devconsole>.
2. **Do the first upload by hand.** Build the zip locally (`npm run package`) and
   upload `retrogreat.zip` in the dashboard, fill in the listing (description,
   a 1280×800 screenshot, the 128px icon, privacy disclosure, permission
   justifications), and submit. This creates the item and gives you its
   **Extension ID**.
3. **Create API credentials** so CI can upload future versions:
   - In Google Cloud Console, create an OAuth client (type *Desktop app*) and
     enable the **Chrome Web Store API**.
   - Generate a **refresh token** for that client (see the
     [chrome-webstore-upload docs](https://github.com/fregante/chrome-webstore-upload-keys)).
4. **Add the repo secrets** (Settings → Secrets and variables → Actions):
   - `CWS_EXTENSION_ID`
   - `CWS_CLIENT_ID`
   - `CWS_CLIENT_SECRET`
   - `CWS_REFRESH_TOKEN`

## Cutting a release

```bash
git tag v1.0.1        # must be > the current manifest version
git push origin v1.0.1
```

The workflow sets the manifest version to `1.0.1`, packages, and publishes. Watch
it under the repo's **Actions** tab. The Web Store still runs its own review
(usually a few days) before the update goes live.

Running the workflow manually (Actions → Release → *Run workflow*) builds and
uploads the `retrogreat-unpacked` artifact without publishing — handy for
sanity-checking the build.

> **Manual upload gotcha:** the Web Store needs `manifest.json` at the **root** of
> the uploaded zip. Build it with `npm run package` and upload that
> `retrogreat.zip`. Don't zip the project *folder* (that nests everything under
> `retrogreat/`), and don't upload a downloaded Actions artifact zip *of* the zip.
> The `retrogreat-unpacked` artifact is unpacked precisely so its download is
> already root-correct.

## What ships

Only the runtime files (`npm run package`): `manifest.json`, `background.js`,
`content.js`, `shared.js`, `content.css`, and `icons/`. Tests, docs, and the SVG
source are left out.
