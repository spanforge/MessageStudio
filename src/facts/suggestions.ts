import { protectedRanges, segments } from '../unicode';
import { validateFactValue, type FactValue } from './values';

export type FactSuggestion = { from: number; to: number; literal: string; choices: FactValue[]; needsTimeZone?: boolean };

/** UTF-16 ranges, matching editor positions. No clock, locale or country inference. */
export function suggestFacts(text: string): FactSuggestion[] {
  const result: FactSuggestion[] = [];
  const protectedSpans = protectedRanges(text);
  const boundaries = new Set([...segments(text).map(s => s.index), text.length]);
  function add(m: RegExpMatchArray, choices: FactValue[], needsTimeZone = false) {
    const from = m.index!, to = from + m[0].length;
    if (!boundaries.has(from) || !boundaries.has(to) || result.some(s => from < s.to && to > s.from)) return;
    if (protectedSpans.some(s => from < s.to && to > s.from) && choices[0]?.type !== 'url') return;
    choices = choices.filter(value => { try { validateFactValue(value); return true; } catch { return false; } });
    if (choices.length) result.push({ from, to, literal: m[0], choices, ...(needsTimeZone ? { needsTimeZone: true } : {}) });
  }
  for (const span of protectedSpans) {
    const literal = text.slice(span.from, span.to);
    if (/^https?:\/\//i.test(literal)) add(Object.assign([literal], { index: span.from }) as RegExpMatchArray, [{ type: 'url', url: literal }]);
  }
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])\d{4}-\d{2}-\d{2}(?![\p{L}\p{N}])/gu)) add(m, [{ type: 'date', date: m[0] }]);
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])(\d{1,2})\/(\d{1,2})\/(\d{4})(?![\p{L}\p{N}])/gu)) {
    const date = (month: string, day: string): FactValue => ({ type: 'date', date: `${m[3]}-${month.padStart(2,'0')}-${day.padStart(2,'0')}` });
    add(m, [...new Map([date(m[2],m[1]),date(m[1],m[2])].map(v => [JSON.stringify(v),v])).values()]);
  }
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/gi)) add(m, [{ type:'date', date:`${m[3]}-${String(months.indexOf(m[2].slice(0,3).toLowerCase())+1).padStart(2,'0')}-${m[1].padStart(2,'0')}` }]);
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])(?:INR\s*|₹\s*)(\d+(?:,\d+)*(?:\.\d{1,12})?)(?![\p{L}\p{N},]|\.\d)/gu)) {
    const integer = m[1].split('.')[0];
    if (integer.includes(',') && !/^(?:[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d?(?:,\d{2})*,\d{3})$/.test(integer)) continue;
    add(m, [{ type:'money',amount:m[1].replace(/,/g,''),currency:'INR' }]);
  }
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])\+[1-9]\d(?:[ -]?\d){1,13}(?![\p{L}\p{N}])/gu)) add(m, [{ type:'phone',number:m[0].replace(/[ -]/g,''),originalDisplay:m[0] }]);
  for (const m of text.matchAll(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(AM|PM)\b|\b([01]\d|2[0-3]):([0-5]\d)\b/gi)) {
    const time = m[4] ? `${m[4]}:${m[5]}` : `${String(Number(m[1]) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0)).padStart(2,'0')}:${m[2] || '00'}`;
    // A temporary valid zone is used only for validation; confirmation must supply its own zone.
    add(m, [{ type:'time',time,timeZone:'UTC' }], true);
  }
  return result.sort((a,b) => a.from-b.from);
}
