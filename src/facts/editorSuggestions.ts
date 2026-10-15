import type { Node } from '@tiptap/pm/model';
import { suggestFacts, type FactSuggestion } from './suggestions';

/** Match contiguous text across formatting runs, never across atoms or paragraphs. */
export function suggestEditorFacts(doc: Node): FactSuggestion[] {
  const result: FactSuggestion[] = [];
  doc.descendants((node,position) => {
    if (!node.isTextblock || node.type.name === 'codeBlock') return node.type.name !== 'codeBlock';
    let text = '', start = 0;
    const flush = () => { for (const s of suggestFacts(text)) result.push({ ...s,from:start+s.from,to:start+s.to }); text = ''; };
    node.forEach((child,offset) => {
      if (child.isText && !child.marks.some(m => ['link','code'].includes(m.type.name))) {
        if (!text) start = position+1+offset;
        text += child.text;
      } else flush();
    });
    flush(); return false;
  });
  return result;
}
