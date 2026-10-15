import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Store, ConflictError } from '../../src/storage';
import { CampaignStore } from '../../src/campaigns/storage';
import { campaignFromLegacy } from '../../src/campaigns/transfer';
import { fromText, newDraft } from '../../src/model';

const drafts = new Store(), campaigns = new CampaignStore(drafts);
beforeEach(async () => { await drafts.clear(); });
describe('atomic campaign persistence', () => {
  it('saves metadata, drafts and recovery snapshots together and round-trips', async () => {
    const source = campaignFromLegacy(newDraft(fromText('Workshop')));
    const saved = await campaigns.save(source, null);
    expect(saved.campaign.revision).toBe(1); expect(saved.drafts[0].revision).toBe(1);
    expect(await campaigns.get(saved.campaign.id)).toEqual(saved);
    expect(await drafts.revisions(saved.drafts[0].id)).toHaveLength(1);
    const updated = await campaigns.save(saved,1);
    expect(updated.campaign.revision).toBe(2); expect(await campaigns.list()).toHaveLength(1);
  });
  it('aborts stale campaign and draft saves without partial mutations', async () => {
    const saved = await campaigns.save(campaignFromLegacy(newDraft(fromText('Old'))),null);
    const changed = structuredClone(saved); changed.drafts[0].editorDocument = fromText('New');
    await drafts.save(changed.drafts[0],1);
    await expect(campaigns.save(changed,1)).rejects.toBeInstanceOf(ConflictError);
    expect((await campaigns.get(saved.campaign.id))!.campaign.revision).toBe(2);
    expect((await drafts.get(saved.drafts[0].id))!.editorDocument).toEqual(fromText('New'));
    await expect(campaigns.save(saved,0)).rejects.toBeInstanceOf(ConflictError);
  });
  it('imports additively with new IDs and rejects invalid input before mutation', async () => {
    const saved = await campaigns.save(campaignFromLegacy(newDraft(fromText('Existing'))),null);
    const imported = await campaigns.import(saved);
    expect(imported.campaign.id).not.toBe(saved.campaign.id); expect(await drafts.list()).toHaveLength(2);
    const bad = structuredClone(saved); bad.campaign.factIds.push('missing');
    await expect(campaigns.import(bad)).rejects.toThrow(); expect(await drafts.list()).toHaveLength(2);
  });
  it('preserves legacy recovery payload on explicit campaign migration', async () => {
    const legacy = await drafts.save(newDraft(fromText('Legacy')),0);
    await campaigns.save(campaignFromLegacy(legacy),null);
    const db = await drafts.open();
    const original = await new Promise<any>((resolve,reject) => { const r = db.transaction('migrationBackup').objectStore('migrationBackup').get(legacy.id); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    expect(original.payload).toEqual(legacy);
  });
});
