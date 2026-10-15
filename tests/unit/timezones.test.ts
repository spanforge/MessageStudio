import { expect, it } from 'vitest';
import { localDateTimeInstants } from '../../src/facts/timezones';
import { validateFactValue } from '../../src/facts/values';
import { defaultFactTemplate, renderFactValue } from '../../src/facts/templates';

it('detects DST gaps and overlaps without selecting an instant', () => {
  expect(localDateTimeInstants('2026-03-08','02:30','America/New_York')).toEqual([]);
  expect(() => validateFactValue({type:'datetime',date:'2026-03-08',time:'02:30',timeZone:'America/New_York'})).toThrow('does not exist');
  expect(localDateTimeInstants('2026-11-01','01:30','America/New_York')).toEqual(['2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z']);
  expect(localDateTimeInstants('2026-10-18','18:00','Asia/Kolkata')).toEqual(['2026-10-18T12:30:00.000Z']);
});
it('handles half-hour DST transitions and date-line gaps', () => {
  expect(localDateTimeInstants('2026-04-05','01:45','Australia/Lord_Howe')).toHaveLength(2);
  expect(localDateTimeInstants('2026-10-04','02:15','Australia/Lord_Howe')).toEqual([]);
  expect(localDateTimeInstants('2011-12-30','12:00','Pacific/Apia')).toEqual([]);
});
it('renders wall-clock time without silently converting it or hiding the zone by default', () => {
  const t = defaultFactTemplate('whatsapp');
  const value = {type:'datetime' as const,date:'2026-11-01',time:'01:30',timeZone:'America/New_York'};
  expect(renderFactValue(value,t)).toContain('1:30 AM America/New_York');
  t.timeStyle = '24h'; expect(renderFactValue(value,t)).toContain('01:30 America/New_York');
  t.zoneDisplay = 'hidden'; expect(renderFactValue(value,t)).not.toContain('America/New_York');
  expect(value.time).toBe('01:30');
});
