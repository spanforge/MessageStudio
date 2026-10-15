# Message Studio v5.0 — Phase-wise Implementation Plan

Source: `Message_Studio_Master_Product_Specification_v5_0.docx`, dated 13 October 2026.
Plan prepared: 14 October 2026.
Status: planned work; phase completion requires the evidence listed below.
Implementation started: typed-fact editing/templates, reviewed channel updates/undo, campaign creation, versioned transfer and atomic workspace backup/lifecycle integration are recorded in [v5 progress](docs/MESSAGE_STUDIO_V5_PROGRESS.md). Deterministic suggestions, recurring duplication and actual device/browser release gates remain pending; Release A is not yet certified.

## 1. Outcome and governing scope

Build a free, independent, local-first fact-consistency workspace for recurring announcements: **Change a fact once. Every channel version follows.** Preserve independent channel wording, make updates reviewable and atomic, check against supplied facts, and support genuine campaign reuse.

The v5.0 strategic update takes precedence over conflicting inherited v4/v3 decisions. Retain the embedded v4 technical requirements and applicable v3 editing, recovery, accessibility, import/export and copy safeguards. Pricing, paid tiers, compulsory accounts, trial expiry and watermarks are excluded from every release.

Release order:

| Release | Included phases | Outcome |
| --- | --- | --- |
| Foundation | 0 | Verified baseline, migration fixtures and release decisions |
| A — Core P0 | 1–3 | Typed facts, safe channel updates, exact copy and recurring campaigns |
| B — Checker P0 | 4–5 | Standalone checker first, then the identical engine in the workspace |
| Validation | 6 | Real first-use and repeat-use evidence before expansion |
| C — Evidence P1 | 7 | Paste-back audit, accessible HTML reports, Change Finder and locale/share extensions |
| D — Conditional P2 | 8 | Portability and selected extensions after demand, security and browser review |

No calendar duration is asserted without a baseline audit, implementation estimates and available staffing. The integrated pilot requires a 30-day repeat-use observation window; checker fixture work may proceed alongside core work after Phase 0, but standalone release must precede embedded checker release.

## 2. Repository baseline and implementation boundaries

The repository currently identifies itself as a v3 application using React, TypeScript, Vite, Tiptap and IndexedDB. Existing implementation notes describe Quick Format, four destination versions, text-based shared references, guarded updates, recovery, copy receipts, import/export and offline behavior. These are reuse candidates, not proof that v5 requirements are complete.

| Existing area | Planned use |
| --- | --- |
| `src/model.ts`, `src/studio.ts`, `src/studioValidation.ts` | Add versioned typed facts, campaigns, occurrence metadata and validation |
| `src/editor.ts`, `src/operations.ts`, `src/unicode.ts` | Retain source integrity, reference editing, selection, Unicode and undo safeguards |
| `src/storage.ts`, `src/useWorkbench.ts` | Extend migrations, guarded atomic updates, campaign persistence and recovery |
| `src/services.ts`, `src/paste.ts` | Audit and reuse exact copy, export and safe input handling |
| `src/ui/App.tsx`, `src/ui/StudioControls.tsx` | Simplify to Quick Format and Campaign workspace; add fact review and checker entry points |
| `schemas/`, `tests/`, `docs/release-evidence/` | Version contracts, regression fixtures and dated release evidence |

Proposed new boundaries, subject to Phase 0 audit: `src/facts/` for validation/rendering/detection, `src/campaigns/` for duplication and update coordination, `src/checker/` for the pure engine and adapters, and `src/audit/` for paste-back, Change Finder and report generation. Keep rendering, checking and persistence separate; standalone entry routes reuse engines rather than fork behavior.

## 3. Phase 0 — Baseline audit and delivery contracts

**Dependency:** none. **Priority:** prerequisite for all releases.

Work:

- Inventory actual code, deployed schema if available, destination adapters, clipboard behavior, recovery, service worker and existing tests. Record verified, partial, missing and untested requirements.
- Establish regression fixtures for legacy schema-0/schema-1 drafts, v3 bundles, backups, shared references, exceptions, email subjects and independently edited versions.
- Design additive schema upgrades and rollback/raw-export recovery. Do not infer typed values from legacy text without user confirmation; preserve legacy literal bindings.
- Identify the actual stored revision guard. The current model uses `revision`; map the specification's `recordRevision` concept explicitly rather than introduce inconsistent concurrency fields.
- Establish data contracts, limits, migration strategy and requirement-to-test mapping before changing persistence.
- Confirm dedicated product-origin and HTTPS/CSP deployment requirements. Domain, legal naming and trademark clearance remain unresolved decisions, with no availability claim.
- Obtain the referenced standalone Pre-publish Checker v1.3 source and fixture set before certifying full checker conformance. The v5 document gives an integration contract but does not establish that the entire external fixture set is present.

