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

## Next implementation increment

1. Implement deterministic candidate suggestions with protected ranges and explicit ambiguity confirmation.
2. Add “Duplicate with new facts,” lineage and expired-link review to the campaign workflow.
3. Simplify the campaign entry journey and apply WhatsApp defaults for new users while preserving existing preferences.
4. Complete remaining template/timezone ambiguity fixtures and real-device/browser release evidence before certifying Release A.
5. Build the standalone checker after obtaining the referenced v1.3 source fixtures; integrate only after standalone conformance.

Phase 0 and Phase 1 remain in progress. This increment does not certify Release A or v5 checker conformance.
