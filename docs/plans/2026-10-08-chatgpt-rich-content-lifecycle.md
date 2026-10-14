# ChatGPT rich content and content-pool lifecycle

Status: implementation complete; final gates and installation acceptance tracked below. Branch: `codex/chatgpt-rich-content-lifecycle`.
Baseline: `1f54c608` (89 existing files committed before this work).

## Objective

Preserve ChatGPT text, code, formulas and tables as Markdown, represent visual
blocks explicitly, and offer plain Markdown, an offline Markdown/assets ZIP,
and PDF/PNG with static visuals or descriptive placeholders. Keep the one
PageIndex, one tab-local content pool, atomic Surface and shared navigation.
Current-message actions must remain usable before historical pool admission.

## Evidence and constraints

- Live completed DIL reply: one data-URL SVG diagram, two SVG charts, HTML
  flow/card layouts and 78 TeX annotations. Native image download and chart
  data table succeeded; installed Reader/Markdown dropped visuals and leaked
  chart-axis text. The conversation was not refreshed or regenerated.
- Host message UUIDs agreed between search, selection and DIL ownership in
  observed units. A chart/table toggle preserved them. This is local evidence,
  not a permanent provider API guarantee. Display coordinates, React IDs and
  chart IDs are never persistent identity.
- Baseline smoke: 55 passed. Chrome/Firefox build and passive-content boundary
  checks passed. The first sandbox build hit tsx IPC EPERM; unchanged scripts
  passed outside that restriction. No baseline implementation was rewritten.
- Existing SemanticContent owns Markdown AST/source spans. Do not introduce
  another paragraph/formula AST or source/surface matcher.
- Do not request conversation APIs, credentials, storage or private React
  state. Do not execute captured scripts or relax CSP, sanitization or sender
  checks. No broad host permissions or permanent visual-asset storage.

## Lifecycle invariants

1. Scope every result to document/projection epoch, exact assistant identity
   and source revision. Route A-to-B-to-A must reject the first A's late work.
2. DOM unmount removes only live capability; obtained immutable content stays.
   A recycled owner with another identity cannot accept an older result.
3. A same-owner replacement requires same-document, same proven user/slot
   evidence and a ready replacement body; commit it atomically. Contradictory
   or missing proof must not weaken identity conflicts or revive stale GET data.
4. Body, surface and visual readiness are separate. Asset preparation cannot
   delay toolbars, Directory or ordinary text copy. Pure visual content gets an
   explicit readable block, never an empty-message rejection.
5. Canonical content is immutable. Output preferences never rewrite the source
   or annotation spans. Blocks and assets bind to the captured revision.
6. Resource jobs have byte/node/time/dimension budgets, cancellation and owner
   cleanup. Printing retains resources until print-context cleanup. No stale
   jobs, resource URLs or leases survive their documented owners.
7. Unknown/unavailable visuals produce visible, typed placeholders. A remote
   or expired Blob URL is not an offline asset. Single-block failure preserves
   the remaining document; explicit cancellation ends delivery.
8. Keep one content pool, one content observer, one body compiler and one shared
   asset preparation path. Output adapters only choose replacements and own a
   lease. Resource cleanup has one lightweight callback, no new manager, timer
   or persistent asset store. Extend structural predicates within this path;
   do not create a component-specific extraction pipeline for each new layout.

## Execution sequence

### 0. Preserve the baseline

- [x] Inspect existing changes, run smoke/build, commit current work.
- [x] Create the implementation branch after the baseline commit.

### 1. Prove and strengthen pool lifecycle

- [x] Add failing real-entry tests for native sibling action rows arriving late.
- [x] Reset owner/generation evidence on a route epoch change.
- [x] Prove atomic same-owner replacement, streaming completion and late GET
      non-revival; reject different-user, duplicate and cross-document proof.
- [x] Add ABA/dispose and ordinary-unmount async capture regressions.
- [x] Let the body compiler decide meaningful content instead of a text-only
      HostMonitor guard; retain all identity/action-row gates.
- [x] Run focused lifecycle tests before starting the shared-body stage.

### 2. Share body compilation and retain rich blocks

- [x] Add reduced DIL/visual fixtures and failing current-message/pool parity tests.
- [x] Extract one body compiler; retain thin wrappers for clone ownership and
      pair budgets. Preserve proven whitespace/code/math behavior.
- [x] Introduce a small immutable rich-block sidecar with canonical image
      bindings; reuse existing SemanticContent spans for output projection.
- [x] Capture cheap self-contained SVG/image/chart source while mounted; keep
      live DOM handles and heavy capture outside the semantic repository.
- [x] Sanitize SVG and validate resource types, URLs and size before use;
      never execute captured HTML, SVG scripts or event handlers.
- [x] Include block/source digests in idempotency, clone/freeze and Reader views.

