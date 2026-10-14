# Annotation, content fidelity, and bilingual writing upgrade

Status: local implementation and verification complete; maintainer copy review pending. Branch: `codex/annotation-content-copy-upgrade`.

Feedback acceptance remains partial: annotation behavior has stronger extension/storage verification, code feedback required a follow-up native-DOM adaptation, and the reported Safari missing-history/wrong-location issue is not resolved by the Directory error-message change. See the feedback-specific retest record below.

## Scope

Upgrade ChatGPT annotation editing, preserve Markdown structure through shared content paths, strengthen Reader/export output, and review all shipped Chinese and English application copy. Preserve the pre-existing PDF isolation changes. Chrome MV3 and Firefox MV2 remain the implementation and acceptance targets.

## Checklist

- [x] Read the three Gmail feedback threads and trace current production paths.
- [x] Read Apple HIG Writing and Shopify app content guidance.
- [x] Create an implementation branch and back up pre-existing uncommitted changes outside the repository.
- [x] Inventory bilingual strings, hardcoded application copy, and long content requiring maintainer review.
- [x] Reproduce testable content and annotation regressions before changing implementation.
- [x] Upgrade the shared annotation editor: nonmodal reading, drag, collapse/expand, explicit discard, save/error states, and local draft recovery.
- [x] Preserve code fences, language, indentation, blank lines, and inline-code/paragraph boundaries.
- [x] Verify source-content settings and source-only updates across Reader/copy/export.
- [x] Improve PDF wide-content layout, pagination, and resource readiness without changing the shared source contract.
- [x] Polish Chinese and English application writing and retain interpolation/placeholder contracts.
- [x] Update authoritative design/architecture/feature/writing documentation and the English changelog.
- [x] Run focused regression tests, core/smoke/acceptance checks, type checking, and both browser builds.
- [x] Verify rendered annotation interactions and representative bilingual application surfaces.
- [x] Deliver the concrete maintainer review list and distinguish automated, fixture, and installed-extension acceptance.

## Acceptance principles

- Drafts and saved annotations are different states. Draft recovery does not change `reader.persistAnnotations` or place unfinished writing in annotation exports/counts.
- Closing, minimizing, switching views, save failures, and stale async completions must not silently discard or misattribute writing.
- Shared semantic content remains authoritative. Current-message DOM actions and historical snapshot consumers retain their documented boundaries.
- The same sample corpus must retain equivalent text/code/math/table meaning in Markdown, Reader, PDF, and PNG; interactive and print layouts may differ.
- Labels name actions, settings explain their enabled behavior, and errors describe a useful next step. Chinese and English should read naturally rather than mirror each other word for word.
- Human review focuses on onboarding, long help/about content, product positioning, and storage/privacy promises. Routine labels and feedback are completed autonomously.

## Writing references

