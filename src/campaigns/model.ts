import { validateFactValue, type FactValue } from '../facts/values';
import { validateFactTemplate, type FactTemplate } from '../facts/templates';
import { validateDraft, type Draft } from '../model';
import { destinations, state, type Destination } from '../studio';

export type Fact = { id: string; label: string; value: FactValue; revision: number; requiredDestinations: Destination[]; previousValues: FactValue[]; metadata: { legacyDetailId?: string } };
export type Occurrence = { id: string; factId: string; draftId: string; documentNodeId: string; destinationId: Destination; templateId: string; exception?: { revision: number; reason: string } };
export type Campaign = { id: string; title: string; recurrenceLabel?: string; createdAt: string; updatedAt: string; revision: number; factIds: string[]; draftIds: string[]; parentCampaignId?: string };
export type CampaignBundle = { schemaVersion: 5; kind: 'campaign'; campaign: Campaign; facts: Fact[]; templates: FactTemplate[]; occurrences: Occurrence[]; drafts: Draft[] };
const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 200) => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/u.test(v);
const revision = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
function shape(v: unknown, keys: string[]): asserts v is Record<string, any> {
  if (!obj(v) || Object.keys(v).some(k => !keys.includes(k))) throw Error('Invalid campaign fields.');
}
function ids(v: unknown, max: number): asserts v is string[] {
  if (!Array.isArray(v) || v.length > max || v.some(id => !str(id,100)) || new Set(v).size !== v.length) throw Error('Invalid or duplicate campaign IDs.');
}
function collection(v: unknown, max: number): asserts v is Record<string, any>[] {
  if (!Array.isArray(v) || v.length > max || v.some(item => !obj(item) || !str(item.id,100)) || new Set(v.map(item => item.id)).size !== v.length) throw Error('Invalid or duplicate campaign records.');
}
export function validateCampaignBundle(value: unknown): asserts value is CampaignBundle {
  shape(value,['schemaVersion','kind','campaign','facts','templates','occurrences','drafts']);
  if (value.schemaVersion !== 5 || value.kind !== 'campaign') throw Error('Unsupported campaign schema.');
  const c = value.campaign;
  shape(c,['id','title','recurrenceLabel','createdAt','updatedAt','revision','factIds','draftIds','parentCampaignId']);
  const timestamp = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s) && Number.isFinite(Date.parse(s));
  if (!str(c.id,100) || !str(c.title) || !revision(c.revision) || !timestamp(c.createdAt) || !timestamp(c.updatedAt) || c.recurrenceLabel !== undefined && !str(c.recurrenceLabel) || c.parentCampaignId !== undefined && (!str(c.parentCampaignId,100) || c.parentCampaignId === c.id)) throw Error('Invalid campaign metadata.');
  ids(c.factIds,100); ids(c.draftIds,50);
  collection(value.facts,100); collection(value.templates,400); collection(value.occurrences,2000); collection(value.drafts,50);
  if (c.factIds.length !== value.facts.length || c.factIds.some((id: string) => !value.facts.some((f: Record<string, any>) => f.id === id)) || c.draftIds.length !== value.drafts.length || c.draftIds.some((id: string) => !value.drafts.some((d: Record<string, any>) => d.id === id))) throw Error('Campaign relationships do not match records.');
  for (const f of value.facts) {
    shape(f,['id','label','value','revision','requiredDestinations','previousValues','metadata']);
    if (!str(f.label,160) || !revision(f.revision)) throw Error('Invalid fact metadata.');
    ids(f.requiredDestinations,4);
    if (f.requiredDestinations.some((id: any) => !destinations.includes(id))) throw Error('Invalid required destination.');
    validateFactValue(f.value);
    if (!Array.isArray(f.previousValues) || f.previousValues.length > 100) throw Error('Invalid previous fact values.');
    for (const previous of f.previousValues) { validateFactValue(previous); if (previous.type !== f.value.type) throw Error('Previous fact type differs.'); }
    shape(f.metadata,['legacyDetailId']);
    if (f.metadata.legacyDetailId !== undefined && !str(f.metadata.legacyDetailId,100)) throw Error('Invalid legacy detail ID.');
  }
  for (const t of value.templates) validateFactTemplate(t);
  for (const d of value.drafts) validateDraft(d);
  for (const f of value.facts) if (f.metadata.legacyDetailId) {
    const detail = value.drafts.flatMap(d => state(d as Draft).sharedDetails).find(d => d.id === f.metadata.legacyDetailId);
    if (!detail) throw Error('Dangling legacy fact link.');
    const canonical = detail.typed?.value || { type:'literal',text:detail.canonicalValue };
    if (JSON.stringify(canonical) !== JSON.stringify(f.value) || detail.revision !== f.revision) throw Error('Campaign fact differs from its source detail.');
  }
  for (const o of value.occurrences) {
    shape(o,['id','factId','draftId','documentNodeId','destinationId','templateId','exception']);
    const t = value.templates.find(t => t.id === o.templateId);
    const f = value.facts.find(f => f.id === o.factId);
    if (!f || !c.draftIds.includes(o.draftId) || !str(o.documentNodeId,100) || !destinations.includes(o.destinationId) || !t || t.destinationId !== o.destinationId) throw Error('Dangling campaign occurrence.');
    if (o.exception !== undefined) {
      shape(o.exception,['revision','reason']);
      if (!revision(o.exception.revision) || o.exception.revision > f.revision || !str(o.exception.reason,500)) throw Error('Invalid occurrence exception.');
    }
  }
}
export function updateFact(fact: Fact, value: FactValue): Fact {
  validateFactValue(value);
  if (value.type !== fact.value.type) throw Error('Changing fact type requires a new fact.');
  if (JSON.stringify(value) === JSON.stringify(fact.value)) return structuredClone(fact);
  if (fact.previousValues.length >= 100) throw Error('Fact history limit reached. Export before creating a replacement fact.');
  return { ...structuredClone(fact), value: structuredClone(value), revision: fact.revision + 1, previousValues: [...structuredClone(fact.previousValues), structuredClone(fact.value)] };
}
