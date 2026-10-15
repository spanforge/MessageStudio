import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Store, defaultPreferences } from '../../src/storage';
import { CampaignStore } from '../../src/campaigns/storage';
import { campaignFromLegacy, remapWorkspaceBackup } from '../../src/campaigns/transfer';
import { fromText, newDraft, parseImport, type Backup } from '../../src/model';
import { initialStudio, updateTypedDetail } from '../../src/studio';
const store = new Store(), campaigns = new CampaignStore(store);
function fixture() {
  const d = newDraft(fromText(''));
  d.studio = { ...initialStudio(), sharedDetails:[{ id:'date',label:'Date',kind:'date',canonicalValue:'18 October',revision:0,requiredDestinations:[] }] };
  d.editorDocument.content[0].content = [{ type:'sharedDetail',attrs:{ detailId:'date',value:'18 October',nodeId:'node-date' } }];
  return updateTypedDetail(d,'date',{type:'date',date:'2026-10-18'});
}
beforeEach(async () => { await store.clear(); });
describe('campaign workspace lifecycle', () => {
  it('includes campaign relationships in workspace round-trip and remaps import atomically', async () => {
    const saved = await campaigns.save(campaignFromLegacy(fixture()),null);
    const backup: Backup = {schemaVersion:1,kind:'backup',drafts:saved.drafts,snippets:[],preferences:defaultPreferences,recent:[],campaigns:await store.campaignMetadata()};
    expect(parseImport(JSON.stringify(backup))).toEqual(backup);
    const imported = remapWorkspaceBackup(backup);
    expect(imported.campaigns![0].campaign.draftIds).toEqual(imported.drafts.map(d => d.id));
    await store.addImported(imported.drafts,[],undefined,undefined,imported.campaigns);
    const restored = await campaigns.get(imported.campaigns![0].campaign.id);
    expect(restored!.facts[0].value).toEqual({type:'date',date:'2026-10-18'});
    expect(await store.list()).toHaveLength(2);
  });
  it('keeps facts and node identities consistent through edit and reviewed restoration', async () => {
    const saved = await campaigns.save(campaignFromLegacy(fixture()),null), old = saved.drafts[0];
    const changed = updateTypedDetail(old,'date',{type:'date',date:'2026-10-19'});
    const newDraft = await store.save(changed,old.revision);
    const updated = (await campaigns.get(saved.campaign.id))!;
    expect(updated.facts[0].previousValues).toEqual([{type:'date',date:'2026-10-18'}]);
    expect(updated.occurrences.map(o => o.id)).toEqual(saved.occurrences.map(o => o.id));
    await store.save({...old,revision:newDraft.revision},newDraft.revision);
    const restored = (await campaigns.get(saved.campaign.id))!;
    expect(restored.facts[0].value).toEqual({type:'date',date:'2026-10-18'});
    expect(restored.facts[0].previousValues).toEqual([]);
  });
  it('retains campaign metadata in Trash and removes it only on permanent purge', async () => {
    const saved = await campaigns.save(campaignFromLegacy(fixture()),null), d = saved.drafts[0];
    const trashed = await store.save({...d,studio:{...d.studio!,trashedAt:new Date().toISOString()}},d.revision);
    expect(await store.campaignMetadata()).toHaveLength(1);
    await store.purgeTrash([trashed]);
    expect(await store.campaignMetadata()).toHaveLength(0);
    expect(await campaigns.list()).toHaveLength(0); expect(await store.list()).toHaveLength(0);
  });
  it('preserves unrelated metadata when deleting all drafts, and rejects duplicate ownership', async () => {
    const saved = await campaigns.save(campaignFromLegacy(fixture()),null);
    await expect(campaigns.save(campaignFromLegacy(saved.drafts[0]),null)).rejects.toThrow('one campaign');
    await store.setMeta('snippets',[{id:'s',title:'Saved',text:'Keep'}]);
    await store.clearDrafts(); expect(await store.campaignMetadata()).toHaveLength(0);
    expect(await store.meta('snippets',[])).toHaveLength(1);
  });
  it('rejects malformed campaign backups before replacing any workspace records', async () => {
    const saved = await campaigns.save(campaignFromLegacy(fixture()),null);
    const backup: Backup = {schemaVersion:1,kind:'backup',drafts:saved.drafts,snippets:[],preferences:defaultPreferences,recent:[],campaigns:await store.campaignMetadata()};
    backup.campaigns![0].campaign.draftIds = ['missing'];
    await expect(store.importBackup(backup)).rejects.toThrow();
    expect(await store.list()).toHaveLength(1); expect(await store.campaignMetadata()).toHaveLength(1);
  });
});