- [Apple Human Interface Guidelines: Writing](https://developer.apple.com/design/human-interface-guidelines/writing)
- [Shopify app design: Content](https://shopify.dev/docs/apps/design/content)

## Existing work boundary

Before this task, nine tracked files and one untracked PDF integration test were already changed on `codex/fix-message-pdf-export`. A binary diff and the untracked test were saved under `/private/tmp/aimd-20261007-existing*`. New PDF work must extend and preserve that implementation; verification results from an earlier chat are not current acceptance evidence.

## Review and verification record

- All 1,370 original locale keys were individually reviewed in both languages; 354 existing keys changed and 25 were added. The resulting catalogs contain 1,395 keys each. The grouped maintainer review is [here](../reviews/2026-10-07-bilingual-copy-review.md).
- Focused regressions were run failing before implementation and passing after: annotation loss/close-save races and target isolation, source/Markdown/code preservation, PDF image readiness, Directory failure feedback, and localized startup/image actions.
- The annotation textarea now retains an explicit localized accessibility name after text is entered. Shared-editor and real Page trigger assertions failed before the fix and passed after it; final core/build verification includes this change.
- The first full core run found 14 obsolete copy/action assertions; their updates retained the behavior and locale checks. A subsequent concurrent core/visual run passed 2,475 tests but timed out in the existing 200-round Directory navigation test at 15 seconds. Concurrent acceptance also failed a time-sensitive canonical-formula projection case. These results remain recorded; final core/acceptance verification is being rerun without browser workloads.
- Final isolated core passed 2,477/2,477 tests across 310 files after the performance-harness regression was added; smoke passed 55/55; isolated acceptance passed 444/444. Type checking and the final Chrome/Firefox builds passed. The first sandboxed build could not open the build tool's local IPC pipe; the unchanged build completed in the permitted local build environment.
- Library/Settings full matrices passed in Chromium and Firefox: 164/164 cases with no console/page errors or horizontal overflow. Final annotation matrices using the production catalogs passed another 82/82 cases. Separate native-pointer interaction runs passed 16/16 cases across both engines, both languages, themes and desktop/narrow widths; they check outside reading, collapse/expand, drag containment, close/reopen recovery and visible restored windows.
- A synthetic browser PDF sample contains 25 A4 pages. Code/table geometry has no horizontal overflow, display math fits, and extracted text retains the code start/end, following paragraph, final table row and document-end markers. Representative pages were rendered and inspected. Extreme formulas can become small; this verifies the print document, not an installed extension's native print dialog.
- Installed Chrome/Firefox ChatGPT feedback reproduction and native Firefox print acceptance remain separate and have not been claimed by fixture/build checks. James's Safari environment and unknown host code markup were not reproduced in this task.
- The performance benchmark used the removed annotation Cancel control and swallowed the resulting timeout. Its first two runs failed the post-editor selected-count check even though source formula copy, deferred projection counters and long-task guards were correct. The benchmark now samples the source selection before editor focus and explicitly closes the real editor; the original selection/clear requirements remain enforced. Its new governance regression passed, and the corrected isolated three-run benchmark passed with a 0.5 ms p95/max selection delta, 200 toolbars, no duplicate action rows and no startup export-renderer request.

## Feedback-specific retest

- Annotation: 18 checks passed with the built Chrome extension, its real background/runtime client and `chrome.storage.local` in an isolated persistent Chromium profile. Native selection, outside reading, drag, minimize/expand, close/discard, reload, full browser-process restart, annotation persistence preference, two-tab revision conflict and actual 10 MiB storage quota failure/retry were exercised. The host DOM and provider GET were fixture data; no user profile was modified.
- Code: supported legacy fixtures initially passed, but non-`pre` semantic code containers reproduced the customer's single-backtick/language-label/paragraph-joining failures. A real ChatGPT temporary reply confirmed those containers and native inline-code spans. The reduced live DOM is retained in `tests/testdata/chatgpt/semantic-code-blocks.html`; failing toolbar/parser tests preceded the narrow marker adaptation. Chromium/Firefox replay then passed 14 supported cases with native clipboard readback, Reader copy and Markdown/PDF/PNG semantic checks. The full captured reply matches the real ChatGPT official Markdown copy. Arbitrary unmarked `div > code` remains an ambiguous unsupported inference, not a claimed host adaptation.
- Directory: the implementation diff only adds localized failure feedback. New production-assembly fixtures prove existing 12-to-24 source admission, retained unmounted content, exact-target hydration and rejection of a wrong assistant ID. They do not reproduce or fix James's Safari environment. The existing 200-round navigation test again exceeded its 15-second limit during this retest, so that focused run is not reported as fully green.
- The browser policy blocked opening the user's extension-management page; no alternate route was used to inspect or reload it. The user's installed Chrome extension is therefore not claimed to have been updated. New-build acceptance uses an isolated profile instead.
- After the native code-marker fix, Chrome and Firefox builds passed again. A second isolated real-extension replay exercised automatic toolbar injection, native clipboard readback and the real Reader entry/copy against the captured body, including a native search-unit ancestor reconstructed from live observations. A deliberately stale GET body did not mask the DOM result. This replay is distinct from updating the user's installed extension or reproducing the customer's Safari account.
- Final follow-up validation: 2,485/2,485 core tests across 311 files passed in isolation, and both browser builds passed. Annotation real-extension acceptance passed 18 checks; ordinary/native code assembly passed 8 real-extension checks; Chromium/Firefox production-component code cases passed 14 supported cases. The additional native-unit fixture passed with one admitted assistant, one Surface entry, one Directory item and one toolbar, retaining stable identity through fallback-turn renumbering. These results do not close the original Safari feedback.

## Directory installation default follow-up (2026-10-08)

- Only a browser-confirmed fresh installation with no existing settings record starts with the Directory enabled. Updates, ordinary reads, old partial settings and existing explicit choices are preserved, including old users who never saved settings. Legacy normalization/reset behavior is unchanged.
- 20 real-background-event regression cases and the related settings/migration/import/i18n suites passed: 123 tests across 9 files. Type checking, Chrome/Firefox builds and whitespace validation passed.
- An isolated Chromium profile verified the actual extension installation event without prewriting settings: the stored Directory setting became true and a two-message directory appeared. After the user-facing settings request saved false, the rail hid and remained hidden after a full browser restart with the same profile. All five assertions passed with no console/page errors; no user browser profile was modified.
