# Storyboard

**Format:** 1920x1080
**Duration:** 35 seconds
**Audio:** English TTS voiceover + low electronic underscore if available
**VO direction:** Confident and crisp, with product-launch urgency and short pauses
**Style basis:** `DESIGN.md`, current AI-MarkDone homepage, and real plugin token values

## Global Direction

The product UI must look like AI-MarkDone: neutral-first surfaces, compact controls, product-blue active states, small labels, and believable Reader/Bookmarks/Toolbar geometry. The overall film is light-first: white canvas, pale blue depth, soft shadows, and generous product spacing. The advertising layer is allowed to move with energy through camera pushes, kinetic captions, blue light sweeps, and overlapping scene transitions. The video should feel like a polished SaaS launch film built from real extension UI.

## Asset Audit

| Asset | Type | Assign to Beat | Role |
|:--|:--|:--|:--|
| `capture/assets/icons/ai-markdone-icon.png` | Logo | Beats 2, 7 | Product reveal and CTA |
| `capture/assets/icons/app-icon_hu_d20be2bd1ccb9322.png` | Logo | Beat 7 | Compact brand mark for the final install CTA |
| `capture/assets/icons/google-chrome.svg` | SVG | Beat 7 | Chrome install CTA |
| `capture/assets/icons/firefox-browser.svg` | SVG | Beat 7 | Firefox install CTA |
| `capture/assets/home/ai-markdone-chatgpt-reader-toolbar.gif` | Product GIF | Beats 2, 3 | Toolbar and Reader entry proof |
| `capture/assets/home/copy-chatgpt-selection-to-markdown.gif` | Product GIF | Beat 5 | Partial Markdown copy proof |
| `capture/assets/home/chatgpt-reader-sticky-excerpts-pin-important-content.png` | Screenshot | Beat 5 | Sticky excerpts proof |
| `capture/assets/home/chatgpt-reader-dynamic-annotation-prompt.gif` | Product GIF | Beat 5 | Dynamic Annotation proof |
| `capture/assets/home/chatgpt-reader-heading-outline.png` | Screenshot | Beat 3 | Reader outline proof |
| `capture/assets/home/chatgpt-reader-message-switching.png` | Screenshot | Beat 3 | Message switching proof |
| `capture/assets/home/chatgpt-latex-formula-copy-export.png` | Screenshot | Beat 5 | Formula export proof |
| `capture/assets/home/chatgpt-bookmark-manager-folders-search.png` | Screenshot | Beat 6 | Bookmarks proof |
| `capture/assets/home/export-chatgpt-markdown-pdf-png.png` | Screenshot | Beat 6 | Export proof |
| `capture/assets/home/ai-markdone-chatgpt-extension-settings.png` | Screenshot | Beat 6 | Settings proof |

## Beat 1 — Hook (0:00-0:04)

**VO:** "ChatGPT can answer almost anything. But serious work needs more than scrolling and copying."

**Concept:** The viewer drops into a long ChatGPT thread already in motion. It feels useful but messy: dense answer blocks, equations, code, and copied fragments moving too quickly. The problem is not that ChatGPT lacks content; the problem is that serious work needs structure.

**Visual:** A light ChatGPT-like page scrolls vertically inside a browser window. Text blocks, code cells, formulas, and copy fragments peel out as white floating cards with blue state accents. Kinetic words "SCROLLING" and "COPYING" stamp in, then the scene compresses.

**Transition:** The product reveal overlaps the final hook motion with a soft light sweep and camera push.

## Beat 2 — Product Reveal (0:04-0:08)

**VO:** "AI-MarkDone turns ChatGPT into a focused reading and capture workspace."

**Concept:** The chaos snaps into a precise extension layer. The AI-MarkDone icon appears, the message toolbar locks onto a ChatGPT answer, and a Reader surface unfolds.

