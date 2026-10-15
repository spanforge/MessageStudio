import { Store, ConflictError } from '../storage';
import { config } from '../config';
import { validateCampaignBundle, type CampaignBundle } from './model';
import { remapCampaign } from './transfer';

const key = (id: string) => `campaign-v5:${id}`;
type SavedCampaign = Omit<CampaignBundle, 'drafts'>;
const read = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });

/** Uses the existing database; all related writes and recovery snapshots commit together. */
export class CampaignStore {
  constructor(private store = new Store()) {}
  async get(id: string): Promise<CampaignBundle | undefined> {
    const db = await this.store.open();
    const tx = db.transaction(['meta', 'drafts']);
    const record = await read(tx.objectStore('meta').get(key(id)));
    if (!record) return undefined;
    const bundle = record.value as SavedCampaign;
    // Schedule draft reads inside the request callback's microtask, before the transaction closes.
    const drafts = await Promise.all(bundle.campaign.draftIds.map(d => read(tx.objectStore('drafts').get(d))));
    const result = { ...bundle, drafts }; validateCampaignBundle(result); return result;
  }
  async list(): Promise<CampaignBundle[]> {
    const db = await this.store.open();
    const records = await read(db.transaction('meta').objectStore('meta').getAll());
    const result: CampaignBundle[] = [];
    for (const record of records.filter(r => typeof r.id === 'string' && r.id.startsWith('campaign-v5:') && r.value?.kind === 'campaign')) {
      const bundle = await this.get(record.id.slice('campaign-v5:'.length));
      if (bundle) result.push(bundle);
    }
    return result;
  }
  async import(bundle: CampaignBundle): Promise<CampaignBundle> {
    const incoming = remapCampaign(bundle);
    // New local identities start with revision zero; receipts were discarded by remapping.
    incoming.drafts = incoming.drafts.map(d => ({ ...d, revision: 0 }));
    return this.save(incoming, null);
  }
  /** null means create-only; otherwise both campaign and draft revisions must match. */
  async save(bundle: CampaignBundle, expected: number | null, sourceGuard?: CampaignBundle): Promise<CampaignBundle> {
    validateCampaignBundle(bundle);
    if (expected !== null && bundle.campaign.revision !== expected) throw new ConflictError();
    const db = await this.store.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['meta','drafts','revisions','migrationBackup'], 'readwrite');
      let failure: Error | undefined;
      const abort = (error: Error) => { failure = error; tx.abort(); };
      const next = structuredClone(bundle);
      const now = new Date().toISOString();
      next.campaign.revision = (expected ?? 0) + 1; next.campaign.updatedAt = now;
      const meta = tx.objectStore('meta'), drafts = tx.objectStore('drafts');
      if (sourceGuard) {
        const sourceRead = meta.get(key(sourceGuard.campaign.id));
        sourceRead.onsuccess = () => {
          if (sourceRead.result?.value?.campaign.revision !== sourceGuard.campaign.revision) abort(new ConflictError());
        };
        for (const draft of sourceGuard.drafts) {
          const sourceDraft = drafts.get(draft.id);
          sourceDraft.onsuccess = () => { if (sourceDraft.result?.revision !== draft.revision) abort(new ConflictError()); };
        }
      }
      const campaignRead = meta.get(key(bundle.campaign.id));
      campaignRead.onsuccess = () => {
        const old = campaignRead.result?.value as SavedCampaign | undefined;
        if (expected === null ? !!old : !old || old.campaign.revision !== expected) { abort(new ConflictError()); return; }
        if (old && JSON.stringify(old.campaign.draftIds) !== JSON.stringify(bundle.campaign.draftIds)) { abort(Error('Changing campaign draft membership requires a reviewed migration.')); return; }
        const all = drafts.getAll();
        all.onsuccess = () => {
          const saved = new Map(all.result.map(d => [d.id, d]));
          const additions = bundle.drafts.filter(d => !saved.has(d.id)).length;
          if (saved.size + additions > config.draftLimit) { abort(Error('Import exceeds 50 drafts including Trash.')); return; }
          for (const d of bundle.drafts) {
            const current = saved.get(d.id);
            if (current ? current.revision !== d.revision : d.revision !== 0) { abort(new ConflictError()); return; }
          }
          const memberships = meta.getAll();
          memberships.onsuccess = () => {
            if (memberships.result.some(record => record.value?.kind === 'campaign' && record.value.campaign.id !== bundle.campaign.id && record.value.campaign.draftIds.some((id: string) => bundle.campaign.draftIds.includes(id)))) { abort(Error('A draft can belong to only one campaign.')); return; }
            const prior = meta.get(`${key(bundle.campaign.id)}:history`);
            prior.onsuccess = () => {
            if (old) meta.put({ id: `${key(bundle.campaign.id)}:history`, value: [...(prior.result?.value || []), { ...old, drafts: bundle.drafts.map(d => saved.get(d.id)) }].slice(-config.recoveryLimit) });
            next.drafts = next.drafts.map(d => ({ ...d, revision: d.revision + 1, updatedAt: now }));
            const { drafts: _drafts, ...metadata } = next;
            meta.put({ id: key(next.campaign.id), value: metadata });
            for (const d of next.drafts) {
              const current = saved.get(d.id);
              if (current) {
                const original = tx.objectStore('migrationBackup').get(d.id);
                original.onsuccess = () => {
                  if (!original.result) tx.objectStore('migrationBackup').put({ id: d.id, payload: current });
                };
              }
              drafts.put(d);
              const snapshots = tx.objectStore('revisions').get(d.id);
              snapshots.onsuccess = () => tx.objectStore('revisions').put({ id: d.id, snapshots: [...(snapshots.result?.snapshots || []), d].slice(-config.recoveryLimit) });
            }
            };
          };
        };
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = tx.onabort = () => reject(failure || tx.error || Error('Campaign transaction failed.'));
    });
  }
}
