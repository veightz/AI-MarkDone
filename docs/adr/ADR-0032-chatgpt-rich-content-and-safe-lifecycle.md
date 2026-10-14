# ADR-0032: Rich content and safe ChatGPT pool lifecycle

## Status

Accepted for implementation, 2026-10-08. Execution and verification status live
in [the implementation plan](../plans/2026-10-08-chatgpt-rich-content-lifecycle.md).
This decision does not claim that its pending capabilities are already shipped.

## Context

ChatGPT's rendered message can contain semantic prose, formulas and code as well
as DIL SVG images, chart widgets, HTML cards and opaque embedded content.
Converting every descendant to text loses graphics and leaks chart axes; dropping
all hidden nodes also discards chart accessibility data. A single Markdown string
does not describe visual source, capture state or a failed offline attachment.

Message identity, host position and visual component identity have different
lifetimes. Display keys and renderer-generated IDs cannot identify persistent
messages. Furthermore, a completed assistant body need not imply that all of its
images/fonts/widgets are ready, and virtualized unmount must not destroy obtained
content. Consuming same-owner identity changes without an epoch/user/slot proof
would let recycled DOM owners mix content between messages or conversations.

## Decision

- Retain the one PageIndex observer, one tab-local Repository, atomic Surface and
  one NavigationCoordinator of ADR-0024/0025/0026/0030. GET is an observed host
  seed, never an active extension request or a second content source.
- Validate provider message identity against its owner/role. Display ordinals,
  fallback search coordinates, component types, React IDs and chart IDs do not
  become persistent identity. Scope block IDs to one captured message revision.
  Existing message-owned selection/DIL carrier IDs must agree with the outer
  identity; partial hydration with contradictory IDs cannot replace its body.
- Reset owner/generation evidence at a route epoch transition. Check the epoch,
  exact owner identity and source revision after every asynchronous acquisition.
- Fence asset work on every pagehide, including after BFCache restoration.
  Register one cleanup callback at the shared asset-module boundary so page
  Reader/export/Copy PNG teardown never depends on opening a detached session.
  Cold teardown must not import capture capabilities.
- Replace an obtained assistant only with explicit same-document, same-user and
  same-slot evidence plus a ready replacement body. Apply content, ordering and
  superseded-source changes atomically. Failure must preserve the previous state.
  Old GET evidence must not resurrect an explicitly superseded assistant.
- Share a single DOM-to-body compilation core between current-message actions
  and pool capture. The current-message wrapper retains DOM-local readiness;
  the pool wrapper retains host completion, ordering and pair-budget rules.
- Reuse SemanticContent source/revision/spans and existing image/extension
  semantics. Add a small serializable rich-block sidecar; do not create a second
  Markdown AST. Output replacements use exact semantic image bindings, not global
  string substitutions. Output settings never mutate canonical source/spans.
- Consider a supported visual or an explicit opaque-visual placeholder meaningful
  content. Prompt enrichment remains optional. Assets do not gate pool admission,
  toolbar placement, Directory entries or plain text copy.
- Keep host selectors and live visual capture in content drivers. Obtain cheap
  self-contained sources while mounted. Rasterization/download happens only on
  an explicit Reader/output action, under byte/node/dimension/time limits.
  The source-side detached asset manager uses the existing lazy feature loader;
  no heavy asset module is statically imported by the classic startup entry.
- Treat all source SVG, resource URLs and relay messages as untrusted. No scripts,
  event attributes, active/remote references or captured HTML may execute. Do not
  relax CSP or sanitization, expose credentials or add broad host permissions.
- Keep assets in bounded transient ownership with cancellation and leases. DOM
  handles never enter the Repository. A Blob URL alone is not an offline asset.
  Reader and print resources survive until their actual owner is cleaned up.
- Add a Markdown/assets/manifest ZIP. Plain Markdown emits readable block fallback;
  PDF/PNG may include static visuals or placeholders. Placeholder policy must not
  start visual capture/resource jobs. Unsupported or failed blocks remain visible
  at their original source position without failing the whole document.
- Extend detached Reader only with a versioned, budgeted session-bound resource
  transport and existing sender checks. JSON runtime messaging must not be assumed
  to carry Blob/ArrayBuffer, nor may base64 or a new persistent asset store bypass
  that limitation. Cross-browser transport must be verified before claiming parity.

## Consequences

Consumers keep small read/subscribe/prepare-output boundaries. Platform churn is
contained in drivers, while all outputs share identity, order, body semantics and
visual fallback. Surface, body and asset readiness remain independently observable.
Unknown future components have a safe descriptive fallback; arbitrary cross-origin
frames and origin-tainted canvas are not promised to be universally captured.

The execution must prove real action-row and export triggers, stale/ABA/recycled
owner rejection, visual-only admission, superseded GET handling, output consistency,
resource lifetime and Chrome/Firefox parity. Existing history-status semantics and
bookmark/annotation identities stay authoritative throughout the migration.
