# Unified surface visual upgrade

Status: implementation complete; automated gates and component browser QA passed.
Native verification limits remain listed below. Branch: `codex/unified-surface-visual-upgrade`.
Saved baseline: `2a03ba6c` (rich content/lifecycle, verified before this work).

## Outcome and boundaries

Complete the remaining surface convergence against the current Library/Settings
and annotation-editor reference. Keep the neutral workspace palette, one accent,
soft fields, clear group hierarchy and restrained elevation in both themes.
Preserve feature behavior, content identity, settings, persistence, messaging and
surface lifecycle. No new UI framework, fonts, observer, content pool or runtime
style registry. Surface owners keep positioning, scrolling, focus and dismissal.

## Shared styling contract

`getSurfaceMaterialCss()` is the single CSS entry for surface/chrome/card/field,
button variants, native checks and selected choices. It consumes existing public
tokens and introduces no parallel token layer. Feature CSS owns geometry and
semantic layout, and the material entry is composed last. Existing workspace
aliases migrate to this same owner instead of retaining a separate recipe.

## Execution and acceptance

- [x] Save the verified previous work and create an isolated branch.
- [x] Audit recent branches and real component fixtures; identify actual entrypoints.
- [x] Centralize material recipes and migrate shared panel/modal/workspace chrome.
- [x] Upgrade Prompt manager/editor/autocomplete and formula preview/hover surfaces.
- [x] Upgrade export/send workflows without changing selection/resource lifetime.
- [x] Upgrade Reader settings/template, annotation Prompt picker/copy preview and
      the conditional bookmark-preview annotation list.
- [x] Upgrade backup settings/manager/snapshot selection/merge review and settings
      transfer states while preserving preview-versus-apply boundaries.
- [x] Converge the unsupported popup through the same public token source.
- [x] Cover upgraded states with production-component fixtures and real
      trigger tests for layout/focus/overlay regressions.
- [x] Inspect English/Chinese, light/dark, actual 320/390/768/desktop CSS widths,
      short height, long content, disabled/empty and reduced-motion component states.
- [ ] Complete native 200% browser zoom and installed Chrome/Firefox acceptance;
      fixture and unit evidence do not replace these checks.
- [x] Run focused tests, style/token/layer governance, core/smoke/acceptance, types
      and required Chrome/Firefox builds. Record exact failures and limits.
- [x] Update design, architecture, surface catalog, test gates and changelog.

## Reliability checks

Keep one scroll owner and reachable actions at every size. Selection, keyboard
navigation, IME, Escape, outside pointer, focus return, drag/resize and nested
dialogs retain their current owners. Do not use `!important`, compensating
z-indexes or page-wide selectors. No style change may rewrite annotations,
trigger a backup apply, fetch conversation history or retain binary resources.
Installed-extension acceptance and Firefox native behavior remain separate from
local fixture screenshots and automated test evidence.

## Evidence log

- Baseline core: 326 files / 2683 tests passed; smoke 56 passed; TypeScript and
  Chrome/Firefox builds passed, including classic-entry/single-pool checks.
- Audit screenshots are task artifacts outside the repository; only production
  component/token/Shadow DOM fixtures count as visual evidence.
- Shared material recipes replace feature/workspace duplicates. PanelChrome owns
  structure; the final material layer owns appearance. Modal families supply only
  private size caps, guarded by a smoke/acceptance test rather than repeating gutter
  arithmetic. No content-pool, discovery, protocol, persistence or export-resource
  lifecycle change was introduced by the visual upgrade.
- Focused domain gates passed: Prompt/Formula/Hover 7 files / 66 tests; Reader
  7 files / 81 tests; Export/Send/Transfer 5 files / 60 tests; Cloud/Bookmarks 2
  files / 35 tests. Shared material/token/Reader closure 6 files / 91 tests passed.
- Failing real-entry regressions preceded compact Prompt action labels, backup
  account deduplication and popup explicit-theme/custom-accent corrections.
- Real Chrome layout evidence caught three boundary problems: duplicate modal
  gutters (240px modal at a 320px viewport), a Prompt picker grid compressing text
  to 9px high despite 17px/16px content, and CSS Send minimum width overriding its
  existing host-size clamp (304px popover inside a 288px Reader). Fixes retained
  the existing geometry and lifecycle owners: shared modal gutters once, intrinsic
  grid rows with list scrolling, and no CSS minimum conflicting with JS sizing.
  Final browser measurements: modal 280px, picker text client/scroll heights match,
  Send 256px with no parent overflow. Escape/focus return, picker-to-preview,
  export option switching and restore-preview cancellation were exercised.
- Transfer preview fixtures initially used stale 6.0 capability metadata and
  failed to reach enabled controls. Two full-mock regressions failed before the
  fixture adopted current package/settings versions and recursive ShadowRoot
  lookup. Preview-only write protection remains enforced.
- Popup preview initially failed to inject its locale API after Vite rewrote the
  external script tag. A served-HTML regression failed with two scripts instead
  of the expected bootstrap plus two external entries. DOM-based composition now
  handles rewritten URLs and preserves literal catalog text safely. Browser
  evidence confirms Chinese labels, dark tokens and 320px width without overflow.
- Reduced-motion emulation verified `animation:none` and zero transition duration
  for progress/material actions; emulation and viewport overrides were reset.
- Full-core attempts first exposed five stale style/packaging assertions, then one
  legacy modal-size assertion; these were updated to the new ownership contract.
  A subsequent two-worker run had 2697 passing tests and the existing 200-round
  navigation timeout (15s limit retained). That case passed isolated in about
  220ms, and its discovery/navigation/content files have no diff from the baseline.
  Final quiet single-worker verification is tracked below; the timeout is not hidden.
- Chrome/Firefox builds, classic-entry checks and passive single-pool checks passed.
  Both generated popup stylesheets were compared byte-for-byte with the current
  canonical token/material output and matched. TypeScript passed and smoke passed
  8 files / 57 tests. Final core/acceptance counts are recorded at closeout.
- Independent read-only reviews found no concrete P0/P1 in material isolation,
  state selectors, packaging, input safety, cancellation, focus or write/resource
  ownership. This does not substitute for installed-browser or native-print proof.
- Final gates passed: core 329 files / 2698 tests (one worker, 230.60s), smoke 8
  files / 57 tests, acceptance 34 files / 468 tests (two workers), TypeScript and
  Chrome/Firefox builds. Whitespace validation passed. No timeout was increased.
- Browser artifacts include final desktop Prompt management, dark narrow Prompt
  editing/picking, Reader template/copy preview, message export/Send, backup
  settings/manager/snapshot/merge, settings differences and the localized popup.
  Failed pre-fix captures remain identified as regression evidence, not accepted
  final output. Temporary viewport/media changes and created browser tabs were
  cleaned up. Native 200% browser zoom was not confirmed by the selected browser
  control surface; installed extension management is blocked by its URL policy.
  Firefox native rendering and installed Chrome/Reader/PDF acceptance remain
  separate manual checks. No push or release was performed.
