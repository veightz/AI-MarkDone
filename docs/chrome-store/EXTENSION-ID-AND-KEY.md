# Extension ID & manifest `key` — Unlisted listing decision

## Current fork behavior

- `config/extension/chromeWebStore.ts` embeds the **upstream** Chrome Web Store public key.
- Derived / expected ID: `bmdhdihdbhjbkfaaainidcjbgidkbeoh` (same as upstream store AI-MarkDone).
- Build pipeline writes that value into `manifest.key` so **Load unpacked** keeps a stable ID aligned with the upstream-bound Google OAuth Chrome Extension client (`docs/runbooks/chrome-google-drive-oauth.md`).
- There is **no** `update_url` in the Chrome manifest (correct for CWS uploads; the store owns updates).

## Can veightz publish Unlisted **with** that `key`?

**No (recommended stance).** That ID belongs to the **upstream** store item. Uploading a package that claims the same public key / ID without owning that Dashboard item will fail or create a conflict. This fork’s maintainer does **not** own the upstream listing.

## Recommendation for the new Unlisted item

| Option | What to do | Pros | Cons |
| --- | --- | --- | --- |
| **A. Strip `key` on first CWS upload (recommended MVP)** | Upload zip **without** `manifest.key` (this is how `AI-MarkDone-veightz-chrome-store-unlisted.zip` is built). CWS generates a new private key + **new extension ID**. | Simple; no PEM to lose before you have a Dashboard item. | Unpacked local builds still use upstream key until you copy the new public key back into the repo. Drive OAuth client must be recreated for the new ID. |
| **B. Generate your own PEM first** | `openssl` generate keypair; put public key in manifest / `AIMD_CHROME_EXTENSION_KEY`; keep PEM secret for CRX signing if ever needed. | Stable ID before upload (if CWS accepts the pre-declared key for a new item). | PEM must be backed up; still need new OAuth client for that ID. |
| **C. Keep upstream key** | Do not. | — | Conflicts with upstream ownership; wrong product identity. |

**Decision recorded for materials:** use **Option A** for the store zip. After the item exists, optionally switch local/dev to Option B by pasting the Dashboard “public key” into fork config so unpacked ID matches the Unlisted item.

## Impact on Google Drive OAuth

- Upstream Chrome Extension OAuth client is bound to `bmdhdihdbhjbkfaaainidcjbgidkbeoh`.
- A new Unlisted ID **breaks** that binding until you:
  1. Create a new Google Cloud **Chrome Extension** OAuth client bound to the **new** item ID.
  2. Update `GOOGLE_DRIVE_CHROME_EXTENSION_CLIENT_ID` in `config/extension/cloudBackup.ts`.
  3. Update Web application client redirect URI to `https://<NEW_ID>.chromiumapp.org/`.
  4. Ship a new store version.
- Until then: **local features OK; Drive backup may not work** on the Unlisted build.

## Store zip checklist

- [x] No `update_url` (CWS provides updates)
- [x] No upstream `key` in the upload zip
- [ ] After publish: record new item ID + public key in Trellis / this doc
- [ ] After publish: OAuth rebind (or explicitly accept Drive off until then)

## Related

- `scripts/generate-manifest.ts` — key / ID consistency check
- `docs/runbooks/chrome-google-drive-oauth.md`