Deliverables: baseline gap matrix, migration design, retained regression fixtures, checker fixture inventory and updated release checklist.

Exit gate: old drafts/backups round-trip without loss; every retained safeguard has a verification path; missing source fixtures and hosting decisions are explicitly recorded. Existing evidence is labeled by version and does not count automatically as v5 evidence.

## 4. Phase 1 — Typed facts and campaign data foundation

**Dependency:** Phase 0. **Priority:** P0 / Release A.

Work:

- Add Campaign records with IDs, title, optional recurrence label, timestamps, revision, fact/draft relationships and optional parent campaign ID.
- Add stable UUID Facts and Occurrences. Facts carry type, canonical value, metadata, revision and required destinations. Occurrences connect fact IDs to source nodes and destination-specific templates/exceptions.
- Support `date`, `time`, `datetime`, `money`, `phone`, `url` and compatible `literal` facts.
- Validate calendar dates; retain IANA timezone for time/datetime; surface ambiguous local times and use DST-aware handling where supported. Never infer a missing zone.
- Store money as decimal strings plus ISO currency; avoid floating-point arithmetic. Store phones as E.164 plus original display and separate extensions; never silently guess country codes.
- Accept only validated HTTP(S) URLs with exact targets; reject unsafe schemes and control characters.
- Build deterministic templates with locale, date/time style, currency/phone/zone display and destination overrides. Template changes do not alter canonical values.
- Add atomic versioned import/export with strict limits, relationship validation, ID remapping and discarded incoming copy receipts. Preserve prior recovery payloads and unknown/damaged data for raw export.
- Document local persistence consent and provide a usable transient path until saving is chosen. Keep standalone checker persistence separate from workspace storage.

Deliverables: typed schemas, fact validators, template renderer, campaign storage and migrations.

Exit gate: T01, T02 and T08 pass, including malformed values, timezone ambiguity, precise money, unsafe URLs, legacy literal references and failed-import rollback. Calendar rendering must correctly identify 18 October 2026 as Sunday; this is separate from the initially disabled checker weekday rule.

## 5. Phase 2 — Reviewed binding and safe multi-channel updates

**Dependency:** Phase 1. **Priority:** P0 / Release A.

Work:

- Detect candidate dates, times, INR prices, HTTP(S) URLs and phone numbers using deterministic parsers with source ranges and ambiguity information.
- Protect URL spans; avoid overlapping duplicate suggestions; preserve grapheme boundaries and IME composition.
- Add “Keep consistent” confirmation with type, normalized value, proposed rendering and user-selected occurrences. Manual selection/type assignment remains available when detection fails.
- Require explicit day/month choice for ambiguous dates. Require a timezone for times or retain them as literals. Never auto-bind or rewrite source text.
- Render bound occurrences from their stable fact IDs; keep independent channel wording and destination overrides intact.
- Preview each destination diff before a canonical change. Atomically commit canonical revision, affected versions/output hashes, copy-state changes and recovery snapshot under the revision guard.
- Abort stale-tab transactions. One undo restores the complete update, including statuses and fact revisions.
- Support detach and documented exceptions scoped to destination/fact revision; canonical changes make prior exceptions stale.
- Show Current, Missing required fact, Different/detached with exception, Changed since copy and Unverified external message. Required-detail failures require repair or explicit exception; formatting warnings remain nonblocking.
- Retain previous approved values and bounded variants as checker/audit metadata without changing the canonical typed-value contract.

Deliverables: suggestion UI, occurrence binding, diff review, atomic update/undo and revision-specific status handling.

Exit gate: T03–T04 pass. Updating one fact affects only bound occurrences across destinations; identical unbound text remains unchanged. Conflicts and transaction failures leave no partial updates. Checker metadata does not become authoritative source content.

## 6. Phase 3 — Recurrence, exact copy and Release A readiness

**Dependency:** Phase 2. **Priority:** P0 / Release A.

Work:

