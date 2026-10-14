# Message Studio v3 implementation

Implemented from `Sriram_Advisory_Message_Studio_Product_Specification_v3_0.docx`, including its v3 additions in sections 16–21. The document's opening header still says v2.0; the implementation follows the later v3 requirements and phased delivery in section 20.4.

## Source and schema audit

The supplied LinkedIn formatter uses React 19, Tiptap 3, TypeScript and Vite. Its source document is a flat array of paragraphs with text, hard breaks, list metadata and ordinary-character formatting marks. Unicode output is derived, never the editable source. Templates, snippets, cleanup previews, undo, IME composition, emoji, clipboard fallback and service-worker update protections were retained.

The original IndexedDB database name remains `sriram-linkedin-formatter`, version 1, with `drafts`, `revisions`, `meta` and `migrationBackup` stores. Legacy schema-1 drafts remain readable with Quick Format, LinkedIn, General objective and no mandatory brief. A draft's optional `studio` property has `bundleSchemaVersion: 3`. On its first upgrade, the schema-1 payload is preserved without replacing an earlier schema-0 recovery payload in `migrationBackup` in the same guarded transaction as the new draft and recovery snapshot. Existing unknown or damaged records remain available for raw export. Set `VITE_DESTINATION_SELECTION_ENABLED=false` to disable switching while keeping all new data intact; this flag does not rewrite or clear versions. The supplied schema-0 migration also retains its original payload atomically.

`editorDocument` remains the original document for backward data continuity. `studio.versions` stores independent overrides and email subjects. `revision` is the record concurrency guard; `studio.originalRevision` and each version's `revision` track editorial changes. Switching modes or objectives does not rewrite content. Brief-only updates do not change output fingerprints.

This audits the supplied checkout. The deployed application's exact schema and real client paste behavior still require release verification before replacing the existing hosted application. No hosted deployment or Git commit was performed by this task.

## Pilot feature coverage

| Requirements | Implementation |
| --- | --- |
| F01–F03 | Original plus independently editable destination versions, selection-based source marks, synchronous exact-payload copying and manual fallback |
| F04–F06 | Destination compatibility notices, protected tokens, reviewed cleanup and spacing operations, undo |
| F07–F10 | 500 ms autosave, retained templates/snippets, validated additive imports, whole-record concurrency guards and 20 saved revisions |
| F11–F12 | Retained IME handling, grapheme-safe formatting, keyboard controls, live announcements and responsive mobile tabs/copy |
| G01–G03 | Inline `sharedDetail` reference nodes, selective reviewed updates, required destination checks, revision-specific exceptions and one-operation reviewed undo |
| G04–G05 | Reusable local brand profile, per-draft snapshots, explicit spelling review, insertion by user action and reviewed profile changes |
| G06 | Text-free copy receipts; output/mode/subject fingerprints distinguish Not copied, Copied and Changed since copy |
| G07 | Editable email subject with preserved unaffected references; sanitized HTML/plain clipboard, explicit fallback and HTML download |
| G08 | Original, variants, bindings, exceptions, brand snapshot and brief are retained in editable JSON; incoming IDs remap consistently and receipts are discarded |
| M01–M03 | Quick Format and Message Studio; optional local brief and five communication objectives |
| M04–M06 | Advisory clarity prompts, explicit CTA review, syntax validation and reference-based required facts |
| M08 | Clear prepared/copied outcome boundary with no publishing, reach or conversion metrics |

The pilot destinations are LinkedIn, WhatsApp, email and Generic plain text. LinkedIn Unicode emphasis is opt-in, with a separate workspace-wide disable setting. WhatsApp emits a single supported style per run, splitting at line breaks and protected spans. Overlapping styles or conflicting literal markers preserve the run as plain text with a notice. Source Tamil, Hindi, accents and emoji stay intact. Email has no remote image or executable HTML nodes.

Counts measure generated output, including markers. LinkedIn's 3,000 target is explicitly provisional and uses UTF-16 units with composer counting unverified. Other pilot destinations show graphemes and no asserted limit. Preview is labeled Layout estimate; Text to copy is the exact payload.

## Import, recovery and deletion

Imports validate the entire file before mutation, including a 10 MiB file cap, 50 drafts including Trash, 100 snippets, 50,000 draft graphemes, 5,000 snippet graphemes, 20,000 document nodes, safe URL schemes and every reference. The flat permitted document schema cannot contain recursive executable or resource nodes. Legacy title lengths up to 200 remain accepted to preserve earlier records.

Normal imports add new IDs atomically. Workspace preferences restore on an empty workspace and remain unchanged when adding to existing work. The global brand profile is imported only if no existing reusable profile would be overwritten; every imported draft retains its own snapshot. Advanced workspace replacement requires a current backup export, a separate explicit confirmation and a transaction that checks the full prior workspace snapshot. Imported copy receipts are discarded.

Delete moves a draft and its versions to local Trash. Trash counts toward the draft cap; restoration is available for seven days. Expired Trash is removed on refresh with a revision guard so a concurrent restore cannot be overwritten. Empty Trash and Delete all require visible confirmation. Recovery creates a new draft with all bundle metadata preserved. Backups include Trash. A dismissible backup reminder appears after five new drafts since export and at most weekly.

Source and output are processed locally. Content is never placed into network requests, error telemetry or analytics. Assets and fonts are self-hosted. Production CSP permits only same-origin resources and blocks embedding. Local data is not an encrypted or automatic cloud backup.

## Verification and release boundaries

The inherited test suite was updated for explicit Unicode opt-in, revised limits, reviewed spacing and soft deletion. New fixtures exercise selective updates across three versions, exception expiration, receipt hashes, safe rich email HTML, ID remapping, subject references and the global Unicode setting. Browser scenarios cover the two-mode workflow, required-copy blocking, reviewed update/undo, manual copy and 360 px accessibility.

Run `npm test`, `npm run build` and `npx playwright test --project=chrome` from the repository. Build also generates and verifies the offline shell against the existing compressed bundle budget. Other configured browser projects are Edge, Firefox and WebKit and require their installed runtimes.

Verification on 13 October 2026: 41 unit/integration tests passed; the full Chrome suite passed 50 tests; eight focused Studio browser tests passed after the final import/preferences and change-highlighting updates. TypeScript and production build passed. The generated offline shell contains 20 files, with approximately 268 KiB compressed JavaScript/CSS against the 350 KB budget. The 360 px Studio screen and both light/dark editor appearances passed the configured automated WCAG checks. These observations do not certify destination composers or real-device performance.

Before release, record actual web/Android/iOS paste observations for all four destinations, named Gmail/Outlook rich clipboard behavior, real screen-reader/IME results, storage quota/private-browser outcomes and representative Android performance measurements. Automated browser emulation is not evidence of platform-client compatibility. The 15-person completion, repeat-use and controlled benchmark gates require observation; no pilot outcome is claimed.

Instagram, Facebook and X are phase 2. X needs the reviewed official twitter-text weighted-count algorithm and conformance fixtures before activation. Campaign labels persist on drafts; full M07 CampaignBundle records/organizer remain phase 2. These are deliberately excluded from the four-mode pilot as required by section 20.4. There is no cloud sync, AI rewriting, direct posting, scheduling, CRM, team approval or analytics scope.

The copied legacy `HANDOVER.md`, `LAUNCH_CHECKLIST.md`, `implementationplan.md` and preexisting evidence describe the original formatter, not verified v3 release status. This file is the current implementation reference.
