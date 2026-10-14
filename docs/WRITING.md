# Product writing

This is the writing authority for shipped AI-MarkDone interface text and authored help. Product vocabulary remains defined in [CONTEXT.md](../CONTEXT.md); behavior and persistence remain defined in [FEATURES.md](FEATURES.md) and the architecture contracts.

## Voice and language

- Use a calm, clear and practical voice. Adjust the tone to the task: direct for errors and deletion, helpful for first use, brief for routine feedback.
- Lead with what people can do or what happened. Use familiar words, active voice and one idea per sentence.
- Prefer specific verbs in buttons. Distinguish close, cancel, discard, delete, save, copy and export by their actual outcomes.
- Use sentence case in English interface labels and headings. Preserve product names, Markdown, LaTeX, JSON, PDF and PNG.
- Write natural Chinese and English independently while preserving the same behavior, scope and next step. Avoid translated idioms, unnecessary possessives, exaggerated claims and unexplained internal terms.
- Keep interpolation keys and substitution semantics unchanged. Example inputs must work with the current defaults.

## Interface patterns

- Buttons name the action. Add an object when the result would otherwise be ambiguous, especially for deletion, bulk actions and exports.
- Settings labels are short. Descriptions explain the enabled behavior and include a limit or persistence boundary only when it affects the decision.
- Errors state the outcome and an achievable next step. Do not blame the person, use playful apologies, expose raw protocol errors or promise that an uncertain operation completed.
- Empty states explain what belongs there and how to add it. Routine success feedback is brief and does not repeat the entire action.
- Long help uses short sections and concrete steps. Do not repeat a title as body copy or restate the same feature in several adjacent regions.
- Accessibility names describe the control and, when relevant, its current action or state. Do not depend on an icon, color, hover or placeholder alone.
- Describe saving precisely: local browser data, page-session state, drafts, saved annotations, settings files and manual backups have different lifetimes and contents.
- A timeout countdown is not an estimate of time to completion. A disconnected integration does not guarantee a provider-side authorization was revoked.

## Review ownership

Routine labels, field hints, status text and recoverable errors can be edited autonomously after checking the implementation. Maintainer review focuses on product/store positioning, first-use guidance, long About/FAQ content, privacy and storage promises, integration instructions and destructive scope. Supply complete bilingual proposed copy and the exact decision to review; do not ask the maintainer to approve every small label.

Historical release records, user-authored prompts, custom templates and stored content are outside a writing polish pass. Update current explanations without rewriting their historical facts or user data.

## README and release copy

- `README.md` remains the English GitHub entry; `README.zh.md` is the independent Chinese version, as confirmed on 2026-10-12. Keep their scope, entrypoints, saving rules and installation guidance aligned without forcing a literal translation.
- Treat README as a project landing page: a short product introduction, prominent installation links, screenshots, linked feature highlights and a compact getting-started section. Keep the author's reasons in the later support/about area; move detailed operating and saving rules into linked docs or collapsed FAQ. This replaces the longer personal-introduction structure after the 2026-10-12 reference review.
- Keep version numbers, release status and update summaries inside one dedicated README changelog section; do not scatter them through installation or feature prose or installation badges. Distinguish a version being prepared on a branch from a version available in a store or GitHub Release. Installation instructions must work for published artifacts; temporary Firefox loading belongs to development guidance.
- Keep `CHANGELOG.md` in concise English Added/Changed/Fixed sections. The bilingual release notes and in-app changelogs may use the author's conversational opening and practical numbered updates. Preserve feedback credits and previous release records.
- Versioned store-copy drafts live under `release/`. Names and short descriptions follow the locale catalog; long descriptions follow current feature and saving contracts, rather than stale public listings. Where stores have different installed versions, prepare the appropriate cumulative update summary.

## Verification

Check locale key parity, interpolation parity, hardcoded visible fallback copy, and the relevant user trigger. Verify representative Chinese and English screens, narrow widths, long content, keyboard labels and 200% reflow. A locale JSON check alone does not prove that the rendered text fits.

## References

- [Apple Human Interface Guidelines: Writing](https://developer.apple.com/design/human-interface-guidelines/writing)
- [Shopify app design: Content](https://shopify.dev/docs/apps/design/content)

These references inform the principles above; AI-MarkDone's documented behavior and terminology determine the exact copy.