- Make Quick Format directly accessible without campaign creation, facts or a mandatory brief. Retain drafts, snippets, keyboard access and accessible plain-text defaults; keep Unicode opt-in.
- Remove mandatory brief/objective/CTA flows from the core journey while retaining legacy data safely. Brand profiles are optional and do not block the pilot.
- Default new users to WhatsApp; retain existing users' chosen destination. Support WhatsApp, LinkedIn, email and Generic in the pilot.
- Preserve separate email subject/body, sanitized rich clipboard output and plain-copy fallback. Keep “Text to copy” equal to the actual payload for the selected copy mode.
- Record copy receipts only after successful copying; invalidate prior copy state only when output changes. Do not claim publication or delivery.
- Add “Duplicate with new facts”: create new campaign/fact/occurrence/draft IDs, remap relationships and preserve lineage and original history.
- Require valid replacement values; explicitly review expired registration links. Recurrence never triggers automatic scheduling.
- Preserve autosave, conflict recovery, Trash, protected spans, offline startup and safe service-worker updates.

Deliverables: complete create/link/update/copy/reuse journey and Release A evidence package.

Exit gate: T05–T08, T15, V5-01 and the Quick Format portion of V5-07 pass. Demonstrate exact copy, unchanged output receipts, duplicate isolation and old-backup migration. Release A requires actual browser/mobile, keyboard, screen-reader, IME, storage-failure and destination-client checks, not browser emulation alone.

## 7. Phase 4 — Pure checker and standalone Release B entry

**Dependency:** Phase 0 contracts and checker fixture inventory; Phase 1 supplies the typed adapter design. Standalone release follows Release A. **Priority:** P0.

Work:

- Implement a pure JavaScript-compatible module with explicit types:
  `check(messageText, approvedFacts, now, timeZone, options)` returning `findings`, `skippedChecks` and `checkScope`.
- Inject clock/timezone; return rule ID, matched literal, message range, expected value, severity and explanation. Never mutate input, drafts or clipboard payloads.
- Implement the bounded date variants, including `17 Oct`, `17th October`, `Oct 17` and `October 17th`. Skip ambiguous numeric yearless dates and explain the skip.
- Generate `6 PM`, `6:00 PM` and `18:00` only from confirmed time values. Standalone time can use a term fact; the workspace adapter maps native time facts.
- Support specified Indian +91 mobile forms, including hyphens; STD-code landlines remain exact-literal checks.
- Require explicit review for URL variants; distinct hosts, paths and query strings remain distinct. Do not fetch destinations or follow redirects.
- Retain old approved variants as forbidden values after changes. Tamil/Hindi matching is literal substring matching without word-boundary guarantees; no paraphrase equivalence.
- Show timezone, defaulting to Asia/Kolkata. Configured expiry is inclusive through the final millisecond of its minute.
- Keep checker weekday validation OFF initially; enable only in a separately verified change after every core fixture passes.
- Build a no-login standalone UI with current/previous facts and manual corrections. Label results “Checked against supplied facts” and show skipped checks and scope.
- Keep messages in memory only. “Save facts on this device” defaults OFF and persists only approved/prior values with delete/reset controls and the same-origin access notice.
- Prepare standalone deployment on the dedicated HTTPS product origin with strict CSP, self-hosted assets and no third-party scripts by default.

Deliverables: engine, conformance fixtures, standalone checker, persistence controls and deployed-header verification evidence.

Exit gate: V5-02, V5-04–V5-06 and standalone V5-07 pass. Complete the referenced v1.3 fixture set before claiming conformance. Test 18:30:59.999 valid / 18:31:00.000 expired and 23:59:59.999 valid / next-day 00:00:00.000 expired in selected zones. Verify message text never enters storage, logs, URLs or network requests; test real mobile/browser use before standalone release.

## 8. Phase 5 — Embedded checker and public entry routes

**Dependency:** Phases 3–4; standalone engine fixtures and release gate must pass first. **Priority:** P0 / complete Release B.

Work:

- Translate IndexedDB typed facts into checker input without changing the canonical schema. Include prior values, explicit reviewed variants and configured expiry metadata.
- Add “Check before copy” over the exact selected output; display findings and manual correction paths without silently changing source or copy payload.
- Keep canonical required-detail copy guards distinct from checker findings. Introduce no new automatic repair or unspecified blanket copy blocking.
- Prove standalone/embedded parity using identical text, normalized facts, clock, timezone and options.
- Add public entry routes for LinkedIn formatter, WhatsApp checker, event announcement checker and link/contact checker. Each offers an immediate useful task and an optional path into the workspace.
- Apply independent Message Studio identity with Sriram Advisory creator credit, transparent compatibility notes and real examples/how-to demonstrations.
- Add voluntary “This was wrong” feedback with optional user-written description and no automatic message attachment.
- Keep analytics absent by default. If consented measurement is enabled, allow only aggregate event metadata through an explicit allowlist; never collect content, names, URLs, phone numbers, fact values or document data.

