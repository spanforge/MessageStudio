import { getSchema } from '@tiptap/core';
import { expect, it } from 'vitest';
import { extensions } from '../../src/editor';
import { suggestEditorFacts } from '../../src/facts/editorSuggestions';

const schema = getSchema(extensions(() => {}));
it('detects one range across formatting runs and protects URLs across those runs', () => {
  const doc = schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'18 '},{type:'text',text:'October',marks:[{type:'bold'}]},{type:'text',text:' 2026 https://example.com/'},{type:'text',text:'2026-10-19',marks:[{type:'italic'}]}]}]});
  const found = suggestEditorFacts(doc);
  expect(found.map(s => s.literal)).toEqual(['18 October 2026','https://example.com/2026-10-19']);
  for (const s of found) expect(doc.textBetween(s.from,s.to)).toBe(s.literal);
});
it('keeps candidates apart across references, hard breaks and paragraph boundaries', () => {
  const doc = schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'18 October '},{type:'sharedDetail',attrs:{detailId:'id',value:'2026',nodeId:'node'}},{type:'text',text:'18 October '},{type:'hardBreak'},{type:'text',text:'2026'}]},{type:'paragraph',content:[{type:'text',text:'18 October'}]},{type:'paragraph',content:[{type:'text',text:'2026'}]}]});
  expect(suggestEditorFacts(doc)).toEqual([]);
});