### 3. Prepare bounded assets and common output

- [x] Implement explicit, cancellable asset preparation with revision fences,
      bounded cache/leases, SVG originals and PNG compatibility.
- [x] Capture supported HTML/canvas visuals only in the content driver; use
      available sources or a descriptive failure for inaccessible/offscreen blocks.
- [x] Use one semantic block projection for plain MD, offline ZIP, Reader,
      PDF and PNG. Internal asset references must never leak into saved MD.
- [x] Package `.md`, actual local `assets/` and a verifiable manifest.
- [x] PDF/PNG placeholder mode must start no visual resource/capture jobs.
- [x] Cover hostile SVG/URLs, duplicate blocks, stale revisions, budgets,
      resource failure, cancellation and print resource lifetime.

### 4. Connect user entries and Reader sessions

- [x] Add Markdown offline ZIP and PDF/PNG visual/placeholder choice to the
      existing Save Messages flow; default to static visuals when relevant.
- [x] Preserve stable selection, progress and cancellation across output formats.
- [x] Keep toolbar placement independent of body/asset admission; prevent
      chart controls from being mistaken for message actions.
- [x] Show pure-visual and newly obtained Directory entries without waiting
      for assets, retaining focus/position and existing navigation semantics.
- [x] Render the same rich document in page Reader and detached Reader.
- [ ] Verify a versioned session-bound extension-origin resource transport;
      do not send Blob/ArrayBuffer through JSON runtime messaging or add base64.
      Same-origin relay/lease behavior must be verified in both browser targets.

### 5. Authoritative documentation and closeout

- [x] Add a dated ADR for the final rich-content/lifecycle decisions and update
      CURRENT_STATE, DEPENDENCY_RULES, RUNTIME_PROTOCOL and docs/README links.
- [x] Update FEATURES, design, executable test gates and English CHANGELOG.
- [x] Run focused tests, discovery, core, smoke, acceptance, type checks, both
      builds, structural image correctness and whitespace validation.
- [ ] Complete installed-browser performance/image/transport acceptance after
      the user manually loads the verified build; no policy workaround is allowed.
- [x] Verify real component trigger paths and inspect rendered output. Keep fixture,
      installed-extension, Firefox and native PDF evidence separate.
- [x] Record exact remaining limits rather than describing untested types as
      universally captured. Do not publish, push or claim release completion.

## User-facing output contract

Plain MD retains readable text/math/code/table content, chart data where
extractable, and explanatory visual placeholders. Offline ZIP adds actual
local files and standard relative Markdown image references. PDF/PNG uses
static visuals when enabled; disabled or failed visuals use the same block
description at the same source position. SVG/PNG channel selection is internal.
The visual option does not disable ordinary formula/code/table semantics or
change stored annotations. No extra per-block configuration is required.

## Required regression matrix

Native/legacy/DIL roots; mixed and visual-only messages; late official row;
stop/copy overlap; assistant-only prompt enrichment; history prepend and
disjoint mounted windows; same-ID edits and same-owner new-ID regeneration;
branch/route switches and ABA; unmount/remount/BFCache/dispose; SVG-only visual
changes; unknown blocks; inaccessible iframe/canvas/resources; cancellation
and size/time limits; same selection/order across all outputs; detached
session ownership; print-preview resource retention; Chrome MV3/Firefox MV2.

## Implementation and verification log

- Lifecycle first red run: 6 failed / 83 passed; final phase-focused 8 files /
  197 passed, including atomic/reverse/multiple replacement, late GET, ABA and
  ordinary unmount. Type check and whitespace passed.
- Shared compiler/projection: 13 files / 95 passed. Additional red tests caught
  nested formatting becoming indented code and escaped labels becoming math.
- Data propagation: 10 files / 149 passed. Reader/session integration, late-cancel
  races and dependency checks: final 7 files / 93 passed. No layer allowlist was
  relaxed. Dedicated hidden-chart path mutation proof: 4 files / 107 passed.
- Save Messages UI: 5 files / 64 passed, with real pointerdown/click triggers,
  PDF readiness/cancel, frozen selection, stale callbacks and degradation status.
- A real Chrome HTTP component preview downloaded an offline ZIP containing
  conversation.md, SVG, PNG and manifest. ZIP CRC passed; Markdown uses local
  relative paths. This is actual component output, not installed-extension proof.
- Full core first run: 2614 passed / 5 failed (323 files). The client layer move,
  legacy cache behavior and ordinary image selection differences were fixed;
  the existing 200-round navigation test timed out during concurrency but its
  isolated three-file triage passed 73 tests. The final two-worker core run passed
  as recorded below; the original instability remains part of this record.
