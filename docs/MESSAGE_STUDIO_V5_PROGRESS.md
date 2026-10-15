# Message Studio v5 implementation progress

Baseline audited and first foundation increment implemented on 14 October 2026.

## Baseline findings

The checkout uses React/TypeScript/Tiptap and stores schema-1 drafts with optional v3 Studio metadata. `src/model.ts` rejects unknown draft fields; `src/studioValidation.ts` validates Studio metadata. Campaigns and typed facts therefore require coordinated validator, importer and schema changes rather than attaching unchecked fields to existing records.

`src/studio.ts` currently models shared details as display strings with date/price/name/link/phrase kinds. These cannot safely become typed dates or prices through automatic conversion. Preserve them as legacy literals until the user explicitly confirms a typed value.

The actual concurrency guard is draft `revision`, not a separate `recordRevision` property. Existing recovery and import handling must remain in the same guarded persistence transaction when campaign records are added.

## Initial baseline gap inventory

| Area | Baseline / next work |
| --- | --- |
| Quick Format, four destinations, Unicode opt-in | Existing implementations and regression tests; real-device/client checks remain required |
| Selective shared-detail updates, copy receipts, exceptions | Existing string-based implementation; extend to typed occurrences and cross-record atomic updates |
| Typed fact validation | New pure validators for date/time/datetime/money/phone/url/literal; not yet connected to UI/storage |
| Typed template rendering | New timezone-independent calendar renderer; remaining template options and types pending |
| Campaign records and recurring duplication | Pending; existing campaign label is not a campaign relationship model |
| Suggestions and binding confirmation | Pending typed parsing/range/ambiguity workflow |
| Migration and typed bundle import/export | Pending additive contract; existing legacy round-trip tests pass |
| Checker standalone/embedded | Pending; referenced complete v1.3 specification/fixture set not supplied in this checkout |
| Paste-back audit, Change Finder, report | Pending P1 |
| Dedicated product origin, deployed CSP, legal/domain decisions | Not verified by local code checks |
| Real-device compatibility and genuine repeat-use pilot | Pending; existing automated tests do not establish these outcomes |

## Completed increment

- Added `src/facts/values.ts` with canonical discriminated value types and strict validators. Rejects invalid calendar dates, absent/invalid timezones, non-decimal money, unsupported currencies, non-E.164 phones, unsafe URLs and unknown fields.
- Preserves exact decimal amount strings, exact URL targets and original phone displays; performs no network access or silent normalization.
- Added explicit calendar rendering in UTC with supported India locales and optional weekday/year display. This does not enable the checker weekday rule.
- Added five focused tests covering invalid dates, precision, explicit zone/country requirements, unsafe URLs and the correct Sunday rendering for 18 October 2026.
- Baseline: 41 tests passed. After increment: 46 tests passed. TypeScript validation passed; production build checked separately.

## Second foundation increment

- Added `src/facts/templates.ts`: validated destination templates and deterministic rendering for all seven fact types. Money remains an exact decimal string; wall-clock times retain their explicit zone rather than receiving an inferred conversion.
- Added `src/campaigns/model.ts`: campaign, fact, occurrence and template relationship validation, per-revision exceptions, and previous approved values. Type changes require a new fact; no-op value changes do not increment revisions.
- Added `src/campaigns/transfer.ts`: bounded version-5 campaign JSON parsing/export, consistent identity remapping and discarded imported receipts. Explicit legacy conversion copies source drafts and retains shared-detail values as literals without guessing dates/prices. Typed occurrences await stable editor node IDs and binding review.
- Added `src/campaigns/storage.ts`: persistence through the existing IndexedDB database. Campaign metadata lives in namespaced `meta` records; drafts remain in the canonical `drafts` store. Metadata, draft revisions, recovery snapshots and original migration payloads commit in one guarded transaction.
- Campaign saves check campaign and draft revisions; imports are additive with new identities. Invalid input is rejected before writing. Draft membership changes are rejected until a reviewed migration path exists.
- Verification: 56 unit/integration tests pass. TypeScript and production build pass; offline shell remains within its 350 KB compressed budget.

At the end of the second increment, these APIs were not exposed in the editor and workspace backup integration remained pending. The third increment below adds that integration. No actual device/client compatibility outcome is claimed.

