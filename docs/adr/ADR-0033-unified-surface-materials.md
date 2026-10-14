# ADR-0033: One material layer for product surfaces

## Status

Accepted, 2026-10-08. Execution and acceptance evidence live in the
[upgrade plan](../plans/2026-10-08-unified-surface-visual-upgrade.md).

## Context

Library and Settings had a common workspace appearance while Prompt, export,
Send and Reader subwindows retained separate field/button/surface recipes.
Template editing also inherited different styles depending on its entry point.
Copying workspace CSS into each feature would preserve this maintenance problem.

## Decision

- Existing Reference → System → Public tokens remain the only value source.
  `getSurfaceMaterialCss()` is a pure shared CSS module for neutral surfaces,
  chrome, cards, fields, buttons, native checks and semantic selected states.
  It has no DOM, settings, listener, cache or feature-data ownership.
- Compose geometry first and the material sheet last. Feature modules keep
  positioning, viewport constraints, scroll ownership and state semantics.
  Native controls keep their keyboard and accessibility behavior. Selected
  appearance reads existing ARIA/data states rather than a second UI state.
- Existing panel/modal aliases use the same material sheet; remove superseded
  workspace and feature recipes instead of adding overrides indefinitely.
- ReaderSettingsDialogShell owns the shared template layout for both Reader and
  global Settings. It injects the same scoped CSS into the actual owning root.
  Host-specific copies do not remain authoritative.
- Build the unsupported popup's stylesheet directly from `getPageTokenCss()` and
  the material sheet. It keeps its extension-document lifecycle and external
  script, without another palette table, framework or asynchronous style fetch.
- Keep appearance changes separate from acquisition, content identity, asset
  lifetime, annotations, settings schema, runtime protocol and backup writes.
  No new observer, content pool or style runtime registry is introduced.

## Consequences and verification

One material correction reaches every adopting surface. Family-specific geometry
can evolve without duplicating colors, elevations or control state rules. Narrow
and short viewports must retain one scroll owner and reachable actions; modal
gutters are applied once, and action labels wrap without shrinking short actions.
Focus, Escape, IME, cancellation and nested-dialog behavior remain owned by their
existing components and real trigger-path tests. Local production-component
screenshots, browser builds and installed-browser acceptance are separate proof.
