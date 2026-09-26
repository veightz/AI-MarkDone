# FAQ

## Which platforms does this extension support?

New features target ChatGPT, including its in-page and detached Reader. Previously saved bookmarks from other platforms remain available.

## Where do I find each feature?

- Library and Settings: click the extension icon
- Copy, bookmark, Reader and export: expand the capsule below an assistant reply
- Annotation and highlight: select text, then choose the annotation button or a color
- Formula copy: click a formula
- Message navigation: open the lower-right page controls
- Backup: Settings → Data & backup

## Why use Reader?

Reader provides a focused reading surface with fullscreen, message switching, source Markdown copy, annotations, and send controls.

## What are annotations for?

Select a passage and add a note. You can then copy the selected text and notes together, or insert them into the composer for a follow-up. Inserting does not send the message.

## Can I customize annotation templates?

Open Settings → Highlights & annotations. Prompts provide reusable instructions; the copy template controls the order and format of each passage and note.

## Are annotations and highlights saved?

Highlights are always saved in the current browser profile. Annotation persistence follows the existing “Keep annotations” setting; turning it off does not delete previously saved annotations.

Browse annotations and highlights by conversation in Library, or open their source pages.

## Can I copy just part of a reply as Markdown?

Select text on the ChatGPT page or in Reader and choose Copy. Mixed text, formulas, code and lists retain their Markdown structure.

## How do I copy a formula?

Click it in the original reply. Inline formulas use `$...$` and display formulas use `$$...$$` by default. Change delimiters and formula image actions under Settings → Copy & export.

## What can bookmarks save?

Bookmarks save a page link or a message. Message bookmarks include saved content for previewing and copying. Folders organize bookmarks into up to four levels.

## How do I manage many bookmarks?

Choose a folder on the left, or search. Lists show 20 items per page. Use the row buttons to rename, move or delete a bookmark; use the folder menu for folder actions. Filters, sorting, import, export and selection controls sit beside the Library heading.

“Select this page” selects the current page. “Select all bookmarks” and “Invert bookmarks” apply across all results matching the current filters. Paging preserves selection; changing the folder, type or search clears it. A single folder must be empty before deletion. Bulk folder deletion includes its bookmarks and subfolders, with counts shown before confirmation.

## How does export work?

Choose Export, select messages, then choose Markdown or PDF. Markdown stays editable; PDF preserves a document layout. Batch export is supported.

## Can I hide buttons or change the theme?

Use Settings → Buttons & shortcuts. Theme, font size and accent color are under Appearance & layout. Theme can follow the page or use light or dark mode. Search finds controls across all eight categories.

## Where does Google Drive backup save my data?

The experimental backup flow stores your saved bookmarks, highlights, annotations, and their folders in your own Drive under `AI-MarkDone/Backups/bookmarks`. It excludes unsaved annotations, extension settings and OAuth credentials. A full local Library export contains the same saved items. Older bookmark-only files still import and affect bookmarks alone.

Backup verifies the uploaded snapshot. Restore shows a merge preview: local-only items remain, duplicates are skipped, and conflicts keep the local copy by default. This is not real-time synchronization.

Manage cloud files or test the connection under Data & backup. Trashing a Drive backup does not delete local Library data. Sign out revokes the current Drive grant and clears its cached authorization. An interrupted upload can leave a file in Drive; failed verification reports whether cleanup is needed.

## How do message navigation and the directory work?

Open the lower-right controls for previous/next navigation. Left and Right arrow keys also navigate when you are not typing, if enabled. Configure the directory, official navigation visibility and jump behavior under Reading & navigation.

## What does the character count include?

The existing Chars calculation counts each CJK character as two and Latin text by its counted characters after punctuation handling. Fenced code, inline code and formulas are excluded. A reply containing only code shows zero.

The optional time below the count comes from the website's message metadata: update time first, creation time otherwise. It is omitted when unavailable.

## Is AI-MarkDone paid?

AI-MarkDone is free. Feedback, reviews and optional support help its development.
