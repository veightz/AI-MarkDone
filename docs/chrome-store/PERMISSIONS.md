# Chrome Web Store — permissions justification (MarkDone veightz)

Source of truth: `manifest.chrome.json` / generated `dist-chrome/manifest.json` (MV3).  
Use this when filling **Privacy practices** and permission justifications in the Developer Dashboard.

## Permissions

| Permission | Why it is needed | User-visible behavior |
| --- | --- | --- |
| `storage` | Persist preferences (reader width, outline pin, toolbar settings, etc.) and optional local bookmarks / related local data. | Settings survive reload; bookmarks can be stored locally until the user clears extension data or uninstalls. |
| `clipboardWrite` | Copy Markdown / text when the user clicks copy actions in the UI. | Only on explicit user action (copy buttons). |
| `identity` | Optional Google account connect for **Google Drive bookmark backup** via Chrome Identity / OAuth. | User must initiate connect in Settings → Data Management. Not required for core reading/export. |

## Host permissions

| Host pattern | Why |
| --- | --- |
| `https://chatgpt.com/*` | Inject content scripts / UI for ChatGPT (bootstrap + main content). |
| `https://chat.openai.com/*` | Legacy ChatGPT host; same features. |
| `https://gemini.google.com/*` | Gemini page integration. |
| `https://claude.ai/*` | Claude page integration. |
| `https://chat.deepseek.com/*` | DeepSeek page integration. |
| `https://www.googleapis.com/*` | Google Drive API calls for optional bookmark backup/restore. |
| `https://oauth2.googleapis.com/*` | OAuth token revoke / related Google OAuth endpoints for Drive disconnect. |

Content scripts run only on the AI chat hosts above (not on arbitrary websites). Google API hosts are for optional Drive backup, not for scraping unrelated sites.

## OAuth / `oauth2` block (Chrome)

- Manifest may include `oauth2.client_id` + scope `https://www.googleapis.com/auth/drive.file`.
- Scope is limited to files the app creates/opens (`drive.file`), not full Drive.
- **New Unlisted listing:** do **not** reuse the upstream store extension ID. After Chrome assigns a **new** item ID, create a new Google Cloud **Chrome Extension** OAuth client bound to that ID (see `EXTENSION-ID-AND-KEY.md` and `docs/runbooks/chrome-google-drive-oauth.md`). Until then, Drive connect may fail; core local features still work.

## What we do **not** request

- No `tabs` / `webRequest` / `debugger` / broad `<all_urls>` for reading.
- No remote code execution hosts for extension logic (built assets ship in the package).
- No analytics SDKs that phone home to the fork author.

## Privacy practices checklist (suggested answers)

| Question | Suggested answer |
| --- | --- |
| Collects personally identifiable information? | **No** (by the extension author). Optional Google sign-in for Drive is handled by Google; tokens are not harvested to a fork backend. |
| Remote code? | **No** |
| Sells user data? | **No** |
| Transfer user data to third parties? | Only optional **user-initiated** Google Drive uploads to **the user’s own** Drive; plus browser vendor sync if the user enables Chrome sync for extension storage. |
| Privacy policy URL | Public URL hosting `docs/chrome-store/PRIVACY-POLICY.md` (see that file’s hosting notes). |

## Single purpose

Enhance reading, navigation, bookmarks, and export on supported AI chat sites (personal fork). Not an unrelated general-purpose tool.
