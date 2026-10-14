import type { Doc, Draft, Inline } from './model';
import { protectedRanges, segments, serialize } from './unicode';

export const destinations = ['linkedin', 'whatsapp', 'email', 'generic'] as const;
export type Destination = typeof destinations[number];
export const destinationNames: Record<Destination, string> = { linkedin: 'LinkedIn', whatsapp: 'WhatsApp', email: 'Email', generic: 'Plain text' };
export const objectives = { general: 'General', awareness: 'Awareness', trial: 'Trial', activation: 'Activation / Onboarding', reengagement: 'Re-engagement' };
export type Objective = keyof typeof objectives;
export type Brief = { audienceText?: string; customerProblemText?: string; productName?: string; valueStatement?: string; differentiationEvidence?: string; desiredActionText?: string; desiredActionUrl?: string; requiredDetailIds: string[]; revision: number; updatedAt: string };
export type Detail = { id: string; label: string; kind: 'date' | 'price' | 'name' | 'link' | 'phrase'; canonicalValue: string; targetUrl?: string; revision: number; requiredDestinations: Destination[] };
export type Brand = { name: string; spelling: string; alternatives: string[]; website: string; cta: string; phrases: string[]; unicode: boolean; revision: number };
export type Receipt = { hash: string; mode: 'plain' | 'text' | 'rich'; copiedAt: string; profileVersion: number; originalRevision: number; versionRevision: number };
export type Version = { overrideDocument?: Doc; basedOnOriginalRevision: number; revision: number; subject: Doc; receipt?: Receipt };
export type Studio = { bundleSchemaVersion: 3; mode: 'quick' | 'studio'; activeDestination: Destination; editingOriginal: boolean; originalRevision: number; unicode: boolean; emailRich: boolean; objective: Objective; brief?: Brief; versions: Partial<Record<Destination, Version>>; sharedDetails: Detail[]; exceptions: { detailId: string; destination: Destination; revision: number; reason: string }[]; brandProfileSnapshot?: Brand; campaign?: string; trashedAt?: string };
export type Review = { issueId: string; ruleId: string; group: 'Required details' | 'Brand' | 'Formatting' | 'Message clarity' | 'CTA'; severity: 'error' | 'notice'; location: string; message: string; revision: number; outputRevision: string; sourceRange: { from: number; to: number } | null; outputRange: { from: number; to: number } | null; fixId: null; deterministic: boolean; detailId?: string };
export function initialStudio(): Studio { return { bundleSchemaVersion: 3, mode: 'quick', activeDestination: 'linkedin', editingOriginal: true, originalRevision: 0, unicode: false, emailRich: false, objective: 'general', versions: {}, sharedDetails: [], exceptions: [] }; }
export function state(d: Draft): Studio { return d.studio || initialStudio(); }
export function emptyDoc(): Doc { return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }; }
export function version(s: Studio, id = s.activeDestination): Version { return s.versions[id] || { basedOnOriginalRevision: s.originalRevision, revision: 0, subject: emptyDoc() }; }
export function activeDoc(d: Draft, id = state(d).activeDestination): Doc { return version(state(d), id).overrideDocument || d.editorDocument; }
export function inlineText(n: Inline): string { return n.type === 'hardBreak' ? '\n' : n.type === 'sharedDetail' ? n.attrs.value : n.text; }
export function materialize(doc: Doc, details: Detail[] = []): Doc { return { ...doc, content: doc.content.map(p => ({ ...p, content: p.content?.map(n => n.type === 'sharedDetail' ? { type: 'text', text: details.find(d => d.id === n.attrs.detailId)?.canonicalValue || n.attrs.value, marks: n.marks } : n) })) }; }
export function safeUrl(url: string): boolean { try { const u = new URL(url); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }
const escapeHTML = (v: string) => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function emailHTML(doc: Doc, details: Detail[]): string {
  let number = 0;
  return doc.content.map(p => {
    const list = p.attrs?.listType; if (list !== 'number') number = 0;
    const prefix = list === 'number' ? `${++number}. ` : list ? '• ' : '';
    const body = (p.content || []).map(n => {
      if (n.type === 'hardBreak') return '<br>';
      let text = escapeHTML(inlineText(n));
      if (n.type === 'sharedDetail') { const d = details.find(d => d.id === n.attrs.detailId); if (d?.targetUrl && safeUrl(d.targetUrl)) text = `<a href="${escapeHTML(d.targetUrl)}">${text}</a>`; }
      for (const m of n.marks || []) { const tag = { bold: 'strong', italic: 'em', strike: 's', underline: 'u', family: '' }[m.type]; if (tag) text = `<${tag}>${text}</${tag}>`; }
      return text;
    }).join('');
    return `<p>${prefix}${body || '<br>'}</p>`;
  }).join('');
}
export function adapt(doc: Doc, s: Studio, id = s.activeDestination, unicodeDisabled = false) {
  if (unicodeDisabled) s = { ...s, unicode: false };
  const source = materialize(doc, s.sharedDetails); const base = serialize(source); const warnings: string[] = [];
  let output = base.plain; let delta = 0;
  let rangeMap = base.rangeMap.map(r => { const inserted = r.sourceFrom === r.sourceTo; const result = { ...r, outputFrom: r.outputFrom + delta, outputTo: r.outputFrom + delta + (inserted ? r.outputTo-r.outputFrom : r.sourceTo-r.sourceFrom) }; if (!inserted) delta += r.sourceTo-r.sourceFrom - (r.outputTo-r.outputFrom); return result; });
  if (id === 'linkedin' && s.unicode) { output = base.output; rangeMap = base.rangeMap; }
  if (id === 'linkedin' && !s.unicode && source.content.some(p => p.content?.some(n => n.type === 'text' && n.marks?.length))) warnings.push('Unicode emphasis is off. Source emphasis is omitted from this output.');
  if (id === 'generic') warnings.push('Plain text preserves your words and omits source styling.');
  if (id === 'whatsapp') {
    let number = 0, sourceOffset = 0, outputOffset = 0; rangeMap = [];
    output = source.content.map((p,pi) => {
      const nodes = p.content || []; const line = nodes.map(inlineText).join(''); const tokens = protectedRanges(line); let offset = 0;
      const list = p.attrs?.listType; if (list !== 'number') number = 0;
      const prefix = line ? list === 'number' ? `${++number}. ` : list ? '• ' : '' : '';
      if (pi) { rangeMap.push({ sourceFrom: sourceOffset-1, sourceTo: sourceOffset, outputFrom: outputOffset, outputTo: outputOffset+1 }); outputOffset++; }
      if (prefix) { rangeMap.push({ sourceFrom: sourceOffset, sourceTo: sourceOffset, outputFrom: outputOffset, outputTo: outputOffset+prefix.length }); outputOffset += prefix.length; }
      const runs: { text: string; marks: string[]; from: number }[] = [];
      const markRuns = nodes.map(n => { const text = inlineText(n); const from = offset; offset += text.length; return { from, to: offset, marks: n.type === 'text' ? (n.marks || []).filter(m => m.type !== 'family').map(m => m.type) : [] }; });
      for (const g of segments(line)) {
        const protectedToken = tokens.some(t => t.from < g.index + g.segment.length && t.to > g.index);
        const marks = markRuns.find(r => r.from <= g.index && r.to > g.index)?.marks || [];
        const crossesMark = markRuns.some(r => r.from > g.index && r.from < g.index + g.segment.length && JSON.stringify(r.marks) !== JSON.stringify(marks));
        const key = protectedToken || crossesMark || g.segment === '\n' ? [] : marks;
        const last = runs.at(-1); if (last && JSON.stringify(last.marks) === JSON.stringify(key) && g.segment !== '\n' && !last.text.endsWith('\n')) last.text += g.segment; else runs.push({ text: g.segment, marks: key, from: g.index });
      }
      const paragraph = prefix + runs.map(r => {
        let rendered = r.text;
        if (r.marks.length) {
          if (r.marks.length > 1 || r.marks.includes('underline') || /[*_~`]/.test(r.text)) warnings.push('WhatsApp: overlapping, unsupported or conflicting literal markers are copied as plain text in the affected run.');
          else {
            const marker = { bold: '*', italic: '_', strike: '~' }[r.marks[0] as 'bold'];
            rendered = r.text.replace(/^(\s*)(.*?)(\s*)$/u, (_m, left, body, right) => `${left}${body ? marker + body + marker : ''}${right}`);
          }
        }
        let cursor = 0;
        for (const g of segments(r.text)) { const index = rendered.indexOf(g.segment,cursor); rangeMap.push({ sourceFrom: sourceOffset+r.from+g.index, sourceTo: sourceOffset+r.from+g.index+g.segment.length, outputFrom: outputOffset+index, outputTo: outputOffset+index+g.segment.length }); cursor = index + g.segment.length; }
        outputOffset += rendered.length; return rendered;
      }).join('');
      sourceOffset += line.length+1; return paragraph;
    }).join('\n');
    if (/[*_~`]/.test(base.plain)) warnings.push('Literal marker patterns may be interpreted by WhatsApp after paste.');
  }
  return { ...base, rangeMap, output, graphemes: segments(output).length, units: output.length, pieces: id === 'linkedin' && s.unicode ? base.pieces : [{ text: output, kind: 'ordinary' as const }], html: emailHTML(doc, s.sharedDetails), warnings: [...new Set(warnings)], limitLabel: id === 'linkedin' ? '3,000 provisional target · Composer count not verified' : 'Limit not verified' };
}
// Deterministic content fingerprint. Receipts never store clipboard text.
export function fingerprint(text: string): string { let a = 2166136261, b = 5381; for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); } return `${text.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`; }
export function receiptHash(d: Draft, id: Destination, mode: Receipt['mode'], unicodeDisabled = false): string { const s = state(d), out = adapt(activeDoc(d, id), s, id, unicodeDisabled); const subject = id === 'email' ? adapt(version(s, id).subject, s, 'generic').output : ''; return fingerprint(JSON.stringify([mode, subject, mode === 'plain' ? out.plain : out.output, mode === 'rich' ? out.html : '', 1])); }
export function copyStatus(d: Draft, id: Destination, unicodeDisabled = false): string { const r = version(state(d), id).receipt; return !r ? 'Not copied' : r.hash === receiptHash(d, id, r.mode, unicodeDisabled) ? `Copied${r.mode === 'plain' ? ' (plain text)' : ''}` : 'Changed since copy'; }
export function boundIds(doc: Doc): string[] { return doc.content.flatMap(p => (p.content || []).flatMap(n => n.type === 'sharedDetail' ? [n.attrs.detailId] : [])); }
export function review(d: Draft, id = state(d).activeDestination): Review[] {
  const s = state(d), doc = activeDoc(d, id), v = version(s, id), result: Review[] = [];
  const body = adapt(doc, s, id), subject = adapt(v.subject, s, 'generic').output;
  const ids = [...boundIds(doc), ...(id === 'email' ? boundIds(v.subject) : [])];
  const add = (ruleId: string, group: Review['group'], message: string, deterministic = true, severity: Review['severity'] = 'notice', detailId?: string, location = 'body', sourceRange: Review['sourceRange'] = null) => {
    const mapped = sourceRange ? body.rangeMap.filter(r => r.sourceFrom < sourceRange.to && r.sourceTo > sourceRange.from) : [];
    result.push({ issueId: `${id}:${ruleId}:${detailId || location}:${result.length}`, ruleId, group, message, deterministic, severity, detailId, location, revision: d.revision, outputRevision: `${s.originalRevision}:${v.revision}:1`, sourceRange, outputRange: mapped.length ? { from: mapped[0].outputFrom, to: mapped.at(-1)!.outputTo } : null, fixId: null });
  };
  for (const detail of s.sharedDetails) {
    const required = detail.requiredDestinations.includes(id);
    const except = s.exceptions.find(e => e.detailId === detail.id && e.destination === id && e.revision === detail.revision);
    if (except) add('detail-exception', 'Required details', `${detail.label}: Intentionally different — ${except.reason}`, true, 'notice', detail.id);
    else if (required && !ids.includes(detail.id)) add('detail-missing', 'Required details', `${detail.label}: Missing linked occurrence. Restore it or record a destination exception.`, true, 'error', detail.id, id === 'email' ? 'subject / body' : 'body');
  }
  for (const warning of body.warnings) add('adapter', 'Formatting', warning);
  if (body.unsupported && s.unicode && id === 'linkedin') add('unicode-script', 'Formatting', 'Unsupported scripts and emoji remain unchanged by Unicode emphasis.');
  if (id === 'linkedin' && body.units > 3000) add('length', 'Formatting', 'Output exceeds the provisional LinkedIn target. Edit or explicitly copy anyway.');
  add('platform-unverified', 'Formatting', 'Layout estimate only. Paste behavior on destination clients has not been verified.');
  if (s.brandProfileSnapshot) { const brand = s.brandProfileSnapshot; for (const alt of brand.alternatives) if (alt && `${body.plain}\n${subject}`.includes(alt)) add('brand-spelling', 'Brand', `Configured variant “${alt}” found. Review canonical spelling “${brand.spelling}”.`); }
  if (s.mode === 'studio') {
    const b = s.brief;
    for (const [key, label] of [['audienceText', 'audience'], ['valueStatement', 'value'], ['differentiationEvidence', 'evidence']] as const) if (!b?.[key]) add(`brief-${key}`, 'Message clarity', `No ${label} specified in the optional brief. Review whether it is needed.`, false, 'notice', undefined, 'brief');
    const prompts = { awareness: 'Is the value understandable to someone new?', trial: 'Is the next step explicit?', activation: 'Does the message explain what to do first?', reengagement: 'Is the reason to return clear?', general: 'Does this message serve the purpose you chose?' };
    add('objective-prompt', 'Message clarity', prompts[s.objective], false, 'notice', undefined, 'brief');
    if (['trial', 'activation', 'reengagement'].includes(s.objective) && !b?.desiredActionText) add('cta-missing', 'CTA', 'No next action specified. Add an optional CTA or review the intended next step.', false, 'notice', undefined, 'brief');
    if (b?.desiredActionUrl && !safeUrl(b.desiredActionUrl)) add('cta-url', 'CTA', 'CTA URL must be an HTTP or HTTPS URL without credentials. Only syntax is checked.', true, 'notice', undefined, 'brief');
  }
  return result;
}
export function updateDetail(d: Draft, detailId: string, value: string, targetUrl?: string): Draft {
  if (!value || value.length > 5000 || /[\r\n]/.test(value)) throw Error('Use a single-line detail of 1–5,000 characters.');
  const s = structuredClone(state(d)), detail = s.sharedDetails.find(x => x.id === detailId); if (!detail) throw Error('Detail no longer exists.');
  if (detail.kind === 'link' && !safeUrl(targetUrl || value)) throw Error('Use a valid HTTP or HTTPS link.');
  detail.canonicalValue = value; detail.targetUrl = detail.kind === 'link' ? targetUrl || value : undefined; detail.revision++;
  const replace = (doc: Doc): Doc => ({ ...doc, content: doc.content.map(p => ({ ...p, content: p.content?.map(n => n.type === 'sharedDetail' && n.attrs.detailId === detailId ? { ...n, attrs: { ...n.attrs, value } } : n) })) });
  const original = replace(d.editorDocument); if (JSON.stringify(original) !== JSON.stringify(d.editorDocument)) s.originalRevision++;
  for (const id of destinations) { const old = s.versions[id]; if (!old) continue; if (old.overrideDocument) { const next = replace(old.overrideDocument); if (JSON.stringify(next) !== JSON.stringify(old.overrideDocument)) old.revision++; old.overrideDocument = next; } old.subject = replace(old.subject); }
  return { ...d, editorDocument: original, studio: s };
}
export function remapDraft(input: Draft): Draft {
  const d = structuredClone(input); d.id = crypto.randomUUID(); d.revision = 0; d.createdAt = d.updatedAt = new Date().toISOString();
  if (!d.studio) return d;
  const s = d.studio, ids = new Map(s.sharedDetails.map(x => [x.id, crypto.randomUUID()]));
  const remap = (doc: Doc) => { for (const p of doc.content) for (const n of p.content || []) if (n.type === 'sharedDetail') n.attrs.detailId = ids.get(n.attrs.detailId)!; };
  remap(d.editorDocument); for (const v of Object.values(s.versions)) if (v) { delete v.receipt; if (v.overrideDocument) remap(v.overrideDocument); remap(v.subject); }
  for (const detail of s.sharedDetails) detail.id = ids.get(detail.id)!;
  for (const e of s.exceptions) e.detailId = ids.get(e.detailId)!;
  if (s.brief) s.brief.requiredDetailIds = s.brief.requiredDetailIds.map(id => ids.get(id)!);
  return d;
}

/** Preserve explicit subject references outside the user's edited range. */
export function editSubjectText(doc: Doc, text: string): Doc {
  const old = doc.content.flatMap(p => p.content || []).map(inlineText).join('');
  let from = 0; while (from < old.length && from < text.length && old[from] === text[from]) from++;
  let suffix = 0; while (suffix < old.length-from && suffix < text.length-from && old[old.length-1-suffix] === text[text.length-1-suffix]) suffix++;
  const slice = (start: number, end: number): Inline[] => {
    let offset = 0; const result: Inline[] = [];
    for (const n of doc.content.flatMap(p => p.content || [])) { const value = inlineText(n), left = Math.max(0,start-offset), right = Math.min(value.length,end-offset); offset += value.length;
      if (right <= left) continue;
      if (left === 0 && right === value.length) result.push(n);
      else result.push({ type: 'text', text: value.slice(left,right), ...(n.type === 'text' && n.marks ? { marks: n.marks } : {}) });
    }
    return result;
  };
  const insertion = text.slice(from,text.length-suffix);
  return { type: 'doc', content: [{ type: 'paragraph', content: [...slice(0,from), ...(insertion ? [{ type: 'text' as const, text: insertion }] : []), ...slice(old.length-suffix,old.length)] }] };
}
