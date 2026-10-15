import { Store, ConflictError } from './storage';
import { config } from './config';
import { validateDraft, validateSnippets, validatePreferences, type Draft, type Snippet, type Preferences, type Backup } from './model';
import type { Brand } from './studio';
import { validateBrand } from './studioValidation';
import type { CampaignMetadata } from './campaigns/transfer';

/** Draft and metadata writes remain in this tab until explicit device-saving consent. */
export class SessionStorage extends Store {
  enabled = false;
  private disk = new Store();
  private drafts = new Map<string,Draft>();
  private metadata = new Map<string,unknown>();
  private snapshots = new Map<string,Draft[]>();
  get hasUnsavedContents() { return !this.enabled && this.drafts.size > 0; }
  discardSessionDraft(id: string) { this.drafts.delete(id); this.snapshots.delete(id); }
  async reloadSaved(id: string) {
    const saved = await this.disk.get(id);
    if (saved) this.discardSessionDraft(id);
    return saved;
  }
  requireSaving() { if (!this.enabled) throw Error('Choose “Save on this device” before using persistent campaign or workspace management. You can keep editing, copying and exporting in this tab.'); }
  async initialize() { this.enabled = await this.disk.meta('localSavingConsent',false) === true; }
  async enableSaving() {
    const saved = await this.disk.saveSession([...this.drafts.values()],this.metadata);
    this.enabled = true; this.drafts.clear(); this.metadata.clear(); this.snapshots.clear(); return saved;
  }
  override open() { this.requireSaving(); return this.disk.open(); }
  override async list(): Promise<unknown[]> {
    let disk: unknown[];
    try { disk = await this.disk.list(); } catch(e) { if (this.enabled) throw e; disk = []; }
    return [...disk.filter(d => !this.drafts.has((d as Draft).id)),...structuredClone([...this.drafts.values()])];
  }
  override async get(id: string) { return this.drafts.has(id) ? structuredClone(this.drafts.get(id)) : this.disk.get(id); }
  override async raw(id: string) { return this.drafts.has(id) ? structuredClone(this.drafts.get(id)) : this.disk.raw(id); }
  override async save(draft: Draft, expected: number) {
    if (this.enabled) return this.disk.save(draft,expected);
    validateDraft(draft);
    let existing = this.drafts.get(draft.id);
    if (!existing) { try { existing = await this.disk.get(draft.id); } catch { /* Session remains usable with denied storage. */ } }
    if (existing ? existing.revision !== expected : expected !== 0) throw new ConflictError();
    if (!existing && (await this.list()).length >= config.draftLimit) throw Error('50 drafts reached. Export before creating more.');
    const next = structuredClone(draft); this.drafts.set(next.id,next);
    this.snapshots.set(next.id,[...(this.snapshots.get(next.id) || []),next].slice(-config.recoveryLimit));
    return structuredClone(next);
  }
  override async revisions(id: string) { return this.snapshots.has(id) ? structuredClone(this.snapshots.get(id)!) : this.disk.revisions(id); }
  override async meta<T>(id: string, fallback: T): Promise<T> {
    if (this.metadata.has(id)) return structuredClone(this.metadata.get(id)) as T;
    try { return await this.disk.meta(id,fallback); } catch(e) { if (this.enabled) throw e; return fallback; }
  }
  override async setMeta(id: string, value: unknown) { if (this.enabled) return this.disk.setMeta(id,value); this.metadata.set(id,structuredClone(value)); }
  override async campaignMetadata() { try { return await this.disk.campaignMetadata(); } catch(e) { if (this.enabled) throw e; return []; } }
  override async addImported(drafts: Draft[], snippets: Snippet[], brandProfile?: Brand, preferences?: Preferences, campaigns: CampaignMetadata[] = []) {
    if (this.enabled) return this.disk.addImported(drafts,snippets,brandProfile,preferences,campaigns);
    if (campaigns.length) this.requireSaving();
    drafts.forEach(validateDraft); validateSnippets(snippets); if (brandProfile) validateBrand(brandProfile); if (preferences) validatePreferences(preferences);
    const all = await this.list();
    if (all.length+drafts.length > config.draftLimit) throw Error('Import exceeds 50 drafts including Trash.');
    if (new Set(drafts.map(d => d.id)).size !== drafts.length || drafts.some(d => all.some(old => (old as Draft).id === d.id))) throw Error('Duplicate draft IDs.');
    for (const d of drafts) this.drafts.set(d.id,structuredClone({...d,revision:0}));
    await this.setMeta('snippets',snippets); if (brandProfile) await this.setMeta('brandProfile',brandProfile); if (!all.length && preferences) await this.setMeta('preferences',preferences);
  }
  override async remove(id: string, expected?: number) { await this.disk.remove(id,expected); this.discardSessionDraft(id); }
  override async purgeTrash(drafts: Draft[]) { if (this.enabled) return this.disk.purgeTrash(drafts); }
  override async clear() { this.requireSaving(); return this.disk.clear(); }
  override async clearDrafts() { await this.disk.clearDrafts(); this.drafts.clear(); this.snapshots.clear(); this.metadata.delete('active'); }
  async permanentlyPurgeTrash(drafts: Draft[]) { await this.disk.purgeTrash(drafts,!this.enabled); drafts.forEach(d => this.discardSessionDraft(d.id)); }
  override async importBackup(backup: Backup, expected?: unknown[]) { this.requireSaving(); return this.disk.importBackup(backup,expected); }
  override async migrate(raw: unknown) { this.requireSaving(); return this.disk.migrate(raw); }
}
