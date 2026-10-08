# Privacy Policy — MarkDone（veightz）

**Last updated: 2026-10-08**  
**Product:** MarkDone (veightz), a personal fork of AI-MarkDone  
**Source:** https://github.com/veightz/AI-MarkDone  

This policy applies to the Chrome extension distributed as an **Unlisted** Chrome Web Store item (and to matching development builds from this repository).

## Summary

- Core features run **locally in your browser**.
- The fork author **does not operate a backend** that receives your chat content.
- We **do not sell** your data.
- Optional Google Drive backup (if enabled) sends bookmark snapshot files **only to the Google account you authorize**, using Google’s APIs.

## Data we do not collect

The extension author does **not** collect or transmit to author-operated servers:

- Personal profile information for analytics
- Browsing history outside the supported AI chat pages the extension is allowed to run on
- Usage analytics / advertising identifiers
- Selling or brokering of any user content

## Local processing and local storage

Most parsing, reading UI, navigation, and export preparation happen on your device.

The extension may store data **locally** via Chrome extension storage, for example:

- Preferences and settings (outline pin, reader width, feature toggles, etc.)
- Optional bookmarks / related content you choose to save for later viewing or export

You can remove this data by clearing the extension’s storage or uninstalling the extension.

## Browser sync (optional)

If your browser account enables extension sync, some preferences may sync through **the browser vendor’s** sync service. That sync is controlled by the browser/account settings, not by a MarkDone (veightz) server.

## Optional Google Drive backup

Google Drive backup is **optional** and **user-initiated**. When you connect Google Drive from the extension settings, the extension may upload verified bookmark snapshot files to a folder in **your** Google Drive (historically along the lines of an `AI-MarkDone` / backups path; exact folder name may follow the build you install).

- Files go to Google under **your** account; the fork author does not receive those files on an author-operated server.
- Backup scope is intended for bookmark snapshots—not for harvesting unrelated passwords or unrelated cloud credentials.
- OAuth access is requested with a limited Drive scope (`drive.file` style: files created or opened by the app).
- Access tokens are handled through Chrome’s identity mechanisms / short-lived local cache as implemented in the extension; the extension is not designed to store long-lived refresh tokens in exportable snapshots.

If Drive is not connected, this path is unused.

## Permissions (why they exist)

- **storage** — save settings and optional local bookmarks.
- **clipboardWrite** — copy text/Markdown when you click copy actions.
- **Host access** to ChatGPT, Gemini, Claude, and DeepSeek pages — inject the reading/navigation/export UI on those sites only.
- **identity** and Google API hosts — only for optional Drive backup/restore/disconnect.

Details for store review: see `PERMISSIONS.md` in this folder.

## Children

This extension is not directed at children under 13. Do not use it if you are not permitted to agree to Google / Chrome Web Store terms.

## Changes

We may update this policy as the fork evolves. The “Last updated” date at the top will change; continued use after an update means you accept the revised policy for that build channel.

## Contact

- Repository issues: https://github.com/veightz/AI-MarkDone/issues  
- Maintainer GitHub: https://github.com/veightz  

## Hosting note for Chrome Web Store

Chrome Web Store requires a **publicly reachable Privacy Policy URL**.

Recommended:

1. Publish this file via **GitHub Pages** (or another HTTPS site you control), e.g. a stable path under your Pages site that renders this Markdown/HTML.
2. Paste that HTTPS URL into the Developer Dashboard privacy field.

Less ideal (may be rejected or fragile): linking only to a raw.githubusercontent.com URL or an unbound blob page. Prefer a normal https page.

Until Pages is set up, keep this file on `main` at:

`https://github.com/veightz/AI-MarkDone/blob/main/docs/chrome-store/PRIVACY-POLICY.md`

…and replace the Dashboard URL once a clean public page exists.
