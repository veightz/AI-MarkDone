# README reference review

Date: 2026-10-12 (Asia/Shanghai).
Branch: `codex/unified-surface-visual-upgrade`.

## User correction and approach

The previous README had become a long personal introduction and usage guide.
The user requested the presentation of a mature, highly starred project, based
on an actual browser-extension README. The revised rule is to lead with product,
installation, screenshots and concise linked highlights. Detailed help becomes
secondary; the author's practical voice stays in the text and support section.
English remains the default README; Chinese remains a separate document.

## Sources reviewed

Star counts are approximate observations from the primary GitHub pages, not
claims about AI-MarkDone or permanent values.

| Reference | Observed stars | Useful pattern | Decision |
| --- | --- | --- | --- |
| [Refined GitHub](https://github.com/refined-github/refined-github) / [README source](https://github.com/refined-github/refined-github/blob/main/readme.md) | 32.3k | Short purpose, installation near the top, browser/store links, visual highlights and direct feature links | Primary reference; it also enhances one host site's interface. |
| [SingleFile](https://github.com/gildas-lormeau/SingleFile) | 22.6k | Demonstration, clear installation/getting-started flow, FAQ and release/help navigation | Secondary reference, especially for export and offline-content guidance. |
| [Immersive Translate](https://github.com/immersive-translate/immersive-translate) | 19.3k | Compact documentation/install/feedback links and concise feature descriptions | Reviewed; its current repository is a distribution/feedback repository rather than the open-source extension code, so it was not the primary development-project model. |

Adapted information hierarchy and conventional Markdown/HTML patterns only.
The product descriptions, feature boundaries, logo, screenshots, store IDs,
contact details and license remain AI-MarkDone's. No third-party promotional
copy, sponsor badges, screenshots, compatibility claims or star counts were
placed in the product README.

## Result

- Header with the product logo, concise description, Chrome/Firefox install
  buttons, website/docs/release/issue/language links, MIT and actual repository
  star badges.
- Internal navigation and a browser install table. Version numbers, preparation
  status and release summaries are confined to a dedicated changelog section
  after the final user review; installation/version badges were removed.
- A full-width Reader screenshot and eight linked feature groups. Settings
  screenshots are collapsible; every feature name links to the actual manual
  page in the corresponding language.
- Three getting-started steps, collapsed FAQ, four current-release highlights,
  development/manual-load guidance and a compact author/support section.
- Retained annotation persistence defaults, 30-day draft conditions, temporary
  excerpts, bookmark-excerpt setting, manual backup scope, unsupported visual
  placeholders and Firefox temporary-loading limits.
- Public manual links were checked for both languages. Website content is not
  treated as the behavior authority where it lags the repository's contracts.

## Screenshot provenance

The initial four screenshots under `imgs/readme/` were copied from the accepted
Chrome production-component visual runs:

- `reader.en.png` and `reader.zh.png`: `full-chromium-2026-10-12T08-57-59-833Z`,
  Reader panel, desktop 1440px, light, English/Chinese, normal motion.
- `settings.en.png` and `settings.zh.png`: `full-chromium-2026-10-12T09-05-04-192Z`,
  explicit Settings primary view, same dimensions/theme/languages/motion.

Captions identify demonstration content. No private live conversation data or
invented UI is used. Existing historical screenshot files are retained.

At final prepublication review on 2026-10-12 all four were recaptured from the
current production-component fixtures. Reader uses a research-style sample
reply, localized in Chinese/English, showing headings, an actual KaTeX mean
formula and a table in the first viewport. A temporary Vite transform replaced
only the fixture's test data; no tracked mock or runtime implementation changed.
The original production toolbar trigger and ReaderPanel path remain in use.
Settings uses the unmodified current primary-view fixture; its new images are
byte-identical to the existing assets.

All four captures use 1440x900, light theme and reduced motion. Each had one
visible dialog, no page/console errors, zero horizontal overflow and in-viewport
bounds. Reader formula rendering was asserted. The resulting images were
visually reviewed; temporary servers and isolated browsers were closed. Capture
script, JSON and hashes are retained in the task's local artifact directory.


## Verification and boundaries

Only README, documentation and screenshot assets change. The 6.2.0 release notes,
in-app copy, runtime, permissions, data contracts and installation archives are
unchanged. Both READMEs passed GFM-to-HTML rendering and balanced HTML checks. Local
paths/images: 15 per README; internal anchors: 6 per README; reference-style
links/images: 10 per README. Documentation governance/content checks passed
2 files / 10 tests. Markdown diff whitespace checks passed. No production build
was rerun for this documentation/assets-only pass. No main merge, tag, push or publication is authorized
or performed by this README pass.


## Final version-placement check

The user required version information to live in one stable changelog module.
Both READMEs now use a fixed Changelog/更新日志 heading, with 6.2.0 and its status
inside it. Installation and feature prose contain no concrete release number or
preparation statement, and the install table has no version-badge column.
The writing authority records this rule for future updates.
