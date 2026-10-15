import { config } from '../config';
import { validateDraft, parseImport, type Draft, type Backup } from '../model';
import { state, remapDraft, destinations, activeDoc, version } from '../studio';
import { defaultFactTemplate } from '../facts/templates';
import { validateCampaignBundle, type CampaignBundle, type Fact } from './model';

export function exportCampaign(bundle: CampaignBundle): string { validateCampaignBundle(bundle); return JSON.stringify(bundle, null, 2); }
export function parseCampaignImport(text: string): CampaignBundle {
  if (new TextEncoder().encode(text).length > config.importBytes) throw Error('Import must be 10 MiB or smaller.');
  const value: unknown = JSON.parse(text); validateCampaignBundle(value);
  return value;
}
/** A new identity map is applied consistently; imported copy receipts are never trusted. */
export function remapCampaign(bundle: CampaignBundle): CampaignBundle {
  validateCampaignBundle(bundle);
  const next = structuredClone(bundle);
  const facts = new Map(next.facts.map(f => [f.id, crypto.randomUUID()]));
  const templates = new Map(next.templates.map(t => [t.id, crypto.randomUUID()]));
  const drafts = new Map(next.drafts.map(d => [d.id, remapDraft(d)]));
  next.campaign.id = crypto.randomUUID();
  next.campaign.revision = 0;
  next.campaign.factIds = next.campaign.factIds.map(id => facts.get(id)!);
  next.campaign.draftIds = next.campaign.draftIds.map(id => drafts.get(id)!.id);
  // Imported lineage cannot establish a relationship with the local workspace.
  delete next.campaign.parentCampaignId;
  next.facts = next.facts.map(f => {
    const metadata = { ...f.metadata };
    if (metadata.legacyDetailId) {
      for (const d of bundle.drafts) {
        const index = state(d).sharedDetails.findIndex(detail => detail.id === metadata.legacyDetailId);
        if (index >= 0) { metadata.legacyDetailId = state(drafts.get(d.id)!).sharedDetails[index].id; break; }
      }
    }
    return { ...f, metadata, id: facts.get(f.id)! };
  });
  next.templates = next.templates.map(t => ({ ...t, id: templates.get(t.id)! }));
  next.occurrences = next.occurrences.map(o => {
    const old = bundle.drafts.find(d => d.id === o.draftId)!, mapped = drafts.get(o.draftId)!;
    const before = [...activeDoc(old,o.destinationId).content, ...(o.destinationId === 'email' ? version(state(old),'email').subject.content : [])].flatMap(p => p.content || []);
    const after = [...activeDoc(mapped,o.destinationId).content, ...(o.destinationId === 'email' ? version(state(mapped),'email').subject.content : [])].flatMap(p => p.content || []);
    const index = before.findIndex(n => n.type === 'sharedDetail' && n.attrs.nodeId === o.documentNodeId);
    const node = after[index];
    return { ...o, id: crypto.randomUUID(), factId: facts.get(o.factId)!, templateId: templates.get(o.templateId)!, draftId: mapped.id, documentNodeId: node?.type === 'sharedDetail' && node.attrs.nodeId ? node.attrs.nodeId : o.documentNodeId };
  });
  next.drafts = [...drafts.values()];
  validateCampaignBundle(next); return next;
}
/** Explicit, non-destructive conversion: legacy display text remains literal, never inferred. */
export function campaignFromLegacy(draft: Draft, now = new Date().toISOString()): CampaignBundle {
  validateDraft(draft);
  const details = state(draft).sharedDetails;
  const facts: Fact[] = details.map(d => ({ id: crypto.randomUUID(), label: d.label, value: d.typed ? structuredClone(d.typed.value) : { type: 'literal', text: d.canonicalValue }, revision: d.revision, requiredDestinations: [...d.requiredDestinations], previousValues: structuredClone(d.typed?.previousValues || []), metadata: { legacyDetailId: d.id } }));
  const template = defaultFactTemplate(state(draft).activeDestination);
  const bundle: CampaignBundle = { schemaVersion: 5, kind: 'campaign', campaign: { id: crypto.randomUUID(), title: state(draft).campaign || draft.title, createdAt: now, updatedAt: now, revision: 0, factIds: facts.map(f => f.id), draftIds: [draft.id] }, facts, templates: [template], occurrences: [], drafts: [structuredClone(draft)] };
  // Existing references stay in the untouched legacy document. Typed occurrences are added
  // only when the editor can supply stable node IDs and the user reviews the binding.
  const metadata = refreshCampaignDraft(bundle, draft);
  const result = { ...metadata, drafts: bundle.drafts };
  validateCampaignBundle(result); return result;
}

