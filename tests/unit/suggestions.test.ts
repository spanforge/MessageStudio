import { describe, expect, it } from 'vitest';
import { suggestFacts } from '../../src/facts/suggestions';

describe('explicit fact suggestions', () => {
  it('accepts reviewed Indian/western grouping while rejecting malformed grouped prices', () => {
    const found = suggestFacts('INR 1,23,456.7800 ₹999,999.01 INR 1,234,56 INR 500.');
    expect(found.map(s => s.literal)).toEqual(['INR 1,23,456.7800','₹999,999.01','INR 500']);
    expect(found[0].choices).toEqual([{type:'money',amount:'123456.7800',currency:'INR'}]);
  });
  it('protects URLs and other protected tokens against nested suggestions', () => {
    const text = 'https://example.com/2026-10-18?price=INR500 email2026-10-18@example.com #2026-10-18';
    expect(suggestFacts(text).map(s => s.literal)).toEqual(['https://example.com/2026-10-18?price=INR500']);
  });
  it('offers both valid numeric interpretations and rejects invalid calendar dates', () => {
    const found = suggestFacts('03/04/2026 18/10/2026 2026-02-30 18 October 2026');
    expect(found[0].choices).toEqual([{type:'date',date:'2026-04-03'},{type:'date',date:'2026-03-04'}]);
    expect(found[1].choices).toEqual([{type:'date',date:'2026-10-18'}]);
    expect(found.map(s => s.literal)).toEqual(['03/04/2026','18/10/2026','18 October 2026']);
  });
  it('retains precise amounts and requires explicit country codes and timezone confirmation', () => {
    const found = suggestFacts('INR 999999999999.01 +91 98765 43210 9876543210 6 PM 18:30');
    expect(found[0].choices).toEqual([{type:'money',amount:'999999999999.01',currency:'INR'}]);
    expect(found[1].choices).toEqual([{type:'phone',number:'+919876543210',originalDisplay:'+91 98765 43210'}]);
    expect(found.slice(2).every(s => s.needsTimeZone)).toBe(true);
    expect(found).toHaveLength(4);
  });
  it('returns exact UTF-16 source spans and avoids partial graphemes', () => {
    const text = '👩🏽‍💻 தமிழ் 2026-10-18 2026-10-19\u0301';
    const found = suggestFacts(text);
    expect(found).toHaveLength(1);
    expect(text.slice(found[0].from,found[0].to)).toBe('2026-10-18');
  });
});
