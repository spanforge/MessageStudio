import { describe, expect, it } from 'vitest';
import { fromText, newDraft, parseImport, sourceText, validateDraft, type Doc } from '../../src/model';
import { activeDoc, adapt, initialStudio, remapDraft, state, updateTypedDetail, type Detail } from '../../src/studio';
import { defaultFactTemplate } from '../../src/facts/templates';
function fixture() {
  const d = newDraft();
  const detail: Detail = { id:'date-id', label:'Launch date', kind:'date', canonicalValue:'18 October', revision:0, requiredDestinations:['whatsapp'] };
  const doc: Doc = { type:'doc',content:[{ type:'paragraph',content:[{type:'sharedDetail',attrs:{ detailId:detail.id,value:detail.canonicalValue }},{type:'text',text:' · unbound 18 October'}] }] };
  d.editorDocument = doc; d.studio = { ...initialStudio(),sharedDetails:[detail],versions:{whatsapp:{ overrideDocument:structuredClone(doc),revision:0,basedOnOriginalRevision:0,subject:fromText('') }} }; return d;
}
describe('reviewed typed detail integration', () => {
  it('updates only bound nodes, assigns stable identities and retains previous values', () => {
    const d = fixture(), next = updateTypedDetail(d,'date-id',{ type:'date',date:'2026-10-18' });
    validateDraft(next); expect(sourceText(next.editorDocument)).toContain('unbound 18 October');
    const node = next.editorDocument.content[0].content![0]; expect(node.type === 'sharedDetail' && node.attrs.nodeId).toBeTruthy();
    const changed = updateTypedDetail(next,'date-id',{ type:'date',date:'2026-10-19' });
    expect(changed.studio!.sharedDetails[0].typed!.previousValues).toEqual([{ type:'date',date:'2026-10-18' }]);
    expect(changed.editorDocument.content[0].content![0]).toMatchObject({attrs:{ nodeId:node.type === 'sharedDetail' ? node.attrs.nodeId : '' }});
    expect(sourceText(d.editorDocument)).toBe('18 October · unbound 18 October');
    expect(parseImport(JSON.stringify(changed))).toEqual(changed);
  });
  it('renders destination overrides and maps ordinary text to original offsets after a longer fact', () => {
    const templates = Object.fromEntries(['linkedin','whatsapp','email','generic'].map(id => [id,defaultFactTemplate(id as any)]));
    templates.whatsapp.month = 'long'; templates.whatsapp.weekday = true;
    const next = updateTypedDetail(fixture(),'date-id',{type:'date',date:'2026-10-18'},templates);
    const out = adapt(activeDoc(next,'whatsapp'),state(next),'whatsapp');
    expect(out.output).toContain('Sunday'); expect(out.output).toContain('unbound 18 October');
    const original = sourceText(activeDoc(next,'whatsapp'));
    for (const r of out.rangeMap.filter(r => original.slice(r.sourceFrom,r.sourceTo).length === 1)) expect(out.output.slice(r.outputFrom,r.outputTo)).toBe(original.slice(r.sourceFrom,r.sourceTo));
    expect(adapt(activeDoc(next,'linkedin'),state(next),'linkedin').output).not.toContain('Sunday');
  });
  it('remaps occurrence/template identities and rejects forged canonical caches', () => {
    const d = updateTypedDetail(fixture(),'date-id',{type:'money',amount:'999.00',currency:'INR'}), copy = remapDraft(d);
    validateDraft(copy);
    expect(copy.studio!.sharedDetails[0].typed!.templates.generic!.id).not.toBe(d.studio!.sharedDetails[0].typed!.templates.generic!.id);
    d.studio!.sharedDetails[0].typed!.value = {type:'money',amount:'1000',currency:'INR'};
    expect(() => validateDraft(d)).toThrow('cache');
  });
});
