import { localDateTimeInstants } from './timezones';
/** Canonical values are independent of channel display and legacy shared-detail text. */
export type FactValue =
  | { type: 'date'; date: string }
  | { type: 'time'; time: string; timeZone: string }
  | { type: 'datetime'; date: string; time: string; timeZone: string }
  | { type: 'money'; amount: string; currency: string }
  | { type: 'phone'; number: string; originalDisplay: string; extension?: string }
  | { type: 'url'; url: string; label?: string }
  | { type: 'literal'; text: string };

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/u.test(v);
function date(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith('0000')) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}
function zone(v: unknown): boolean {
  if (!text(v) || !/^(?:[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+|UTC)$/.test(v)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; }
}

/** Reject invalid values without normalization, country guessing or network access. */
export function validateFactValue(value: unknown): asserts value is FactValue {
  if (!record(value)) throw new Error('Invalid fact value.');
  const fields: Record<string, string[]> = {
    date: ['type', 'date'], time: ['type', 'time', 'timeZone'], datetime: ['type', 'date', 'time', 'timeZone'],
    money: ['type', 'amount', 'currency'], phone: ['type', 'number', 'originalDisplay', 'extension'],
    url: ['type', 'url', 'label'], literal: ['type', 'text'],
  };
  const allowed = typeof value.type === 'string' ? fields[value.type] : undefined;
  if (!allowed || Object.keys(value).some(k => !allowed.includes(k))) throw new Error('Unsupported fact type or fields.');
  let valid = false;
  switch (value.type) {
    case 'date': valid = date(value.date); break;
    case 'time': case 'datetime':
      valid = typeof value.time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time) && zone(value.timeZone) && (value.type === 'time' || date(value.date)); break;
    case 'money':
      valid = typeof value.amount === 'string' && /^(?:0|[1-9]\d{0,29})(?:\.\d{1,12})?$/.test(value.amount) && typeof value.currency === 'string' && Intl.supportedValuesOf('currency').includes(value.currency); break;
    case 'phone':
      valid = typeof value.number === 'string' && /^\+[1-9]\d{1,14}$/.test(value.number) && text(value.originalDisplay) && (value.extension === undefined || typeof value.extension === 'string' && /^\d{1,10}$/.test(value.extension)); break;
    case 'url':
      if (text(value.url) && !/\s/u.test(value.url)) {
        try { const u = new URL(value.url); valid = ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && (value.label === undefined || text(value.label)); } catch { /* invalid URL */ }
      }
      break;
    case 'literal': valid = text(value.text, 5000); break;
  }
  if (!valid) throw new Error(`Invalid ${String(value.type)} fact value.`);
  if (value.type === 'datetime' && !localDateTimeInstants(value.date as string,value.time as string,value.timeZone as string).length) throw Error('This local datetime does not exist in the selected timezone. Choose a valid local time.');
}

export type DateTemplate = { locale: 'en-IN' | 'ta-IN' | 'hi-IN'; month: 'short' | 'long' | 'numeric'; weekday?: boolean; year?: boolean };

/** Calendar dates are formatted in UTC so the browser zone cannot shift the day. */
export function renderCalendarDate(value: Extract<FactValue, { type: 'date' }>, template: DateTemplate): string {
  validateFactValue(value);
  return new Intl.DateTimeFormat(template.locale, {
    timeZone: 'UTC', day: 'numeric', month: template.month,
    year: template.year === false ? undefined : 'numeric', weekday: template.weekday ? 'long' : undefined,
  }).format(new Date(`${value.date}T00:00:00Z`));
}
