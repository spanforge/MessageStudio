import { useState } from 'react';
import type { FactValue } from '../facts/values';
import { destinations, destinationNames, type Detail, type Destination } from '../studio';
import { defaultFactTemplate, type FactTemplate } from '../facts/templates';

export function TypedFactEditor({ detail, onPreview }: { detail: Detail; onPreview: (value: FactValue, templates: Partial<Record<Destination, FactTemplate>>) => void }) {
  const [type, setType] = useState<FactValue['type']>(detail.typed?.value.type || 'literal');
  const [value, setValue] = useState<FactValue>(detail.typed?.value || { type: 'literal', text: detail.canonicalValue });
  const [templates, setTemplates] = useState<Partial<Record<Destination, FactTemplate>>>(detail.typed?.templates || Object.fromEntries(destinations.map(id => [id, defaultFactTemplate(id)])));
  const [destination, setDestination] = useState<Destination>('whatsapp');
  const t = templates[destination] || defaultFactTemplate(destination);
  const field = (name: string, label: string, inputType = 'text', fallback = '') => <label>{label}<input type={inputType} maxLength={2000} value={String((value as unknown as Record<string, string>)[name] || fallback)} onChange={e => { const next = { ...value, [name]: e.target.value } as unknown as Record<string, unknown>; if (!e.target.value && ['extension','label'].includes(name)) delete next[name]; setValue(next as FactValue); }} /></label>;
  function choose(next: FactValue['type']) {
    setType(next);
    const empty: Record<FactValue['type'], FactValue> = { date: { type:'date',date:'' }, time: { type:'time',time:'',timeZone:'Asia/Kolkata' }, datetime: { type:'datetime',date:'',time:'',timeZone:'Asia/Kolkata' }, money: { type:'money',amount:'',currency:'INR' }, phone: { type:'phone',number:'',originalDisplay:'' }, url: { type:'url',url:'' }, literal: { type:'literal',text:detail.canonicalValue } };
    setValue(empty[next]);
  }
  return <div className="detail-record"><h3>{detail.typed ? 'Edit typed fact' : 'Confirm a typed value'}</h3><p>Confirm the value yourself. Preview changes before applying; unlinked text stays unchanged.</p>
    <label>Fact type<select aria-label="Fact type" value={type} disabled={!!detail.typed} onChange={e => choose(e.target.value as FactValue['type'])}>{['date','time','datetime','money','phone','url','literal'].map(id => <option key={id}>{id}</option>)}</select></label>
    {(type === 'date' || type === 'datetime') && field('date','Calendar date','date')}
    {(type === 'time' || type === 'datetime') && <>{field('time','Local time','time')}{field('timeZone','IANA timezone')}</>}
    {type === 'money' && <>{field('amount','Decimal amount')}{field('currency','ISO currency')}</>}
    {type === 'phone' && <>{field('number','International phone (+country code)')}{field('originalDisplay','Original phone display')}{field('extension','Extension (optional)')}</>}
    {type === 'url' && <>{field('url','Exact URL','url')}{field('label','URL label (optional)')}</>}
    {type === 'literal' && field('text','Exact literal text')}
    <details><summary>Channel display formats</summary><label>Format destination<select aria-label="Format destination" value={destination} onChange={e => setDestination(e.target.value as Destination)}>{destinations.map(id => <option key={id} value={id}>{destinationNames[id]}</option>)}</select></label>
      <label>Format locale<select aria-label="Format locale" value={t.locale} onChange={e => setTemplates({ ...templates,[destination]: { ...t,locale:e.target.value as FactTemplate['locale'] } })}>{['en-IN','ta-IN','hi-IN'].map(id => <option key={id}>{id}</option>)}</select></label>
      {(type === 'date' || type === 'datetime') && <><label>Month display<select aria-label="Month display" value={t.month} onChange={e => setTemplates({ ...templates,[destination]: { ...t,month:e.target.value as FactTemplate['month'] } })}>{['short','long','numeric'].map(id => <option key={id}>{id}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={t.year} onChange={e => setTemplates({ ...templates,[destination]: { ...t,year:e.target.checked } })} />Include year</label><label className="check-label"><input type="checkbox" checked={t.weekday} onChange={e => setTemplates({ ...templates,[destination]: { ...t,weekday:e.target.checked } })} />Include calculated weekday</label></>}
      {(type === 'time' || type === 'datetime') && <><label>Time display<select aria-label="Time display" value={t.timeStyle} onChange={e => setTemplates({ ...templates,[destination]: { ...t,timeStyle:e.target.value as FactTemplate['timeStyle'] } })}><option>12h</option><option>24h</option></select></label><label className="check-label"><input type="checkbox" checked={t.zoneDisplay === 'iana'} onChange={e => setTemplates({ ...templates,[destination]: { ...t,zoneDisplay:e.target.checked ? 'iana' : 'hidden' } })} />Include timezone</label></>}
      {type === 'money' && <label>Currency display<select aria-label="Currency display" value={t.currencyDisplay} onChange={e => setTemplates({ ...templates,[destination]: { ...t,currencyDisplay:e.target.value as FactTemplate['currencyDisplay'] } })}><option>code</option><option>symbol</option></select></label>}
      {type === 'phone' && <label>Phone display<select aria-label="Phone display" value={t.phoneDisplay} onChange={e => setTemplates({ ...templates,[destination]: { ...t,phoneDisplay:e.target.value as FactTemplate['phoneDisplay'] } })}><option>international</option><option>original</option></select></label>}
      {type === 'url' && <label>URL display<select aria-label="URL display" value={t.urlDisplay} onChange={e => setTemplates({ ...templates,[destination]: { ...t,urlDisplay:e.target.value as FactTemplate['urlDisplay'] } })}><option>target</option><option>label</option></select></label>}
    </details><button onClick={() => onPreview(value, templates)}>Preview typed fact change</button>
  </div>;
}
