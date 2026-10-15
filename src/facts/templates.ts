import { renderCalendarDate, validateFactValue, type FactValue } from './values';
import type { Destination } from '../studio';

export type FactTemplate = {
  id: string; locale: 'en-IN' | 'ta-IN' | 'hi-IN'; destinationId: Destination;
  month: 'short' | 'long' | 'numeric'; year: boolean; weekday: boolean;
  timeStyle: '12h' | '24h'; zoneDisplay: 'hidden' | 'iana';
  currencyDisplay: 'code' | 'symbol'; phoneDisplay: 'international' | 'original';
  urlDisplay: 'target' | 'label';
};
export function defaultFactTemplate(destinationId: Destination): FactTemplate {
  return { id: crypto.randomUUID(), locale: 'en-IN', destinationId, month: 'short', year: true, weekday: false, timeStyle: '12h', zoneDisplay: 'iana', currencyDisplay: 'code', phoneDisplay: 'international', urlDisplay: 'target' };
}
export function validateFactTemplate(v: unknown): asserts v is FactTemplate {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid fact template.');
  const t = v as Record<string, unknown>;
  const fields = ['id','locale','destinationId','month','year','weekday','timeStyle','zoneDisplay','currencyDisplay','phoneDisplay','urlDisplay'];
  const options: Record<string, readonly unknown[]> = { locale: ['en-IN','ta-IN','hi-IN'], destinationId: ['linkedin','whatsapp','email','generic'], month: ['short','long','numeric'], year: [true,false], weekday: [true,false], timeStyle: ['12h','24h'], zoneDisplay: ['hidden','iana'], currencyDisplay: ['code','symbol'], phoneDisplay: ['international','original'], urlDisplay: ['target','label'] };
  if (Object.keys(t).some(k => !fields.includes(k)) || typeof t.id !== 'string' || !t.id || t.id.length > 100 || Object.entries(options).some(([k, values]) => !values.includes(t[k]))) throw Error('Invalid fact template.');
}
function renderTime(time: string, timeZone: string, t: FactTemplate): string {
  const [h, m] = time.split(':');
  const hour = Number(h);
  const result = t.timeStyle === '24h' ? time : `${hour % 12 || 12}${m === '00' ? '' : `:${m}`} ${hour < 12 ? 'AM' : 'PM'}`;
  return result + (t.zoneDisplay === 'iana' ? ` ${timeZone}` : '');
}
/** Display only: no timezone conversion is inferred from a wall-clock time. */
export function renderFactValue(value: FactValue, template: FactTemplate): string {
  validateFactValue(value); validateFactTemplate(template);
  switch (value.type) {
    case 'date': return renderCalendarDate(value, template);
    case 'time': return renderTime(value.time, value.timeZone, template);
    case 'datetime': return `${renderCalendarDate({ type: 'date', date: value.date }, template)}, ${renderTime(value.time, value.timeZone, template)}`;
    case 'money': {
      // Obtain the currency symbol from Intl without converting the amount to a float.
      const symbol = new Intl.NumberFormat(template.locale, { style: 'currency', currency: value.currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(p => p.type === 'currency')!.value;
      return template.currencyDisplay === 'code' ? `${value.currency} ${value.amount}` : `${symbol}${value.amount}`;
    }
    case 'phone': return `${template.phoneDisplay === 'original' ? value.originalDisplay : value.number}${value.extension ? ` ext. ${value.extension}` : ''}`;
    case 'url': return template.urlDisplay === 'label' && value.label ? value.label : value.url;
    case 'literal': return value.text;
  }
}
