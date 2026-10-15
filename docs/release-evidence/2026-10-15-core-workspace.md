# Core workspace increment: 15 October 2026

Local automated evidence only. This does not certify Release A or actual destination-client compatibility.

## Checks

| Command | Result |
| --- | --- |
| `npm.cmd test` | 84 tests pass across 14 unit/integration files |
| `npm.cmd run check` | Pass |
| `npm.cmd run build` | Pass; offline JS/CSS 281.5 KiB, below the 350 KB budget |
| `npx.cmd playwright test --project=chrome --reporter=line` | All 59 workflows pass; headless Chrome 155.0.8059.40 on Windows |
| Core/campaign workflows in WebKit | All 9 pass; headless Playwright WebKit 27.2 on Windows |
| Core/campaign workflows in Firefox | Nine attempts fail before page creation; app behavior unverified |

The build retains Vite's large-chunk advisory. The configured compressed offline-shell budget passes.

## Verified behavior

- New users start with WhatsApp. Saved destinations survive reload and carry into new messages; legacy records retain their original fallback.
- Campaign workspace opens without requiring a brief; optional brief/objective fields start collapsed.
- Transient formatting, exact copying, reusable text and JSON export do not put content in the IndexedDB draft, revision, metadata or migration stores. Reload drops session-only edits.
- Explicit saving atomically commits session drafts/metadata/consent. Tests cover failed revision guards, raw damaged-record preservation, retained recovery history and campaign reconciliation.
- Existing stored work is readable without opting in. Explicit deletion can remove stored/session work without consenting to new content writes.
- Matching candidates span formatting runs. Only checked exact occurrences are linked; a reviewed undo restores source formatting and unbound text.
- URLs remain protected across formatting boundaries. Candidates stop at atoms, hard breaks and paragraph boundaries. Grouped INR amounts retain exact decimals.
- Typed time entry has no inferred timezone. Datetimes reject missing local times and surface repeated local times for review, while keeping the wall-clock/timezone contract.
- DST fixtures cover New York, Lord Howe half-hour transitions and Apia's skipped date. Calendar rendering and checker weekday behavior remain separate.
- Existing Chrome regressions cover copy fallback/receipts, email subjects and rich output, campaign reuse/backup, storage denial, stale tabs/recovery, composition, deletion, offline reload/update and automated accessibility/layout checks.

## Browser limitations

Firefox 157.0 launches, but `browser.newPage()` fails with `Target crashed`. A separate test with no app navigation also cannot open `about:blank`; browser logs report failure to launch the tab subprocess and a software-framebuffer error. This is evidence of a local browser execution failure, not evidence that the app passes or fails in Firefox. No sandbox/security settings were weakened to bypass it.

WebKit is the Playwright Windows engine, not Safari on an actual Apple device. Automated mobile viewports and axe checks do not establish real-device, assistive-technology or IME compatibility.

## Remaining release gates

Actual Android/iOS and named destination-client paste checks; human keyboard/screen-reader and Hindi/Tamil IME observations; remaining baseline/migration requirement mapping; deployed HTTPS/CSP and dedicated-origin verification. The full checker v1.3 source/fixture set remains a separate prerequisite for checker certification.
