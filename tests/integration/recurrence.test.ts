import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { Store, ConflictError, defaultPreferences } from '../../src/storage';
import { CampaignStore } from '../../src/campaigns/storage';
import { duplicateCampaign, type RecurrenceReview } from '../../src/campaigns/duplicate';
import { campaignFromLegacy, remapWorkspaceBackup } from '../../src/campaigns/transfer';
import { fromText, newDraft, sourceText, type Backup } from '../../src/model';
import { initialStudio, updateTypedDetail } from '../../src/studio';

const store = new Store(), campaigns = new CampaignStore(store);
beforeEach(async () => { await store.clear(); });
function fixture() {
  const d = newDraft(fromText(''));
  d.studio = { ...initialStudio(),sharedDetails:[
    { id:'date',label:'Date',kind:'date',canonicalValue:'18 October',revision:0,requiredDestinations:['whatsapp'] },
    { id:'link',label:'Registration',kind:'link',canonicalValue:'https://example.com/old',targetUrl:'https://example.com/old',revision:0,requiredDestinations:[] },
  ] };
  d.editorDocument.content[0].content = [{ type:'sharedDetail',attrs:{detailId:'date',value:'18 October',nodeId:'n1'} },{type:'text',text:' unbound 18 October '},{type:'sharedDetail',attrs:{detailId:'link',value:'https://example.com/old',nodeId:'n2'}}];
  const typed = updateTypedDetail(d,'date',{type:'date',date:'2026-10-18'});
  typed.studio!.versions.email = { revision:0,basedOnOriginalRevision:0,subject:fromText('Independent subject'),overrideDocument:structuredClone(typed.editorDocument),receipt:{hash:'old',mode:'text',copiedAt:new Date().toISOString(),profileVersion:1,originalRevision:0,versionRevision:0} };
  typed.studio!.exceptions = [{detailId:'date',destination:'linkedin',revision:typed.studio!.sharedDetails[0].revision,reason:'Reviewed earlier'}];
  return campaignFromLegacy(typed);
}
function review(source: ReturnType<typeof fixture>): RecurrenceReview {
  return { title:'November workshop',recurrenceLabel:'Monthly',values:Object.fromEntries(source.facts.map(f => [f.id,f.value.type === 'date' ? {type:'date',date:'2026-11-15'} : {type:'literal',text:'https://example.com/new'}])),reviewedLinks:[source.facts[1].id] };
}
it('duplicates all relationships, updates bound values, clears receipts/exceptions and isolates history',async () => {
  const source = await campaigns.save(fixture(),null), before = structuredClone(source);
  const next = duplicateCampaign(source,review(source));
  expect(source).toEqual(before);
  expect(next.campaign.parentCampaignId).toBe(source.campaign.id);
  for (const collection of ['facts','occurrences','drafts','templates'] as const) expect(next[collection].every(item => !source[collection].some(old => old.id === item.id))).toBe(true);
  expect(next.drafts[0].studio!.exceptions).toEqual([]);
  expect(next.drafts[0].studio!.versions.email!.receipt).toBeUndefined();
  expect(sourceText(next.drafts[0].studio!.versions.email!.subject)).toBe('Independent subject');
  expect(sourceText(next.drafts[0].editorDocument)).toContain('unbound 18 October');
  expect(sourceText(next.drafts[0].editorDocument)).toContain('https://example.com/new');
  expect(next.facts[0].value).toEqual({type:'date',date:'2026-11-15'});
  const saved = await campaigns.save(next,null,source);
  expect(await campaigns.get(source.campaign.id)).toEqual(before);
  expect(await campaigns.get(saved.campaign.id)).toEqual(saved);
  expect(await store.revisions(source.drafts[0].id)).toHaveLength(1);
  expect(await store.revisions(saved.drafts[0].id)).toHaveLength(1);
  const backup: Backup = {schemaVersion:1,kind:'backup',drafts:[...source.drafts,...saved.drafts],campaigns:await store.campaignMetadata(),snippets:[],preferences:defaultPreferences,recent:[]};
  const imported = remapWorkspaceBackup(backup);
  const child = imported.campaigns!.find(c => c.campaign.title === 'November workshop')!;
  expect(child.campaign.parentCampaignId).toBe(imported.campaigns!.find(c => c.campaign.title !== 'November workshop')!.campaign.id);
  expect(child.campaign.parentCampaignId).not.toBe(source.campaign.id);
});
it('rejects invalid replacements and unreviewed legacy links', () => {
  const source = fixture(), r = review(source);
  r.reviewedLinks = []; expect(() => duplicateCampaign(source,r)).toThrow('expiry');
  r.reviewedLinks = [source.facts[1].id]; r.values[source.facts[0].id] = {type:'date',date:'2026-02-30'};
  expect(() => duplicateCampaign(source,r)).toThrow('Invalid date');
  delete r.values[source.facts[0].id]; expect(() => duplicateCampaign(source,r)).toThrow('every replacement');
});
it('rejects stale source revisions atomically without adding a campaign or drafts',async () => {
  const source = await campaigns.save(fixture(),null), next = duplicateCampaign(source,review(source));
  await campaigns.save(source,source.campaign.revision);
  await expect(campaigns.save(next,null,source)).rejects.toBeInstanceOf(ConflictError);
  expect(await campaigns.list()).toHaveLength(1);
  expect(await store.list()).toHaveLength(1);
});
