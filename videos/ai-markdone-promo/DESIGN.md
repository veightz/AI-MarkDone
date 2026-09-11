# Design System

## Overview

AI-MarkDone is a browser-extension work surface for reading, copying, bookmarking, annotating, navigating, and exporting long ChatGPT conversations. The video identity should feel like a polished light-mode product launch: white canvas, airy spacing, precise product cards, soft blue focus, and smooth scene handoffs. Real AI-MarkDone surfaces are compact, tokenized, neutral-first, and Shadow DOM-like; the campaign wrapper may use camera pushes, glassy light sweeps, and kinetic subtitles as long as the product interface remains faithful.

## Colors

- **Light Surface**: `#FFFFFF` — primary AI-MarkDone panel and Reader surface.
- **Light Subtle Surface**: `#F6F7F9` — secondary panels, rows, and browser body.
- **Page Canvas**: `#F8FAFC` — primary video background.
- **Blue Wash**: `#EEF4FF` — subtle depth behind key product moments.
- **Primary Text**: `#111827` — main text.
- **Secondary Text**: `#374151` — labels and explanatory text.
- **Muted Text**: `#6B7280` — metadata and secondary UI hints.
- **Brand Accent**: `#2563eb` — active controls, focus, product pulses, CTA.
- **Brand Hover**: `#1d4ed8` — deeper blue for impact moments.
- **Success Accent**: `#10b981` — saved/bookmarked and completed states.
- **Warning Accent**: `#f59e0b` — formula/export emphasis when needed.
- **Danger Accent**: `#ef4444` — do not use decoratively.

## Typography

- **System Sans**: `ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif` for product UI and subtitles.
- **System Mono**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace` for Markdown, code, export labels, and formula source.
- **Product UI scale**: 12px small labels, 13px medium labels, 16px body, 18px panel titles, 26px in-product hero titles.
- **Video display scale**: large campaign type may exceed product scale, but product panels should stay compact and believable.

## Elevation

AI-MarkDone uses thin borders, neutral surfaces, and token shadows rather than decorative color blocks. Product panels should use rounded corners around 12-18px, 1px neutral borders, and soft shadows based on `0 18px 50px rgba(148,163,184,0.24)` or `0 28px 80px rgba(148,163,184,0.28)`. Advertising layers may add blue glow and camera depth outside the real UI, but should not tint the whole product surface.

## Components

- **ChatGPT Browser Stage**: simulated official ChatGPT page with long answer blocks, toolbar anchor, and dense conversation content.
- **AI-MarkDone Message Toolbar**: compact icon row with circular controls, subtle border, neutral surface, blue active/bookmark state.
- **Reader Panel**: large centered surface with Markdown hierarchy, heading outline, message switching, and quiet reading rhythm.
- **Right-Side Directory Rail**: optional AI-MarkDone rail for long ChatGPT conversations, with `#1`, `#2`, active state, bookmarked marker, hover expansion, and prompt labels.
- **Partial Copy Highlight**: selected passage with blue focus glow and Markdown output card.
- **Formula Export Popover**: small floating actions for LaTeX, PNG, SVG, and MathML.
- **Sticky / Annotation Layer**: side notes pinned beside Reader content, using the same neutral panel language.
- **Bookmarks Panel**: dense operational panel with sidebar folders, search, preview list, and action icons.
- **Export Cards**: Markdown, PDF, PNG, and ZIP tiles with product-blue focus.
- **Install CTA**: app icon, Chrome Web Store, Firefox Add-ons, GitHub.

## Do's and Don'ts

### Do's

- Use AI-MarkDone token colors and compact UI geometry for product surfaces.
- Use blue accent sparingly but decisively for state, focus, and CTA moments.
- Keep product UI believable: neutral panels, thin borders, small controls, readable Markdown.
- Use smooth overlapping transitions, camera motion, kinetic type, and light sweeps around the UI to create advertising energy.
- Show the right-side directory rail as an optional AI-MarkDone feature for long ChatGPT conversations.

### Don'ts

- Do not invent unsupported features or present the directory rail as ChatGPT's official native rail.
- Do not make product UI overly decorative, neon, dark-dominant, or gradient-heavy.
- Do not use multi-color decoration except for real saved/bookmarked/product states.
- Do not show more than Chrome Web Store, Firefox Add-ons, and GitHub as install paths.
- Do not modify AI-MarkDone extension source files for this video.
