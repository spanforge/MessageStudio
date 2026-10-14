import { describe, expect, it } from 'vitest';
import { fromText, newDraft, parseImport, sourceText, type Doc, type Draft } from '../../src/model';
import { activeDoc, adapt, copyStatus, editSubjectText, initialStudio, receiptHash, remapDraft, review, state, updateDetail, boundIds, type Detail } from '../../src/studio';

function fixture(): Draft {
  const d = newDraft(fromText('Launch 18 October · unbound 18 October தமிழ்'));
  const detail: Detail = { id: 'date-id', label: 'Launch date', kind: 'date', canonicalValue: '18 October', revision: 0, requiredDestinations: ['linkedin','whatsapp','email'] };
  const doc: Doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Launch ' }, { type: 'sharedDetail', attrs: { detailId: detail.id, value: detail.canonicalValue } }, { type: 'text', text: ' · unbound 18 October தமிழ்' }] }] };
  d.editorDocument = doc; d.studio = { ...initialStudio(), sharedDetails: [detail], versions: { whatsapp: { overrideDocument: doc, basedOnOriginalRevision: 0, revision: 0, subject: fromText('') }, email: { overrideDocument: doc, basedOnOriginalRevision: 0, revision: 0, subject: fromText('Workshop') } } }; return d;
}
describe('Message Studio deterministic contracts', () => {
  it('maps original grapheme ranges through Unicode and WhatsApp marker insertion', () => {
    const doc = fromText('Hello தமிழ்\nhttps://example.com'); (doc.content[0].content![0] as any).marks = [{ type:'bold' }]; const raw = sourceText(doc), s = { ...initialStudio(), unicode:true };
    for (const id of ['linkedin','whatsapp','generic'] as const) { const out = adapt(doc,s,id); for (const r of out.rangeMap) { const source = raw.slice(r.sourceFrom,r.sourceTo), generated = out.output.slice(r.outputFrom,r.outputTo); expect(generated.length).toBeGreaterThan(0); if (!/[A-Za-z]/.test(source) || id !== 'linkedin') expect(generated).toBe(source); } }
  });
  it('preserves untouched subject bindings and detaches only an edited occurrence', () => {
    const d = fixture(), subject = d.editorDocument;
    const appended = editSubjectText(subject,sourceText(subject) + ' — register'); expect(boundIds(appended)).toEqual(['date-id']);
    const changed = editSubjectText(subject,sourceText(subject).replace('18 October','19 October')); expect(boundIds(changed)).toEqual([]); expect(sourceText(changed)).toContain('19 October');
  });
  it('global Unicode disable changes decorated receipts but preserves plain receipts', () => {
    const d = fixture(); d.studio!.unicode = true; (d.editorDocument.content[0].content![0] as any).marks = [{ type: 'bold' }];
    expect(receiptHash(d,'linkedin','text')).not.toBe(receiptHash(d,'linkedin','text',true)); expect(receiptHash(d,'linkedin','plain')).toBe(receiptHash(d,'linkedin','plain',true));
    expect(adapt(d.editorDocument,state(d),'linkedin',true).output).toBe(sourceText(d.editorDocument));
  });
  it('defaults legacy drafts to Quick Format, with no forced brief and ordinary text', () => {
    const d = newDraft(fromText('Hello தமிழ்')); expect(state(d).mode).toBe('quick'); expect(adapt(d.editorDocument,state(d)).output).toBe('Hello தமிழ்'); expect(review(d).some(r => r.group === 'Message clarity')).toBe(false);
    expect(parseImport(JSON.stringify(d))).toEqual(d);
  });
  it('keeps Unicode opt-in, protected spans, graphemes and reversible source marks', () => {
    const doc = fromText('Launch today\n\nTry https://example.com #Launch தமிழ் é 👨‍👩‍👧‍👦'); for (const p of doc.content) for (const n of p.content || []) if (n.type === 'text') n.marks = [{ type: 'bold' }];
    const s = initialStudio(); expect(adapt(doc,s).output).toBe(sourceText(doc)); s.unicode = true;
    expect(adapt(doc,s).output).toBe('𝗟𝗮𝘂𝗻𝗰𝗵 𝘁𝗼𝗱𝗮𝘆\n\n𝗧𝗿𝘆 https://example.com #Launch தமிழ் é 👨‍👩‍👧‍👦'); expect(adapt(doc,s,'generic').output).toBe(sourceText(doc));
  });
  it('splits WhatsApp emphasis at whitespace, protected URLs and line boundaries', () => {
    const doc = fromText(' Launch today \n\nTry https://example.com #Launch தமிழ்'); for (const p of doc.content) for (const n of p.content || []) if (n.type === 'text') n.marks = [{ type: 'bold' }];
    const out = adapt(doc,initialStudio(),'whatsapp'); expect(out.output).toBe(' *Launch today* \n\n*Try* https://example.com #Launch *தமிழ்*'); expect(out.graphemes).toBeGreaterThan(0);
  });
  it('preserves overlapping marks, literal markers and cross-node combining sequences', () => {
    const doc = fromText('A_* literal'); (doc.content[0].content![0] as any).marks = [{ type: 'bold' }]; expect(adapt(doc,initialStudio(),'whatsapp').output).toBe('A_* literal');
    (doc.content[0].content![0] as any).marks = [{ type: 'bold' },{ type: 'italic' }]; expect(adapt(doc,initialStudio(),'whatsapp').warnings.length).toBeGreaterThan(0);
    doc.content[0].content = [{ type: 'text',text: 'e',marks: [{ type: 'bold' }] },{ type: 'text',text: '\u0301' }]; expect(adapt(doc,initialStudio(),'whatsapp').output).toBe('é');
  });
  it('updates only explicit bindings across three independently edited versions', () => {
    const d = fixture(), next = updateDetail(d,'date-id','25 October');
    for (const id of ['linkedin','whatsapp','email'] as const) expect(adapt(activeDoc(next,id),state(next),id).plain).toBe('Launch 25 October · unbound 18 October தமிழ்');
    expect(sourceText(d.editorDocument)).toContain('Launch 18 October'); expect(next.studio!.sharedDetails[0].revision).toBe(1); expect(next.studio!.originalRevision).toBe(1);
  });
  it('blocks a missing required binding, accepts an explicit exception and expires it on detail change', () => {
    const d = fixture(); d.studio!.versions.whatsapp!.overrideDocument = fromText('18 October is unlinked');
    expect(review(d,'whatsapp').filter(r => r.severity === 'error')).toHaveLength(1);
    d.studio!.exceptions.push({ detailId: 'date-id', destination: 'whatsapp', revision: 0, reason: 'Date intentionally omitted here' }); expect(review(d,'whatsapp').filter(r => r.severity === 'error')).toHaveLength(0);
    expect(review(updateDetail(d,'date-id','25 October'),'whatsapp').filter(r => r.severity === 'error')).toHaveLength(1);
  });
  it('compares exact output and subject receipts without invalidating on mode or brief-only changes', () => {
    const d = fixture(); d.studio!.versions.email!.receipt = { hash: receiptHash(d,'email','text'), mode: 'text', copiedAt: new Date().toISOString(), profileVersion: 1, originalRevision: 0, versionRevision: 0 };
    expect(copyStatus(d,'email')).toBe('Copied'); d.studio!.objective = 'trial'; d.studio!.mode = 'studio'; d.studio!.brief = { audienceText: 'Founders', requiredDetailIds: [], revision: 1, updatedAt: new Date().toISOString() };
    expect(copyStatus(d,'email')).toBe('Copied'); expect(copyStatus(updateDetail(d,'date-id','25 October'),'email')).toBe('Changed since copy');
    d.studio!.versions.email!.subject = fromText('New subject'); expect(copyStatus(d,'email')).toBe('Changed since copy');
  });
  it('produces inert email HTML with safe explicit link targets and ordinary fallback', () => {
    const d = fixture(); d.studio!.sharedDetails[0] = { ...d.studio!.sharedDetails[0], kind: 'link', canonicalValue: 'Register <now>', targetUrl: 'https://example.com/?a=1&b=2' }; d.editorDocument.content[0].content![1] = { type: 'sharedDetail', attrs: { detailId: 'date-id', value: 'Register <now>' } };
    const out = adapt(d.editorDocument,state(d),'email'); expect(out.html).toContain('href="https://example.com/?a=1&amp;b=2"'); expect(out.html).toContain('Register &lt;now&gt;'); expect(out.output).toContain('Register <now>'); expect(out.html).not.toContain('<now>');
    expect(() => updateDetail(fixture(),'date-id','x\ny')).toThrow();
  });
  it('remaps all imported references, clears receipts and rejects dangling or unsafe data', () => {
    const d = fixture(); d.studio!.versions.email!.receipt = { hash: receiptHash(d,'email','plain'), mode: 'plain', copiedAt: new Date().toISOString(), profileVersion: 1, originalRevision: 0, versionRevision: 0 };
    const next = remapDraft(parseImport(JSON.stringify(d)) as Draft); expect(next.id).not.toBe(d.id); expect(next.studio!.sharedDetails[0].id).not.toBe('date-id'); expect(next.studio!.versions.email!.receipt).toBeUndefined(); expect(parseImport(JSON.stringify(next))).toEqual(next);
    const bad = structuredClone(d); bad.studio!.sharedDetails = []; expect(() => parseImport(JSON.stringify(bad))).toThrow('Dangling');
    bad.studio = { ...initialStudio(), brief: { desiredActionUrl: 'javascript:alert(1)', requiredDetailIds: [], revision: 0, updatedAt: new Date().toISOString() } }; expect(() => parseImport(JSON.stringify(bad))).toThrow();
  });
});
