import { describe, expect, it } from 'vitest';
import { fromText, newDraft } from '../../src/model';
import { initialStudio } from '../../src/studio';
import { defaultFactTemplate, renderFactValue } from '../../src/facts/templates';
import { updateFact, validateCampaignBundle } from '../../src/campaigns/model';
import { campaignFromLegacy, exportCampaign, parseCampaignImport, remapCampaign } from '../../src/campaigns/transfer';

export function campaignFixture() {
  const d = newDraft(fromText('Launch 18 October'));
  d.studio = { ...initialStudio(), sharedDetails: [{ id: 'legacy-date', label: 'Date', kind: 'date', canonicalValue: '18 October', revision: 0, requiredDestinations: ['whatsapp'] }] };
  d.editorDocument.content[0].content = [{ type: 'text', text: 'Launch ' }, { type: 'sharedDetail', attrs: { detailId: 'legacy-date', value: '18 October', nodeId: 'node-1' } }];
  return campaignFromLegacy(d);
}
describe('campaign contracts and transfer', () => {
  it('round-trips legacy display values as literals without guessing dates or altering drafts', () => {
    const bundle = campaignFixture();
    expect(bundle.facts[0].value).toEqual({ type: 'literal', text: '18 October' });
    expect(parseCampaignImport(exportCampaign(bundle))).toEqual(bundle);
    expect(bundle.drafts[0].editorDocument.content[0].content![1].type).toBe('sharedDetail');
  });
  it('remaps relationships, legacy IDs and receipts consistently without touching the source', () => {
    const bundle = campaignFixture(), d = bundle.drafts[0];
    d.studio!.versions.whatsapp = { revision: 0, basedOnOriginalRevision: 0, subject: fromText(''), receipt: { hash: 'old', mode: 'text', copiedAt: new Date().toISOString(), profileVersion: 1, originalRevision: 0, versionRevision: 0 } };
    const copy = remapCampaign(bundle);
    expect(copy.campaign.id).not.toBe(bundle.campaign.id);
    expect(copy.campaign.factIds).toEqual(copy.facts.map(f => f.id));
    expect(copy.campaign.draftIds).toEqual(copy.drafts.map(d => d.id));
    expect(copy.facts[0].metadata.legacyDetailId).toBe(copy.drafts[0].studio!.sharedDetails[0].id);
    expect(copy.drafts[0].studio!.versions.whatsapp!.receipt).toBeUndefined();
    expect(d.studio!.versions.whatsapp.receipt).toBeDefined();
  });
  it('rejects dangling references, duplicate IDs and incompatible templates', () => {
    const bundle = campaignFixture();
    bundle.occurrences.push({ id: crypto.randomUUID(), factId: bundle.facts[0].id, draftId: bundle.drafts[0].id, documentNodeId: 'node-1', destinationId: 'whatsapp', templateId: bundle.templates[0].id });
    expect(() => validateCampaignBundle(bundle)).toThrow('Dangling');
    bundle.occurrences.at(-1)!.templateId = bundle.templates.find(t => t.destinationId === 'whatsapp')!.id; validateCampaignBundle(bundle);
    const bad = structuredClone(bundle); bad.facts.push(structuredClone(bad.facts[0])); expect(() => validateCampaignBundle(bad)).toThrow('duplicate');
    bundle.occurrences[0].factId = 'missing'; expect(() => validateCampaignBundle(bundle)).toThrow('Dangling');
  });
  it('retains previous approved values and increments only meaningful revisions', () => {
    const f = campaignFixture().facts[0];
    expect(updateFact(f, f.value).revision).toBe(0);
    const updated = updateFact(f, { type: 'literal', text: '19 October' });
    expect(updated.previousValues).toEqual([f.value]); expect(updated.revision).toBe(1); expect(f.previousValues).toEqual([]);
    expect(() => updateFact(f, { type: 'date', date: '2026-10-19' })).toThrow('type');
  });
});
describe('deterministic fact templates', () => {
  it('renders every type without changing canonical values or rounding money', () => {
    const t = defaultFactTemplate('whatsapp'); t.zoneDisplay = 'hidden';
    expect(renderFactValue({ type: 'time', time: '18:00', timeZone: 'Asia/Kolkata' }, t)).toBe('6 PM');
    expect(renderFactValue({ type: 'time', time: '00:05', timeZone: 'Asia/Kolkata' }, t)).toBe('12:05 AM');
    t.timeStyle = '24h'; expect(renderFactValue({ type: 'datetime', date: '2026-10-18', time: '18:00', timeZone: 'Asia/Kolkata' }, t)).toContain('18:00');
    const money = { type: 'money' as const, amount: '999999999999999999.01', currency: 'INR' };
    expect(renderFactValue(money,t)).toBe('INR 999999999999999999.01'); t.currencyDisplay = 'symbol'; expect(renderFactValue(money,t)).toBe('₹999999999999999999.01');
    expect(renderFactValue({ type: 'phone', number: '+919876543210', originalDisplay: '+91 98765 43210' }, t)).toBe('+919876543210');
    expect(renderFactValue({ type: 'url', url: 'https://example.com/?q=1', label: 'Register' }, t)).toBe('https://example.com/?q=1');
    expect(renderFactValue({ type: 'literal', text: 'தமிழ் हिन्दी' }, t)).toBe('தமிழ் हिन्दी');
  });
  it('rejects unsupported template fields instead of silently accepting a display change', () => {
    const t = { ...defaultFactTemplate('email'), locale: 'unknown' };
    expect(() => renderFactValue({ type: 'literal', text: 'hello' }, t as any)).toThrow('template');
  });
});