## Third increment — workspace integration and lifecycle

- Added reviewed typed-fact controls inside Shared details. Users explicitly confirm a type/value, adjust destination display templates, inspect the existing per-channel preview, apply atomically and undo the reviewed change. Existing unlinked wording remains intact.
- Extended the additive detail/source contract with typed values, previous approved values, per-destination templates and stable reference-node identities. Legacy string-only drafts still validate; imports remap reference/template identities and discard receipts.
- Destination adapters now render typed references for their channel; rich email and email-subject copy use the corresponding displays. Output-to-source mappings account for rendered facts with different lengths without shifting ordinary text ranges.
- Added local campaign creation from the active draft, campaign JSON download and reviewed additive campaign JSON paste/import. Creation preserves legacy display values as literals unless the user has explicitly typed them.
- Extended full workspace backups and their existing import/replace controls with optional campaign metadata. Drafts appear once in the backup envelope; all linked campaign IDs, facts, templates and occurrences remap consistently. Snapshot export remains available without requiring a successful save.
- Draft saves reconcile associated campaign facts/occurrences in the same guarded IndexedDB transaction. Recovery/restoration reconciles metadata with restored source values. A draft cannot belong to two campaigns.
- Trash retains campaign metadata until permanent deletion. Purge/permanent delete removes related campaign metadata/history and the deleted draft's migration payload; unrelated surviving drafts remain independent. Delete-all clears campaign metadata while retaining snippets/preferences as before.
- Updated published draft/backup schemas and added `schemas/campaign.schema.json`. Runtime validation also rejects canonical fact/source disagreement.
- Verification: 64 unit/integration tests pass; TypeScript and production build pass. The full Chrome suite passed 52 tests, including the new workflow and 360 px automated accessibility checks. A focused follow-up covers typed update/undo, backup restore and denied-storage behavior after the backup refinements. Compressed offline JS/CSS is approximately 276 KiB against the 350 KB budget.

Actual Android/iOS devices, other browser engines, screen readers and destination-client paste compatibility remain unverified for this increment.

## Current implementation backlog

1. Complete remaining baseline/migration requirement tracing and Release A device/browser evidence.
2. Extend deterministic detection only against explicit fixtures; yearless dates still require manual entry with a confirmed year.
3. Obtain standalone checker v1.3 source fixtures, then build and verify the standalone checker before integration.
4. Verify dedicated-origin HTTPS/CSP deployment and real destination-client behavior.

Phase 0 and Phase 1 remain in progress. This increment does not certify Release A or v5 checker conformance.


## Fourth increment - reviewed candidate suggestions (15 October 2026)

- Added a pure deterministic suggestion parser returning exact UTF-16 source ranges for ISO dates, day-first named-month dates with years, slash dates with four-digit years, times, ungrouped INR amounts, HTTP(S) URLs and explicitly international phone numbers.
- Numeric dates offer each valid day/month interpretation; no year or phone country is inferred. Times require an explicitly entered valid IANA timezone before confirmation.
- Shared details now offers **Find fact suggestions**, one-occurrence selection, canonical confirmation and format review before the existing per-destination preview/apply/undo flow. Detection itself changes no source text.
- URL/token protection, nonoverlap and grapheme boundaries prevent nested or partial candidates. The editor skips existing references, linked/code-marked text and code blocks. Composition and source-snapshot guards reject stale binding attempts.
- Initial scope scans individual editor text nodes. Candidates split across formatting marks, grouped monetary amounts and yearless dates require manual selection; suggestions are not claimed to recognize every valid format. Selecting multiple occurrences together remains pending; each occurrence can be linked explicitly through existing controls.
- Verification: 68 unit/integration tests pass; TypeScript and production build pass. Offline JS/CSS is 277.3 KiB against the 350 KB budget. All three Chrome campaign workflows pass, including ambiguous-date suggestion review, selective binding/undo, typed update/backup and automated mobile accessibility.
- Recurring duplication, new-user destination defaults, remaining foundation fixtures and actual device/browser release gates remain pending. Release A remains uncertified.


## Fifth increment - recurring campaign duplication (15 October 2026)

