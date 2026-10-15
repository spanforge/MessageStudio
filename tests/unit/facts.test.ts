import { describe, expect, it } from 'vitest';
import { renderCalendarDate, validateFactValue } from '../../src/facts/values';

describe('typed canonical fact values', () => {
  it('rejects rollover dates and accepts real leap days', () => {
    expect(() => validateFactValue({ type: 'date', date: '2024-02-29' })).not.toThrow();
    for (const date of ['2026-02-29', '2026-04-31', '0000-01-01', '18/10/2026']) expect(() => validateFactValue({ type: 'date', date })).toThrow();
  });
  it('requires explicit valid time and zone without guessing', () => {
    expect(() => validateFactValue({ type: 'datetime', date: '2026-10-18', time: '18:00', timeZone: 'Asia/Kolkata' })).not.toThrow();
    for (const value of [{ type: 'time', time: '24:00', timeZone: 'Asia/Kolkata' }, { type: 'time', time: '18:00' }, { type: 'time', time: '18:00', timeZone: '+05:30' }]) expect(() => validateFactValue(value)).toThrow();
  });
  it('preserves precise decimal strings and requires ISO currency', () => {
    const value = { type: 'money', amount: '999999999999999999.01', currency: 'INR' };
    validateFactValue(value); expect(value.amount).toBe('999999999999999999.01');
    for (const amount of [999, '1e3', 'NaN', '01.00']) expect(() => validateFactValue({ type: 'money', amount, currency: 'INR' })).toThrow();
    expect(() => validateFactValue({ type: 'money', amount: '999', currency: 'ZZZ' })).toThrow();
  });
  it('rejects guessed phones, unsafe URLs and unknown fields', () => {
    expect(() => validateFactValue({ type: 'phone', number: '+919876543210', originalDisplay: '+91 98765 43210', extension: '12' })).not.toThrow();
    expect(() => validateFactValue({ type: 'phone', number: '9876543210', originalDisplay: '9876543210' })).toThrow();
    for (const url of ['javascript:alert(1)', 'data:text/plain,x', 'https://example.com/\npath', 'https://user:pass@example.com']) expect(() => validateFactValue({ type: 'url', url })).toThrow();
    const value = { type: 'url', url: 'https://example.com/path?q=1' }; validateFactValue(value); expect(value.url).toBe('https://example.com/path?q=1');
    expect(() => validateFactValue({ type: 'literal', text: 'தமிழ் हिन्दी', inferred: true })).toThrow();
  });
  it('renders the correct weekday independently of local browser timezone', () => {
    expect(renderCalendarDate({ type: 'date', date: '2026-10-18' }, { locale: 'en-IN', month: 'long', weekday: true })).toContain('Sunday');
  });
});
