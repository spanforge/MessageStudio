import { config } from './config';
import { validateBrand } from './studioValidation';
import type { Brand } from './studio';
import { refreshCampaignDraft, type CampaignMetadata } from './campaigns/transfer';
import { validateCampaignBundle } from './campaigns/model';
import { fromText, newDraft, parseImport, validateDraft, validateDoc, validateSnippets, validatePreferences, type Backup, type Draft, type Preferences, type Snippet } from './model';
const DB_NAME = 'sriram-linkedin-formatter';
const STORES = ['drafts', 'revisions', 'meta', 'migrationBackup'];
export class ConflictError extends Error { constructor() { super('This draft changed in another tab. Save this tab as a new copy or reload the saved version.'); } }
export class Store {
  private promise?: Promise<IDBDatabase>;
  open(): Promise<IDBDatabase> {
    return this.promise ||= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' }); };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); this.promise = undefined; }; resolve(req.result); };
      req.onerror = () => { this.promise = undefined; reject(req.error); };
      req.onblocked = () => { this.promise = undefined; reject(Error('Storage upgrade blocked. Close other formatter tabs.')); };
    });
  }
  async list(): Promise<unknown[]> { const db = await this.open(); return request(db.transaction('drafts').objectStore('drafts').getAll()); }
  async get(id: string): Promise<Draft | undefined> { const db = await this.open(); const d = await request(db.transaction('drafts').objectStore('drafts').get(id)); if (d) validateDraft(d); return d; }
  async raw(id: string): Promise<unknown> { const db = await this.open(); return request(db.transaction('drafts').objectStore('drafts').get(id)); }
  async save(draft: Draft, expected: number): Promise<Draft> {
    validateDraft(draft); const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['drafts', 'revisions', 'migrationBackup','meta'], 'readwrite'); const store = tx.objectStore('drafts'); let failure: Error | null = null;
      const next = { ...draft, updatedAt: new Date().toISOString(), revision: expected + 1 };
      const get = store.get(draft.id); get.onsuccess = () => {
        const existing = get.result;
        if (existing && existing.revision !== expected || !existing && expected !== 0) { failure = new ConflictError(); tx.abort(); return; }
        const count = store.count(); count.onsuccess = () => {
          if (!existing && count.result >= config.draftLimit) { failure = Error('50 drafts reached. Export or delete a draft before creating another.'); tx.abort(); return; }
          if (existing && !existing.studio && next.studio) {
            const backups = tx.objectStore('migrationBackup'), original = backups.get(draft.id);
            original.onsuccess = () => backups.put(original.result ? { ...original.result, studioBaseline: existing } : { id: draft.id, payload: existing });
          }
          store.put(next);
          const campaignRecords = tx.objectStore('meta').getAll();
          campaignRecords.onsuccess = () => {
            for (const record of campaignRecords.result) if (record.id.startsWith('campaign-v5:') && record.value?.kind === 'campaign' && record.value.campaign.draftIds.includes(next.id)) {
              try {
                const metadata = refreshCampaignDraft(record.value, next);
                metadata.campaign.revision++; metadata.campaign.updatedAt = next.updatedAt;
                const pending = metadata.campaign.draftIds.map((id: string) => id === next.id ? undefined : store.get(id));
                const related: Draft[] = [next]; let remaining = pending.filter(Boolean).length;
                const write = () => { validateCampaignBundle({ ...metadata, drafts: related }); tx.objectStore('meta').put({ id: record.id, value: metadata }); };
                if (!remaining) write();
                pending.forEach(req => { if (req) req.onsuccess = () => { try { related.push(req.result); if (!--remaining) write(); } catch (e) { failure = e as Error; tx.abort(); } }; });
              } catch (e) { failure = e as Error; tx.abort(); return; }
            }
          };
          const revisions = tx.objectStore('revisions'); const read = revisions.get(draft.id);
          read.onsuccess = () => revisions.put({ id: draft.id, snapshots: [...(read.result?.snapshots || []), next].slice(-config.recoveryLimit) });
        };
      };
      tx.oncomplete = () => resolve(next); tx.onerror = () => reject(failure || tx.error || Error('Could not save.')); tx.onabort = () => reject(failure || tx.error || Error('Could not save.'));
    });
  }
  async remove(id: string, expected?: number): Promise<void> {
    const db = await this.open(); const tx = db.transaction(['drafts', 'revisions','meta','migrationBackup'], 'readwrite');
    let conflict = false; const read = tx.objectStore('drafts').get(id);
    read.onsuccess = () => { if (expected !== undefined && read.result && read.result.revision !== expected) { conflict = true; tx.abort(); } else { tx.objectStore('drafts').delete(id); tx.objectStore('revisions').delete(id); tx.objectStore('migrationBackup').delete(id); removeCampaignMetadata(tx, [id]); } };
    try { await complete(tx); } catch (e) { if (conflict) throw new ConflictError(); throw e; }
  }
  async revisions(id: string): Promise<Draft[]> { const db = await this.open(); const v = await request(db.transaction('revisions').objectStore('revisions').get(id)); return (v?.snapshots || []).filter((d: unknown) => { try { validateDraft(d); return true; } catch { return false; } }); }
  async meta<T>(id: string, fallback: T): Promise<T> { const db = await this.open(); const v = await request(db.transaction('meta').objectStore('meta').get(id)); return v ? v.value as T : fallback; }
  async setMeta(id: string, value: unknown): Promise<void> { const db = await this.open(); const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ id, value }); await complete(tx); }
  async campaignMetadata(): Promise<CampaignMetadata[]> {
    const db = await this.open(); const records = await request(db.transaction('meta').objectStore('meta').getAll());
    return records.filter((r: any) => r.id.startsWith('campaign-v5:') && r.value?.kind === 'campaign').map((r: any) => r.value);
  }
  async addImported(drafts: Draft[], snippets: Snippet[], brandProfile?: Brand, preferences?: Preferences, campaigns: CampaignMetadata[] = []): Promise<void> {
    for (const d of drafts) validateDraft(d); validateSnippets(snippets); if (brandProfile) validateBrand(brandProfile); if (preferences) validatePreferences(preferences);
    for (const c of campaigns) validateCampaignBundle({ ...c, drafts: c.campaign.draftIds.map(id => drafts.find(d => d.id === id)) });
    const db = await this.open(); const tx = db.transaction(['drafts', 'revisions', 'meta'], 'readwrite');
    let failure: Error | undefined;
    const count = tx.objectStore('drafts').count(); count.onsuccess = () => {
      if (count.result + drafts.length > config.draftLimit) { failure = Error('Import exceeds 50 drafts including Trash.'); tx.abort(); return; }
      for (const d of drafts) { tx.objectStore('drafts').add(d); tx.objectStore('revisions').add({ id: d.id, snapshots: [d] }); }
      for (const c of campaigns) tx.objectStore('meta').add({ id: `campaign-v5:${c.campaign.id}`, value: c });
      tx.objectStore('meta').put({ id: 'snippets', value: snippets });
      if (count.result === 0 && preferences) tx.objectStore('meta').put({ id: 'preferences', value: preferences });
      if (brandProfile) { const read = tx.objectStore('meta').get('brandProfile'); read.onsuccess = () => { if (!read.result) tx.objectStore('meta').put({ id: 'brandProfile', value: brandProfile }); }; }
    };
    try { await complete(tx); } catch(e) { throw failure || e; }
  }
  async purgeTrash(drafts: Draft[]): Promise<void> {
    const db = await this.open(); const tx = db.transaction(['drafts','revisions','meta','migrationBackup'], 'readwrite'); let conflict = false;
    removeCampaignMetadata(tx, drafts.map(d => d.id));
    for (const d of drafts) { const read = tx.objectStore('drafts').get(d.id); read.onsuccess = () => { if (read.result?.revision !== d.revision || !read.result?.studio?.trashedAt) { conflict = true; tx.abort(); return; } tx.objectStore('drafts').delete(d.id); tx.objectStore('revisions').delete(d.id); tx.objectStore('migrationBackup').delete(d.id); }; }
    try { await complete(tx); } catch(e) { if (conflict) throw new ConflictError(); throw e; }
  }
  async clear(): Promise<void> { const db = await this.open(); const tx = db.transaction(STORES, 'readwrite'); for (const name of STORES) tx.objectStore(name).clear(); await complete(tx); }
  async clearDrafts(): Promise<void> {
    const db = await this.open(); const tx = db.transaction(STORES, 'readwrite');
    for (const name of ['drafts', 'revisions', 'migrationBackup']) tx.objectStore(name).clear();
    removeCampaignMetadata(tx);
    tx.objectStore('meta').delete('active'); await complete(tx);
  }
  async importBackup(backup: Backup, expected?: unknown[]): Promise<void> {
    parseImport(JSON.stringify(backup));
    const db = await this.open(); const tx = db.transaction(['drafts', 'revisions', 'meta'], 'readwrite');
    let conflict = false;
    const replace = () => {
      for (const name of ['drafts', 'revisions']) tx.objectStore(name).clear();
      for (const d of backup.drafts) { tx.objectStore('drafts').put(d); tx.objectStore('revisions').put({ id: d.id, snapshots: [d] }); }
      const meta = tx.objectStore('meta'); meta.clear();
      for (const c of backup.campaigns || []) meta.put({ id: `campaign-v5:${c.campaign.id}`, value: c });
      for (const [id, value] of Object.entries({ snippets: backup.snippets, preferences: backup.preferences, recent: backup.recent, ...(backup.brandProfile ? { brandProfile: backup.brandProfile } : {}) })) meta.put({ id, value });
    };
    if (expected) { const read = tx.objectStore('drafts').getAll(); read.onsuccess = () => { if (JSON.stringify(read.result) !== JSON.stringify(expected)) { conflict = true; tx.abort(); } else replace(); }; } else replace();
    try { await complete(tx); } catch(e) { if (conflict) throw new ConflictError(); throw e; }
  }

  async migrate(raw: unknown): Promise<Draft> {
    // Only the documented legacy schema is accepted; retain the original atomically.
    const old = raw as { schemaVersion?: number; id?: string; title?: string; text?: string };
    if (old?.schemaVersion !== 0 || typeof old.text !== 'string' || typeof old.id !== 'string') throw Error('Unsupported migration. Export the original payload before deletion.');
    const next = { ...newDraft(undefined, old.title || 'Recovered legacy post'), id: old.id };
    next.editorDocument = fromText(old.text); validateDoc(next.editorDocument); validateDraft(next);
    const db = await this.open(); const tx = db.transaction(['drafts', 'migrationBackup', 'revisions'], 'readwrite');
    const read = tx.objectStore('drafts').get(old.id); let mismatch = false;
    read.onsuccess = () => { if (JSON.stringify(read.result) !== JSON.stringify(raw)) { mismatch = true; tx.abort(); return; } tx.objectStore('migrationBackup').put({ id: old.id, payload: raw }); tx.objectStore('drafts').put(next); tx.objectStore('revisions').put({ id: old.id, snapshots: [next] }); };
    try { await complete(tx); } catch(e) { if (mismatch) throw new ConflictError(); throw e; } return next;
  }
}
/** Permanent deletion removes related campaign metadata/history; other drafts stay independent. */
function removeCampaignMetadata(tx: IDBTransaction, draftIds?: string[]) {
  const meta = tx.objectStore('meta'); const read = meta.getAll();
  read.onsuccess = () => {
    for (const record of read.result) if (record.id.startsWith('campaign-v5:') && (!draftIds || record.value?.kind === 'campaign' && record.value.campaign.draftIds.some((id: string) => draftIds.includes(id)))) {
      meta.delete(record.id); meta.delete(`${record.id}:history`);
    }
  };
}
function request<T = any>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function complete(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('Storage transaction aborted.')); }); }
export const storage = new Store();
export const defaultPreferences: Preferences = { theme: 'light', guidance: true, dismissedIntro: false };
export type LocalData = { snippets: Snippet[]; preferences: Preferences; recent: string[] };