- Added **Duplicate with new facts** to existing campaigns. Users review every replacement, optionally label the recurrence, and preview each destination body and separate email subject before creating local work. Unchanged values can be explicitly retained.
- New campaign, fact, draft, occurrence, template and reference identities isolate the recurrence. Local parent lineage is retained; original drafts and recovery history remain unchanged. Independent wording and unbound text remain intact and need manual review.
- Validates replacement types and values before any writes. Since the schema has no configured link-expiry metadata, every typed URL and legacy link requires explicit expiry/suitability confirmation rather than an inferred expiry claim. No links are fetched and no scheduling is introduced.
- New work discards copy receipts and destination exceptions and starts fresh fact history/revisions. Original approved-value history remains in the parent campaign.
- Creation uses the existing atomic campaign/draft/recovery transaction, with additional source campaign and draft revision guards. Stale previews cannot create partially updated work. Draft-limit checks still apply.
- Workspace backup imports now preserve and remap parent relationships when both campaigns are included; isolated campaign imports continue to discard untrusted external lineage.
- Verification: 71 unit/integration tests pass; TypeScript and production build pass. All four Chrome campaign workflows pass, including recurrence review, selective replacements, reload/backup lineage and automated 360 px accessibility. Offline JS/CSS remains approximately 279 KiB against the 350 KB budget.
- Next work: simplify the campaign entry journey, default new users to WhatsApp while retaining existing destination choices, expand remaining suggestion/timezone fixtures and complete real-device/browser release evidence. Release A remains uncertified.

## Sixth increment - core workspace completion (15 October 2026)

- Renamed the optional Studio entry to **Campaign workspace** and collapsed brief/objective fields. Quick Format, shared facts and campaign creation remain directly accessible without completing a brief.
- New workspace drafts default to WhatsApp. Existing draft destinations and the legacy LinkedIn fallback are preserved. Destination choices persist after opt-in and carry into new messages.
- Added a session storage layer: draft edits, copy receipts, preferences, reusable text, brand metadata and caret data remain in memory until **Save on this device** is chosen. Existing stored work remains readable. Simple editing, fact review/undo, draft switching, copying and JSON export are usable without opting in. Campaign creation/import and persistent workspace replacement require saving; explicit deletion does not require opting into new writes.
- Opt-in atomically commits pending drafts, recovery snapshots, reconciled campaign metadata and consent under stored draft revision guards. Conflicts and failed writes leave session work available for export. Damaged raw records, migration payloads and unrelated recovery history are retained. Consent is device-local and is not imported from a backup field.
- Transient changes warn on unload; service-worker activation cannot reload unsaved session work automatically. Conflict recovery now reads the durable version explicitly, and keeping a copy discards the stale session record after preserving the copy.
- Suggestions now scan contiguous paragraph text across formatting runs, protecting complete URL spans and stopping at reference atoms, hard breaks and paragraphs. Users choose multiple exact matching occurrences to share one fact; unchecked text and other destination wording remain unchanged. The full change still uses destination preview and one reviewed undo.
- Added strict Indian/western comma-grouped INR detection with exact decimal preservation. Yearless dates and unsupported forms still require manual confirmation; no year, country or timezone is inferred.
- Manual time/datetime entry starts with an empty timezone. Datetime validation rejects DST gaps; repeated local times require explicit review in the typed editor while retaining the wall-clock/timezone contract. Standalone time facts explain that overlap checks require a date. Fixtures include New York gaps/overlaps, Lord Howe half-hour changes and Apia's skipped date. This does not enable the checker weekday rule.
- Unit/integration verification: 84 tests pass across 14 files; TypeScript and production build pass. All 59 Chrome workflows and 9 focused WebKit workflows pass. Firefox cannot create even a blank page in this environment and remains unverified. Offline JS/CSS is approximately 281.5 KiB against the 350 KB budget. See [dated evidence](release-evidence/2026-10-15-core-workspace.md) for browser scope and limitations.
- Remaining work: baseline/migration requirement tracing, named real mobile/client testing, human screen-reader/keyboard and Hindi/Tamil IME evidence, deployed HTTPS/CSP verification, and the separate checker v1.3 source/fixture dependency. Release A and checker conformance remain uncertified.
