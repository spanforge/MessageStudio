# Sriram Advisory Message Studio

One product message. Multiple channels. Consistent communication.

This local browser application extends the source from `D:\sriram\LinkedinTextEdittor` to implement the v3.0 specification's four-destination pilot. It retains the React, TypeScript, Tiptap, IndexedDB and offline foundations. The original source directory is retained; this repository has its own history.

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:3001`. Production output is generated in `dist/`:

```powershell
npm test
npm run build
npx playwright test --project=chrome
```

Quick Format supports immediate editing and copying without a brief. Message Studio adds optional audience, problem, value, evidence, objectives and CTA fields. LinkedIn, WhatsApp, email and Generic plain text have separate deterministic adapters and independently editable versions.

Select text, open **Shared details**, and choose **Keep selected text consistent** to create an explicit reference. Link matching text in another version or insert that reference. Reviewed canonical updates touch only references; unrelated identical text stays intact. Required missing references block normal copy until restored or explicitly excepted. Exceptions need renewed review after canonical updates.

Other features include brand snapshots, separate email subjects, sanitized rich email clipboard with fallback, copy receipts, global Unicode disable, local Trash, 20 recovery revisions, additive imports and guarded workspace replacement. Copy receipts describe local copying, never publication or reach.

Editing starts in memory with WhatsApp selected for new users. Copy and JSON export work before saving is chosen. **Save on this device** enables local autosave; existing stored drafts remain readable before consent. Session changes disappear on close/reload. Browser storage is unencrypted and accessible to this site's code; clearing site data removes saved drafts. Export backups regularly. The app has no account, AI API, publishing, scheduling or analytics integration.

The v5 foundation now adds reviewed typed values and channel display templates in **Shared details**, plus **Campaign: Create or import** for local campaign creation and JSON transfer. Full workspace backups include campaign relationships. Typed changes use the per-channel preview and reviewed undo; Shared details offers reviewed candidate suggestions. Existing campaigns support **Duplicate with new facts**, with replacement review, per-channel preview and isolated local lineage. See [v5 implementation progress](docs/MESSAGE_STUDIO_V5_PROGRESS.md) for coverage and validation.

**Campaign workspace** keeps the brief optional and collapsed. Suggestions span formatting runs and let users choose multiple matching occurrences. Datetimes reject nonexistent local times and require review of repeated local times; wall-clock values retain their explicit timezone without implying a unique instant.

See [implementation and verification notes](docs/MESSAGE_STUDIO_V3.md) for the schema audit, release checks and phased scope. Platform-client compatibility and pilot outcomes are unverified. Instagram, Facebook, X and full campaign-bundle organization belong to the specification's later phase.
