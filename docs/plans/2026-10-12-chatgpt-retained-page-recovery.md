# ChatGPT retained-page recovery

## Scope and evidence

Reported symptom: Directory and reply controls disappear after switching
conversations inside ChatGPT. Preserve the shared content chain and the existing
uncommitted visual upgrade; no consumer-specific recovery loop.

On 2026-10-12, the installed Chrome extension initially showed four Directory
entries and four reply toolbars in the existing reading-position test conversation.
After Home and a sidebar switch to another existing test conversation:

- The URL changed before the new Conversation region mounted (about 900ms in
  this observed switch; this is evidence, not a timing contract).
- The original conversation, Home and the new conversation had three connected
  `main` elements. Ancestor `data-app-shell-active-page` values were false, false,
  true. Inactive workspaces also had inline `display: none !important`.
- The old four assistant nodes and toolbars remained in the first hidden main.
  The new four replies and their native action controls were present, but had no
  extension toolbars. The Directory was empty and hidden.
- The existing observer already covered `documentElement`; discovery and adapter
  root selection kept choosing the first main. This was an ownership error even
  when the delayed content mutation was received.

Only DOM structure and lifecycle metadata were inspected. No prompts were sent,
no conversation requests were constructed and no private React state was used.
Temporary diagnostic observation must be removed before completion.

## External loading guidance

[MDN popstate](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event)
distinguishes updated location from document readiness and notes that pushState
and replaceState do not themselves fire popstate.
[React Suspense](https://react.dev/reference/react/Suspense#preventing-already-revealed-content-from-hiding)
documents retaining revealed content during transitions and staged nested
content. This explains why such timing is valid; it does not establish which
private React mechanism ChatGPT uses.
[Node.isConnected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected)
only proves document connection, not current-page ownership.
[MutationObserver.observe](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe)
supports observing the stable ancestor already used here. Reuse that observer
and narrow activity/identity/action signals rather than adding fixed sleeps.

## Implementation sequence

1. Reproduce in installed Chrome and record the retained-page DOM shape — done.
2. Add failing tests at PageIndex/adapter, Runtime/Surface, and actual
   Directory/Toolbar composition seams — done. New tests failed on old-page
   selection, missing activity events and stale Directory entries before fixes.
3. Introduce one stateless active-surface resolver, retaining legacy scoped
   fallback while rejecting ambiguous modern app-shell ownership — implemented.
4. Extend the existing PageIndex attribute filter with the host activity marker;
   publish structure/rebase facts without extra observers or timers — implemented.
5. Run focused regressions, required automated gates and both builds — done,
   including the final post-cleanup build.
6. Reload the website with the current extension build and repeat sidebar/Home/
   cached-page switching; document installed-browser limitations — done in Chrome.

## Contracts and edge cases

- The activity marker is host DOM evidence and may evolve; it never becomes a
  stored conversation/message identity. Existing route and exact message IDs
  still own semantic scope.
- A unique active owner can be empty while loading. Old connected pages must
  not supply readiness, scroll targets, streaming controls or message content.
- Zero/multiple active owners and nested marked owners yield no current surface. Real later mutations
  recover it; no one-shot cutoff is introduced.
- Cached-page activity-only switching must clear old mounted controls, restore
  the selected conversation's pool and mount one toolbar per ready reply.
- Delayed body and native action rows continue through the existing Host Monitor
  readiness and bounded coalescing. No longer fixed wait is added.
- Existing ordinary single-main and adapter-scoped legacy shapes remain covered.

## Verification

Final automated results:

| Gate | Result |
| --- | --- |
| Core (`--maxWorkers=1`) | 329 files / 2708 tests passed, 221.41s |
| Acceptance (`--maxWorkers=1`) | 34 files / 475 tests passed |
| Discovery (`--maxWorkers=1`) | 31 files / 593 tests passed |
| Smoke | 8 files / 57 tests passed |
| Type checking | Passed |
| Chrome + Firefox build | Passed, including final post-cleanup rerun and entry/boundary checks |

Installed Chrome acceptance after the user reloaded the unpacked extension and
the website was refreshed:

| Current page | Directory | Current reply toolbars | Inactive-page toolbars |
| --- | --- | --- | --- |
| Original test conversation A | 4 | 4 | 0 |
| Sidebar switch to conversation B | 4, B prompt labels | 4 | 0 |
| Home with both conversations retained | 0, rail hidden | 0 | 0 |
| Cached B return | 4, B prompt labels | 4 | 0 |
| Cached A return | 4, A prompt labels | 4 | 0 |

The original user conversation was restored. Its final three connected app-shell
owners contained Home/A/B, with activity false/true/false; total toolbars remained
four. No warn/error entries were observed in the final page check. Temporary
diagnostic observation, the local screenshot tab and its loopback receiver were
removed. Screenshots are in the task artifact folder
`route-recovery-2026-10-12/before.jpg` and `after.jpg`. Firefox installed acceptance
was not run; dual-browser packaging and automated contracts passed.

Earlier failures and their resolution remain recorded:

- Bottom-level focused suites: 6 files / 118 tests passed, including nested-owner
  rejection and the existing no-topology-query-on-character-update guard.
- Runtime and actual Directory/Toolbar composition: 2 files / 29 tests passed.
- Smoke: 8 files / 57 tests passed. Type checking passed.
- Latest Chrome and Firefox builds passed, including classic entry format and
  single-pool boundary checks. The first sandbox attempt was blocked on tsx IPC;
  the same build succeeded with the required local IPC permission.
- Initial concurrent discovery run: 591 passed, one 200-round navigation timeout.
  Initial concurrent acceptance: 472 passed, one 200-round PageIndex timeout and
  one canonical formula selection mismatch. A separate three-file run passed the
  formula assertion but repeated the navigation timeout. Its nested test failure
  was recorded while that new red regression was being added; the final focused
  run above includes the completed nested-owner fix.
- The navigation case passes alone (228ms). A temporary archive of pre-change
  HEAD `2a03ba6c` reproduces whole-file fixture accumulation: 44 cases take
  28.60s, with the 200-round case at 15,050ms. Disposing fake adapters' shared
  PageIndex after each case reduces that baseline to 3.33s total / 616ms for
  the case. The current branch with only that test-cleanup correction passes
  all 44 cases in 2.63s. No production navigation logic or timeout changed.
- The first full-core run was interrupted after repeating that known navigation
  failure; a fresh full-core run includes the corrected fixture cleanup.
- A website-only reload initially used the old installed behavior. The user's
  subsequent extension reload plus a website refresh enabled the installed
  acceptance above; the first reload was not counted as successful validation.

Red evidence is stored in local task logs:
`/private/tmp/aimd-route-consumers-red.log` and the focused lifecycle/adapter
test outputs. Repairing current activity does not claim complete remote history.