**Visual:** Real toolbar GIF appears in a tilted browser frame. A blue focus ring draws around the toolbar. The Reader panel expands from the answer surface. Large caption: "A focused workspace for ChatGPT."

**Assets:** `ai-markdone-chatgpt-reader-toolbar.gif`, `ai-markdone-icon.png`

**Transition:** Velocity-matched upward into Reader with the Reader surface fading in over the toolbar stage.

## Beat 3 — Reader (0:08-0:14)

**VO:** "Read long answers."

**Concept:** The frame becomes calm and spacious. Long answers are no longer a wall of scrolling text; they are a structured reading surface.

**Visual:** Reader panel with Markdown content, heading outline, and message switching controls. Screenshots of heading outline and message switching slide behind the live mock as proof cards. The camera slowly pushes in on clean Markdown hierarchy.

**Assets:** `chatgpt-reader-heading-outline.png`, `chatgpt-reader-message-switching.png`

**Transition:** Smooth slide-and-fade into the directory rail while the Reader panel remains visible beneath the first frames of the next scene.

## Beat 4 — Navigation Rail (0:14-0:19)

**VO:** "Navigate long threads. Keep your place."

**Concept:** This is the standout moment. A long ChatGPT conversation stretches vertically while AI-MarkDone's optional right-side directory rail becomes a command surface for the whole thread.

**Visual:** Official ChatGPT page mock in the center. On the right, AI-MarkDone directory rail shows `#1` to `#12`; the active item glows blue, bookmarked items show green saved markers, and hover expands entries into prompt labels. The camera jumps between thread positions as the rail selects different items.

**Transition:** Soft blue wipe into capture tools.

## Beat 5 — Capture (0:19-0:25)

**VO:** "Copy exactly what matters, with Markdown, code, formulas, and notes intact."

**Concept:** The product becomes a precision toolkit. Selection, Markdown, formulas, Sticky, and Annotation move as one workflow rather than separate features.

**Visual:** Four proof cards cascade in: partial copy GIF, formula export screenshot, Sticky screenshot, Annotation GIF. A selected passage turns into a Markdown card. A formula popover flashes "LaTeX / PNG / SVG / MathML."

**Assets:** `copy-chatgpt-selection-to-markdown.gif`, `chatgpt-latex-formula-copy-export.png`, `chatgpt-reader-sticky-excerpts-pin-important-content.png`, `chatgpt-reader-dynamic-annotation-prompt.gif`

**Transition:** Overlapping whip pan into saved knowledge.

## Beat 6 — Save and Export (0:25-0:31)

**VO:** "Save, search, and export your best answers when the work leaves the chat."

**Concept:** The scattered conversation becomes a reusable library. Bookmarks, search, preview, and export options make the answer portable.

**Visual:** Bookmarks panel takes center stage with search, folders, and preview. Export cards for Markdown, PDF, PNG, and ZIP count in. Settings screenshot appears as a small proof card showing user control.

**Assets:** `chatgpt-bookmark-manager-folders-search.png`, `export-chatgpt-markdown-pdf-png.png`, `ai-markdone-chatgpt-extension-settings.png`

**Transition:** Cinematic zoom to CTA.

## Beat 7 — CTA (0:31-0:35)

**VO:** "AI-MarkDone. Read, save, export. Stay in flow."

**Concept:** End with the cleanest possible install moment. The product name, app icon, and install paths land with confidence.

**Visual:** AI-MarkDone icon centered above the product name. Three install routes appear: Chrome Web Store, Firefox Add-ons, GitHub. Final subtitle locks to "Read, save, export. Stay in flow."

**Assets:** `ai-markdone-icon.png`, `google-chrome.svg`, `firefox-browser.svg`

## Production Architecture

```text
videos/ai-markdone-promo/
├── index.html
├── DESIGN.md
├── SCRIPT.md
├── STORYBOARD.md
├── narration.wav
├── transcript.json
├── capture/
│   ├── assets/
│   └── extracted/
└── package.json
```
