import type { Doc } from './model';
import { destinations, objectives, boundIds, safeUrl, type Studio } from './studio';
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 5000) => typeof v === 'string' && v.length <= max;
const integer = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const exact = (v: Record<string, any>, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
export function validateBrand(v: unknown): void {
  if (!record(v) || !exact(v, ['name', 'spelling', 'alternatives', 'website', 'cta', 'phrases', 'unicode', 'revision']) || !str(v.name,160) || !str(v.spelling,160) || !str(v.website) || v.website && !safeUrl(v.website) || !str(v.cta) || !integer(v.revision) || typeof v.unicode !== 'boolean') throw Error('Invalid brand profile.');
  for (const key of ['alternatives', 'phrases']) if (!Array.isArray(v[key]) || v[key].length > 100 || v[key].some((x: unknown) => !str(x))) throw Error('Invalid brand phrases.');
}
export function validateStudio(value: unknown, original: Doc, validateDoc: (v: unknown) => void): asserts value is Studio {
  if (!record(value) || !exact(value, ['bundleSchemaVersion', 'mode', 'activeDestination', 'editingOriginal', 'originalRevision', 'unicode', 'emailRich', 'objective', 'brief', 'versions', 'sharedDetails', 'exceptions', 'brandProfileSnapshot', 'campaign', 'trashedAt']) || value.bundleSchemaVersion !== 3 || !['quick','studio'].includes(value.mode) || !destinations.includes(value.activeDestination) || !Object.hasOwn(objectives, value.objective) || !integer(value.originalRevision) || ['unicode','emailRich','editingOriginal'].some(k => typeof value[k] !== 'boolean') || !record(value.versions) || !Array.isArray(value.sharedDetails) || value.sharedDetails.length > 100 || !Array.isArray(value.exceptions) || value.exceptions.length > 400) throw Error('Invalid Message Studio bundle.');
  if (value.campaign !== undefined && !str(value.campaign,160) || value.trashedAt !== undefined && !date(value.trashedAt)) throw Error('Invalid campaign or Trash metadata.');
  const ids = new Set<string>();
  for (const d of value.sharedDetails) {
    if (!record(d) || !exact(d,['id','label','kind','canonicalValue','targetUrl','revision','requiredDestinations']) || !str(d.id,100) || !d.id || ids.has(d.id) || !str(d.label,160) || !d.label || !['date','price','name','link','phrase'].includes(d.kind) || !str(d.canonicalValue) || !d.canonicalValue || /[\r\n]/.test(d.canonicalValue) || !integer(d.revision) || !Array.isArray(d.requiredDestinations) || d.requiredDestinations.length > 4 || new Set(d.requiredDestinations).size !== d.requiredDestinations.length || d.requiredDestinations.some((id: any) => !destinations.includes(id)) || d.targetUrl !== undefined && (!str(d.targetUrl) || !safeUrl(d.targetUrl)) || d.kind === 'link' && !safeUrl(d.targetUrl || d.canonicalValue)) throw Error('Invalid shared detail.');
    ids.add(d.id);
  }
  const checkDoc = (doc: Doc) => { validateDoc(doc); for (const id of boundIds(doc)) if (!ids.has(id)) throw Error('Dangling detail reference.'); for (const p of doc.content) for (const n of p.content || []) if (n.type === 'sharedDetail' && value.sharedDetails.find((d: any) => d.id === n.attrs.detailId).canonicalValue !== n.attrs.value) throw Error('Detail cache differs from canonical value.'); };
  checkDoc(original);
  for (const [id,v] of Object.entries(value.versions)) {
    if (!destinations.includes(id as any) || !record(v) || !exact(v,['overrideDocument','basedOnOriginalRevision','revision','subject','receipt']) || !integer(v.basedOnOriginalRevision) || !integer(v.revision)) throw Error('Invalid destination version.');
    if (v.overrideDocument !== undefined) checkDoc(v.overrideDocument); checkDoc(v.subject);
    if (v.receipt) { const r = v.receipt; if (!record(r) || !exact(r,['hash','mode','copiedAt','profileVersion','originalRevision','versionRevision']) || !str(r.hash,160) || !['plain','text','rich'].includes(r.mode) || !date(r.copiedAt) || !integer(r.profileVersion) || !integer(r.originalRevision) || !integer(r.versionRevision)) throw Error('Invalid copy receipt.'); }
  }
  for (const e of value.exceptions) if (!record(e) || !exact(e,['detailId','destination','revision','reason']) || !ids.has(e.detailId) || !destinations.includes(e.destination) || !integer(e.revision) || !str(e.reason,500) || !e.reason.trim()) throw Error('Invalid destination exception.');
  if (value.brief) {
    const b = value.brief;
    if (!record(b) || !exact(b,['audienceText','customerProblemText','productName','valueStatement','differentiationEvidence','desiredActionText','desiredActionUrl','requiredDetailIds','revision','updatedAt']) || !integer(b.revision) || !date(b.updatedAt) || !Array.isArray(b.requiredDetailIds) || b.requiredDetailIds.length > 100 || b.requiredDetailIds.some((id: unknown) => !ids.has(id as string))) throw Error('Invalid message brief.');
    for (const key of ['audienceText','customerProblemText','productName','valueStatement','differentiationEvidence','desiredActionText','desiredActionUrl']) if (b[key] !== undefined && !str(b[key])) throw Error('Brief field exceeds limits.');
    if (b.desiredActionUrl && !safeUrl(b.desiredActionUrl)) throw Error('Invalid CTA URL.');
  }
  if (value.brandProfileSnapshot !== undefined) validateBrand(value.brandProfileSnapshot);
}