Deliverables: canonical adapter, integrated checking flow, shared entry routes and privacy-reviewed feedback/measurement contract.

Exit gate: V5-01, V5-03, V5-07 and V5-10 pass. Adapter/engine parity and nonmutation tests pass, including old-value variants. Browser/mobile evidence confirms free access, no mandatory signup and immediate tasks without campaign setup.

## 9. Phase 6 — Checker and recurring-message pilot

**Dependency:** Release B verified; recruitment/preparation may begin earlier. **Priority:** expansion gate.

Work:

- Recruit at least five real checker users and fifteen recurring-message users, including at least five WhatsApp-heavy users in the integrated group. Report any cohort overlap explicitly.
- Observe their current manual workflow first, with consent and non-sensitive sample content. Do not collect private drafts.
- Measure voluntary first completed format/check/copy task, successful first-task time, missed issues, false alarms, recurrence/duplicate use and recommendations.
- Observe a second genuine task and genuine 7/30-day return use. Prompted demonstrations and visitor counts do not establish adoption.
- Run controlled safety fixtures and time comparisons; publish actual counts, denominators and observations rather than invented adoption claims.

Inherited pilot hypotheses:

| Measure | Proposed gate |
| --- | --- |
| Unaided create/link/update/copy across three channels | At least 10/15 |
| Bind at least three facts without facilitation | At least 10/15 within three minutes |
| Unintended edits to unbound fixture text | Zero |
| Median date-and-link change time against current method | At least 30% reduction |
| Genuine duplicate/reuse within 30 days | At least 8/15 |
| Voluntary preference for the next recurring campaign | At least 8/15; compare with actual reuse |

Deliverables: content-free pilot results, issue/false-alarm log, second-task evidence and a documented expand/fix/retest decision.

Exit gate: observations are complete and reported honestly. Thresholds remain hypotheses; missed gates lead to documented improvements and retesting rather than claims of success. Monetization experiments remain outside this plan.

## 10. Phase 7 — Audit, reports and Change Finder

**Dependency:** reliable P0 workflow and repeat-use evidence from Phase 6. **Priority:** P1 / Release C.

Work:

- Add paste-back audit for user-supplied external text with campaign/destination selection. Report Current, Drift detected, Missing, Ambiguous or Cannot verify.
- Compare recognized typed dates/money using documented locale/timezone rules and safely normalized URLs without fetching or redirect-following. Display expected/observed values, source spans, confidence and manual resolution.
- Keep broader typed paste-back interpretation separate from the narrow literal checker contract; share safe helpers only where behavior is equivalent. Never imply semantic verification of paraphrases.
- Build Change Finder for explicitly pasted/uploaded user content and prior/current facts: exact locations, source labels and manual review checklist. Define supported formats, parser limits and malformed-file behavior before enabling uploads; process locally and never crawl or bulk-replace.
- Generate accessible, escaped, self-contained printable HTML reports with campaign, timestamp, typed facts, destination results, exceptions, adapter versions and copied/changed status. Include manually verified findings where provided.
- Label reports “Prepared locally; not evidence of publication or delivery.” Distinguish local checks, human verification, external approval and semantic truth. Include no external scripts/assets.
- Add en-IN, ta-IN and hi-IN presets and real script/IME fixtures without translation claims.
- Add explicit Web Share actions where supported, confirmed WhatsApp link fallback and graceful copy fallback. Handle encoding/length limits and cancellations; sharing does not mark delivery.
- Publish a dated platform/client/device compatibility matrix with versions, fixtures, observations, limitations and reproducible steps; mark unsupported/untested combinations.

Deliverables: audit UI, safe HTML report, Change Finder, locale/share extensions and compatibility evidence.

Exit gate: T09–T12, V5-08–V5-09 and the public-matrix portion of T14 pass. Seeded drift fixtures never silently report Current. Verify HTML injection resistance, local upload handling, uncertainty labels, share cancellation and actual mobile/client behavior.

## 11. Phase 8 — Conditional portability and future modules