export type CampaignMetadata = Omit<CampaignBundle, 'drafts'>;
export function remapWorkspaceBackup(backup: Backup): Backup {
  parseImport(JSON.stringify(backup));
  const remapped = new Map<string, Draft>();
  const campaigns = (backup.campaigns || []).map(c => {
    const bundle = remapCampaign({ ...c, drafts: c.campaign.draftIds.map(id => backup.drafts.find(d => d.id === id)!) });
    c.campaign.draftIds.forEach((id, i) => remapped.set(id, bundle.drafts[i]));
    const { drafts: _drafts, ...metadata } = bundle; return metadata;
  });
  // Restore lineage only when both ends belong to this imported workspace.
  const campaignIds = new Map((backup.campaigns || []).map((c,i) => [c.campaign.id,campaigns[i].campaign.id]));
  (backup.campaigns || []).forEach((c,i) => {
    const parent = c.campaign.parentCampaignId && campaignIds.get(c.campaign.parentCampaignId);
    if (parent) campaigns[i].campaign.parentCampaignId = parent;
  });
  return { ...structuredClone(backup), drafts: backup.drafts.map(d => remapped.get(d.id) || remapDraft(d)), snippets: backup.snippets.map(s => ({ ...s, id: crypto.randomUUID() })), ...(backup.campaigns ? { campaigns } : {}) };
}
/** Reconcile explicit detail edits with the campaign in the same draft-save transaction. */
export function refreshCampaignDraft(input: CampaignMetadata, draft: Draft): CampaignMetadata {
  const result = structuredClone(input);
  // Metadata has no draft documents; only the edited draft's previously linked facts are touched.
  const details = state(draft).sharedDetails;
  const priorIds = new Set(result.occurrences.filter(o => o.draftId === draft.id).map(o => o.factId));
  for (const detail of details) {
    let fact = result.facts.find(f => f.metadata.legacyDetailId === detail.id);
    if (!fact) {
      fact = { id: crypto.randomUUID(), label: detail.label, value: { type: 'literal', text: detail.canonicalValue }, revision: detail.revision, requiredDestinations: [], previousValues: [], metadata: { legacyDetailId: detail.id } };
      result.facts.push(fact); result.campaign.factIds.push(fact.id);
    }
    fact.label = detail.label; fact.value = detail.typed ? structuredClone(detail.typed.value) : { type: 'literal', text: detail.canonicalValue };
    fact.revision = detail.revision; fact.requiredDestinations = [...detail.requiredDestinations]; fact.previousValues = structuredClone(detail.typed?.previousValues || []);
  }
  const priorOccurrences = result.occurrences.filter(o => o.draftId === draft.id);
  result.occurrences = result.occurrences.filter(o => o.draftId !== draft.id);
  for (const destinationId of destinations) {
    const fallback = defaultFactTemplate(destinationId);
    const docs = [activeDoc(draft,destinationId), ...(destinationId === 'email' ? [version(state(draft),'email').subject] : [])];
    for (const doc of docs) for (const p of doc.content) for (const node of p.content || []) {
      if (node.type !== 'sharedDetail' || !node.attrs.nodeId) continue;
      const detail = details.find(d => d.id === node.attrs.detailId)!;
      const fact = result.facts.find(f => f.metadata.legacyDetailId === detail.id)!;
      const previous = priorOccurrences.find(o => o.documentNodeId === node.attrs.nodeId && o.destinationId === destinationId);
      const template = detail.typed?.templates[destinationId] || result.templates.find(t => t.id === previous?.templateId) || fallback;
      result.templates = result.templates.filter(t => t.id !== template.id); result.templates.push(structuredClone(template));
      const exception = state(draft).exceptions.find(e => e.detailId === detail.id && e.destination === destinationId);
      result.occurrences.push({ id: previous?.id || crypto.randomUUID(), factId: fact.id, draftId: draft.id, documentNodeId: node.attrs.nodeId, destinationId, templateId: template.id, ...(exception ? { exception: { revision: exception.revision, reason: exception.reason } } : {}) });
    }
  }
  // Only orphaned facts that belonged to the edited draft are removed.
  result.facts = result.facts.filter(f => !priorIds.has(f.id) || details.some(d => d.id === f.metadata.legacyDetailId) || result.occurrences.some(o => o.factId === f.id));
  result.campaign.factIds = result.facts.map(f => f.id);
  const used = new Set(result.occurrences.map(o => o.templateId));
  result.templates = result.templates.filter(t => used.has(t.id));
  return result;
}
