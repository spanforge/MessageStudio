import { config } from './config';
import type { Studio } from './studio';
import { validateStudio, validateBrand } from './studioValidation';
import { graphemeSegments } from 'unicode-segmenter/grapheme';
import type { Brand } from './studio';
import { validateCampaignBundle } from './campaigns/model';
import type { CampaignMetadata } from './campaigns/transfer';
export type Mark = { type: 'bold' | 'italic' | 'underline' | 'strike' | 'family'; attrs?: { family: 'sans' | 'serif' } };
export type Inline = { type: 'text'; text: string; marks?: Mark[] } | { type: 'sharedDetail'; attrs: { detailId: string; value: string; nodeId?: string | null }; marks?: Mark[] } | { type: 'hardBreak' };
export type Paragraph = { type: 'paragraph'; attrs?: { listType?: 'hyphen' | 'bullet' | 'number' | null }; content?: Inline[] };
export type Doc = { type: 'doc'; content: Paragraph[] };
export type Preferences = { theme: 'light' | 'dark'; guidance: boolean; dismissedIntro: boolean; unicodeDisabled?: boolean };
export type Draft = { schemaVersion: 1; id: string; title: string; createdAt: string; updatedAt: string; revision: number; editorDocument: Doc; preferences: Partial<Preferences>; studio?: Studio };
export type Snippet = { id: string; title: string; text: string };
export type Backup = { schemaVersion: 1; kind: 'backup'; drafts: Draft[]; snippets: Snippet[]; preferences: Preferences; recent: string[]; brandProfile?: Brand; campaigns?: CampaignMetadata[] };
export const normalize = (text: string) => text.replace(/\r\n?/g, '\n');
export function fromText(text: string): Doc { return { type: 'doc', content: normalize(text).split('\n').map(line => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) }; }
export function sourceText(doc: Doc): string { return doc.content.map(p => (p.content || []).map(n => n.type === 'text' ? n.text : n.type === 'sharedDetail' ? n.attrs.value : '\n').join('')).join('\n'); }
export function newDraft(doc = fromText(''), title = 'Untitled post'): Draft { const now = new Date().toISOString(); return { schemaVersion: 1, id: crypto.randomUUID(), title, createdAt: now, updatedAt: now, revision: 0, editorDocument: doc, preferences: {} }; }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
export function validateDoc(value: unknown): asserts value is Doc {
  if (!object(value) || !exact(value, ['type', 'content']) || value.type !== 'doc' || !Array.isArray(value.content) || !value.content.length || value.content.length > config.sourceLimit + 1) throw Error('Invalid document structure.');
  let units = value.content.length - 1; let nodes = value.content.length;
  const nodeIds = new Set<string>();
  for (const p of value.content) {
    if (!object(p) || !exact(p, ['type', 'attrs', 'content']) || p.type !== 'paragraph' || (p.content !== undefined && !Array.isArray(p.content))) throw Error('Invalid paragraph.');
    if (p.attrs !== undefined && (!object(p.attrs) || !exact(p.attrs, ['listType']) || ![undefined, null, 'hyphen', 'bullet', 'number'].includes(p.attrs.listType as string))) throw Error('Invalid list metadata.');
    for (const n of (p.content || []) as unknown[]) {
      if (++nodes > 20000 || !object(n)) throw Error('Invalid node or node limit exceeded.');
      if (n.type === 'sharedDetail') {
        if (!exact(n, ['type', 'attrs', 'marks']) || !object(n.attrs) || !exact(n.attrs, ['detailId', 'value', 'nodeId']) || n.attrs.nodeId != null && (typeof n.attrs.nodeId !== 'string' || !n.attrs.nodeId || n.attrs.nodeId.length > 100) || typeof n.attrs.detailId !== 'string' || !n.attrs.detailId || typeof n.attrs.value !== 'string' || !n.attrs.value || /[\r\n]/.test(n.attrs.value) || n.attrs.value.length > 5000 || n.marks !== undefined) throw Error('Invalid shared detail reference.');
        if (n.attrs.nodeId) { if (nodeIds.has(n.attrs.nodeId as string)) throw Error('Duplicate reference node ID.'); nodeIds.add(n.attrs.nodeId as string); }
        units += n.attrs.value.length; continue;
      }
      if (n.type === 'hardBreak' && exact(n, ['type'])) { units++; continue; }
      if (n.type !== 'text' || !exact(n, ['type', 'text', 'marks']) || typeof n.text !== 'string' || !n.text.length || n.text.includes('\r') || n.text.includes('\n')) throw Error('Invalid text node.');
      units += n.text.length;
      if (n.marks !== undefined && !Array.isArray(n.marks)) throw Error('Invalid marks.');
      const seen = new Set<string>();
      for (const m of (n.marks || []) as unknown[]) {
        if (!object(m) || !exact(m, ['type', 'attrs']) || typeof m.type !== 'string' || !['bold', 'italic', 'underline', 'strike', 'family'].includes(m.type) || seen.has(m.type)) throw Error('Invalid or duplicate mark.');
        seen.add(m.type);
        if (m.type === 'family' ? (!object(m.attrs) || !exact(m.attrs, ['family']) || !['sans', 'serif'].includes(m.attrs.family as string)) : m.attrs !== undefined) throw Error('Invalid mark attributes.');
      }
      if (seen.has('underline') && seen.has('strike')) throw Error('Underline and strike cannot overlap.');
    }
  }
  if (Array.from(graphemeSegments(sourceText(value as unknown as Doc))).length > 50000) throw Error('Drafts may contain at most 50,000 source graphemes.');

}
export function validateDraft(value: unknown): asserts value is Draft {
  if (!object(value) || !exact(value, ['schemaVersion', 'id', 'title', 'createdAt', 'updatedAt', 'revision', 'editorDocument', 'preferences', 'studio']) || value.schemaVersion !== 1 || typeof value.id !== 'string' || !value.id || value.id.length > 100 || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200 || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !object(value.preferences)) throw Error('Invalid draft metadata or unsupported schema version.');
  validatePreferences(value.preferences, true); validateDoc(value.editorDocument);
  if (value.studio !== undefined) validateStudio(value.studio, value.editorDocument as Doc, validateDoc);
}
export function validatePreferences(v: unknown, partial = false): asserts v is Preferences {
  if (!object(v) || !exact(v, ['theme', 'guidance', 'dismissedIntro', 'unicodeDisabled']) || (!partial && ['theme','guidance','dismissedIntro'].some(k => !(k in v))) || (v.theme !== undefined && !['light', 'dark'].includes(v.theme as string)) || (v.guidance !== undefined && typeof v.guidance !== 'boolean') || (v.dismissedIntro !== undefined && typeof v.dismissedIntro !== 'boolean') || (v.unicodeDisabled !== undefined && typeof v.unicodeDisabled !== 'boolean')) throw Error('Invalid preferences.');
}
export function validateSnippets(v: unknown): asserts v is Snippet[] {
  if (!Array.isArray(v) || v.length > config.snippetLimit) throw Error('Invalid snippet collection.');
  const ids = new Set<string>();
  for (const s of v) { if (!object(s) || !exact(s, ['id', 'title', 'text']) || typeof s.id !== 'string' || !s.id || ids.has(s.id) || typeof s.title !== 'string' || !s.title.trim() || s.title.length > 200 || typeof s.text !== 'string' || s.text.length > config.snippetUnits || Array.from(graphemeSegments(s.text)).length > 5000 || s.text.includes('\r')) throw Error('Invalid snippet.'); ids.add(s.id); }
}
export function parseImport(text: string): Draft | Backup {
  if (new TextEncoder().encode(text).length > config.importBytes) throw Error('Import must be 10 MiB or smaller.');
  const v: unknown = JSON.parse(text);
  if (object(v) && v.kind === 'backup') {
    if (!exact(v, ['schemaVersion', 'kind', 'drafts', 'snippets', 'preferences', 'recent', 'brandProfile','campaigns']) || v.schemaVersion !== 1 || !Array.isArray(v.drafts) || v.drafts.length > config.draftLimit) throw Error('Invalid backup.');
    const ids = new Set<string>(); for (const d of v.drafts) { validateDraft(d); if (ids.has(d.id)) throw Error('Duplicate draft IDs.'); ids.add(d.id); }
    validateSnippets(v.snippets); validatePreferences(v.preferences); if (v.brandProfile !== undefined) validateBrand(v.brandProfile);
    if (!Array.isArray(v.recent) || v.recent.length > 30 || v.recent.some(x => typeof x !== 'string' || x.length > 100)) throw Error('Invalid emoji history.');
    if (v.campaigns !== undefined) {
      if (!Array.isArray(v.campaigns) || v.campaigns.length > 50) throw Error('Invalid campaign collection.');
      const campaignIds = new Set<string>(), memberships = new Set<string>();
      for (const c of v.campaigns) {
        if (!object(c) || 'drafts' in c || !object(c.campaign) || !Array.isArray(c.campaign.draftIds)) throw Error('Invalid campaign metadata.');
        const campaignDrafts = c.campaign.draftIds.map(id => (v.drafts as Draft[]).find(d => d.id === id));
        validateCampaignBundle({ ...c, drafts: campaignDrafts });
        if (campaignIds.has(c.campaign.id as string) || c.campaign.draftIds.some(id => memberships.has(id as string))) throw Error('Duplicate campaign membership.');
        campaignIds.add(c.campaign.id as string); for (const id of c.campaign.draftIds) memberships.add(id as string);
      }
    }
    return v as unknown as Backup;
  }
  validateDraft(v); return v;
}