**Dependency:** repeat-use demand, a separate scope decision, security review and supported-browser evidence. **Priority:** P2 / conditional Release D.

Candidate work, approved individually:

- User-selected File System Access folders with explicit permissions, revision/conflict checks, safe saves and download fallback. Explain that a synced folder may upload through the user's provider.
- Authenticated encrypted export with user-chosen passphrase, documented key-loss/metadata limitations and cross-device restore fixtures. QR carries only bounded encrypted payloads or descriptors; do not promise secure pairing without a threat model.
- Browser Print to PDF first; consider a dedicated renderer only after demand and accessibility evaluation.
- Android PWA share-target with manifest/service-worker/browser tests and no universal iOS claim.
- Content-free open-source serializer/adapters, versioned schema and conformance fixtures after license, dependency and security review.
- Instagram, Facebook and X only after client verification; X additionally needs a reviewed weighted-count implementation and fixtures.
- Claims & Evidence Registry remains research-only. Feedback Theme Organizer needs separate validation and user-defined themes/source examples, without sentiment or representativeness claims.
- Collaboration and cloud sync need separate demand, consent, identity/security and conflict designs; accounts never become prerequisites for free core access.

Exit gate: T13 and applicable T14 pass for each approved extension. Unapproved candidates remain explicitly deferred. AI writing, automatic publishing, scheduling, native apps and payments are not delivery commitments.

## 12. Cross-phase quality and release evidence

Every shipped stage requires:

- Appropriate unit/integration fixtures plus configured browser workflows; run `npm test`, `npm run check`, `npm run build` and the relevant Playwright projects. Record results rather than assuming prior runs remain valid.
- Real mobile devices and named destination clients; actual keyboard/screen-reader and Hindi/Tamil IME testing. Record device, OS, browser/client version, date, fixture, result and limitation.
- Clipboard-denied/manual fallback, storage quota/private mode, import failure, stale-tab conflicts, recovery, undo and offline-update checks where relevant.
- Deployed HTTPS/CSP header verification: restrictive self-origin policy, blocked objects/base/embed behavior and narrowly justified worker/style allowances.
- A reproducible offline test: initial load/install, disconnect, edit/update/copy/export and inspect network logs. Distinguish initial downloads/update checks and explicit external links/share/provider-folder actions from editor operations.
- No content in diagnostics, crash logs or analytics. Standalone message text is never persisted; checker facts are opt-in; workspace local saving is documented and opt-in. IndexedDB is not encrypted backup; clearing site data may erase drafts.
- A dated evidence package and updated launch checklist. A phase is complete only when its acceptance tests and actual device/browser gate pass; publish unverified compatibility honestly.

## 13. Acceptance traceability

| Requirement | Owning phase(s) |
| --- | --- |
| T01 typed facts / T02 templates | 1 |
| T03 suggestions / T04 selective updates | 2 |
| T05 recurrence / T06 copy / T07 Quick Format | 3 |
| T08 legacy migration | 0–1, regression gate in 3 |
| T09 paste-back / T10 India locale / T11 report / T12 share | 7 |
| T13 folder/transfer | 8, only if approved |
| T14 public evidence | 7 matrix; 8 open-source fixtures |
| T15 privacy | All releases; verified in 3–5 and later extensions |
| V5-01 free/no compulsory signup | All releases |
| V5-02 dedicated origin and standalone privacy | 0, 4 |
| V5-03 identical standalone/embedded results | 5 |
| V5-04 previous values and bounded variants | 2, 4–5 |
| V5-05 inclusive minute expiry | 4 |
| V5-06 initial weekday rule disabled | 4 |
| V5-07 no campaign/facts prerequisite for simple tasks | 3–5 |
| V5-08 user-supplied Change Finder only | 7 |
| V5-09 honest report boundaries | 7 |
| V5-10 content-free analytics/feedback | 5–6, maintained thereafter |

## 14. Immediate execution backlog

1. Complete the Phase 0 gap matrix and preserve legacy draft/backup fixtures.
2. Finalize typed fact, occurrence and campaign contracts with the additive migration proposal.
3. Implement validators/templates before suggestion UI and safe-update transactions.
4. Complete and verify Release A recurrence/copy flows.
5. Obtain the checker v1.3 fixtures, implement the pure engine and release standalone before integration.
6. Complete parity, privacy, device and dedicated-origin checks for Release B.
7. Run the genuine repeat-use pilot before committing to Release C expansion.