- Independent review found and closed external SVG-definition fallback and
  aggregate synchronous bitmap encoding budget gaps. Pixel captures now refresh
  on each explicit action; sealed SVG cache keys include source/dimensions and
  key memory. Relay handshakes use a fixed extension origin. Copy PNG was also
  verified through its actual toolbar trigger and shared asset preparation.
- Native SVG currentColor was first reproduced failing, then closed only from
  SVG-owned safe colors. The complete live sample sanitized successfully at
  340x208 without currentColor or external-resource dependencies.
- Pure Node structural PNG encoder/planner/decode benchmark passed. Browser
  performance harnesses are not substituted for the blocked installation flow.
- Browser policy rejected chrome://extensions and explicitly forbids alternate
  routes, CDP or browser-command workarounds. No such workaround was used.
  Installed Chrome/Firefox relay partition/decoding and native PDF acceptance
  remain unchecked until the user reloads/loads the concrete built extension.
- Final identity review reproduced six outer/inner carrier mismatch failures and
  a detached-owner conflict; consistent owned-carrier evidence now gates capture,
  placement and immediate Copy even before observer reconciliation. Quoted/code/
  tool identities are excluded and legacy messages without carriers still work.
- The first final build caught a transitive dynamic import in classic content.js.
  Four failed startup/teardown/RPC regressions preceded a fix through the existing
  lazy facade. The final Chrome/Firefox builds, classic-entry checks and passive
  single-pool boundary checks passed without relaxing any gate.
- Final code-frozen verification: core 325 files / 2670 passed (two workers),
  smoke 7 files / 56 passed, acceptance 33 files / 466 passed, discovery 31 files /
  585 passed, TypeScript passed and git diff --check passed. The earlier core
  failure remains recorded above; no test timeout was increased.
- Bundle-size diagnostic remains red against historical limits: each target's
  background is 181.40 kB raw / 50.54 kB gzip (limits 150/40), and the content
  feature graph is 1995.21/546.80 kB (limits 1720/465). Baseline build output was
  already over the background and feature-graph raw limits (about 175.15 and
  1755.57 kB); this change also adds size. This diagnostic is not reported green
  and does not replace the current executable gates.
- Chrome real-component desktop and constrained-width UI was inspected in English
  and Chinese. The downloaded offline ZIP's CRC passed and it contains Markdown,
  native SVG, PNG and manifest with local relative references. Full screenshot
  and ZIP evidence are saved outside the repository in the task artifact folder.

## Installed Chrome follow-up (2026-10-08)

- After the user reloaded the extension/page, four observed extension chunk names
  matched the concrete local build. All five obtained replies had toolbars and
  Directory entries; the latest rich reply was reachable as item 5/5.
- The real message-menu Reader entry rendered six visual blocks. Every image
  decoded with nonzero native dimensions: the 340x208 diagram, three HTML
  blocks and two 768x432 charts. This proves page Reader, not detached decoding.
- The real message-menu offline ZIP export completed with six included blocks,
  seven asset files (SVG plus its PNG alternative, and five other PNGs), Markdown
  and manifest. CRC passed and no aimd-rich/blob references leaked into Markdown.
  The saved chart PNG was visually inspected. Evidence stays outside the repo.
- This acceptance exposed numeric metric rows being treated as article headings.
  Two failing tests preceded the initial fix; a three-column failing test then
  removed an unjustified two-column assumption. The final structural rule accepts
  at least two direct column boxes, each with a numeric tabular title and caption.
  It claims the whole row once; ordinary headings and incomplete rows stay semantic.
- Lifecycle review reproduced a second-pagehide cleanup failure after BFCache
  restoration. Removing the once-only listener fixes it without a new observer.
  Asset teardown also reproduced failures for page Reader/export/Copy PNG before
  any detached manager existed. Cleanup now registers at the shared driver module
  boundary; unused teardown stays cold and running decode jobs are cancelled.
- Independent review found no reason to merge pool, render and resource lifetimes
  into one state machine; their owners fence different asynchronous boundaries.
  No second content pool, acquisition observer, transport or persistent store was
  added by these follow-up fixes.
- The actual page-toolbar entry opened a detached Reader tab. Browser policy
  rejected inspection because chrome-extension URLs are blocked; no workaround
  was used. Its visual decoding remains pending user confirmation, and Firefox
  installation transport remains untested.
- PDF's real export dialog exposed both image and text-placeholder options. The
  placeholder path was invoked, but automation could not inspect the native print
  preview; its appearance/output remains pending user confirmation. Do not count
  this as a completed native PDF acceptance.
- Follow-up corrections require another extension reload before installation
  acceptance can claim the final numeric-row and teardown changes.
- Final follow-up verification: core 326 files / 2683 passed (two workers), smoke
  7 files / 56 passed, TypeScript passed and Chrome/Firefox builds passed. Both
  classic-entry and passive single-pool boundary checks remain intact. All three
  corrections had failing reproducers before implementation. Whitespace passed.
