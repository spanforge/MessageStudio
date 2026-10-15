import { useState } from 'react';
import type { CampaignBundle } from '../campaigns/model';
import { duplicateCampaign, type RecurrenceReview } from '../campaigns/duplicate';
import type { FactValue } from '../facts/values';
import { activeDoc, adapt, destinations, destinationNames, state, version } from '../studio';

export function RecurrenceEditor({ source, busy, onCreate, notify, unicodeDisabled }: { source: CampaignBundle; busy: boolean; onCreate: (review: RecurrenceReview) => Promise<void>; notify: (message: string) => void; unicodeDisabled?: boolean }) {
  const [title,setTitle] = useState(`${source.campaign.title} — next occurrence`.slice(0,160));
  const [label,setLabel] = useState(source.campaign.recurrenceLabel || '');
  const [values,setValues] = useState<Record<string,FactValue>>(Object.fromEntries(source.facts.map(f => [f.id,structuredClone(f.value)])));
  const [reviewed,setReviewed] = useState<string[]>([]);
  const [links,setLinks] = useState<string[]>([]);
  const [preview,setPreview] = useState<{ bundle: CampaignBundle; review: RecurrenceReview } | null>(null);
  const fieldLabels: Record<string,string> = { date:'Calendar date',time:'Local time',timeZone:'IANA timezone',amount:'Decimal amount',currency:'ISO currency',number:'International phone (+country code)',originalDisplay:'Original phone display',extension:'Extension',url:'Exact URL',label:'URL label',text:'Exact literal text' };
  return <section><h3>Duplicate with new facts</h3><p>Review every fact for the next occurrence. Channel wording is preserved. Copy receipts and destination exceptions start fresh. This creates local work without scheduling it.</p>
    <label>New campaign title<input maxLength={160} value={title} onChange={e => { setTitle(e.target.value); setPreview(null); }} /></label>
    <label>Recurrence label (optional)<input maxLength={200} value={label} onChange={e => { setLabel(e.target.value); setPreview(null); }} /></label>
    {source.facts.map(fact => {
      const value = values[fact.id];
      const isLink = fact.value.type === 'url' || source.drafts.some(d => state(d).sharedDetails.some(detail => detail.id === fact.metadata.legacyDetailId && detail.kind === 'link'));
      return <fieldset className="detail-record" key={fact.id}><legend>{fact.label}</legend><p>Current: {JSON.stringify(fact.value)}</p>
        {Object.entries(value).filter(([key]) => key !== 'type').map(([key,text]) => <label key={key}>{fieldLabels[key] || key}<input aria-label={`${fact.label}: ${fieldLabels[key] || key}`} maxLength={key === 'text' ? 5000 : 2000} type={key === 'date' ? 'date' : key === 'time' ? 'time' : 'text'} value={text} onChange={e => {
          setValues({ ...values,[fact.id]:{ ...value,[key]:e.target.value } as FactValue }); setReviewed(reviewed.filter(id => id !== fact.id)); setLinks(links.filter(id => id !== fact.id)); setPreview(null);
        }} /></label>)}
        <label className="check-label"><input type="checkbox" checked={reviewed.includes(fact.id)} onChange={e => { setReviewed(e.target.checked ? [...reviewed,fact.id] : reviewed.filter(id => id !== fact.id)); setPreview(null); }} />Reviewed {fact.label} for the next occurrence</label>
        {isLink && <label className="check-label"><input type="checkbox" checked={links.includes(fact.id)} onChange={e => { setLinks(e.target.checked ? [...links,fact.id] : links.filter(id => id !== fact.id)); setPreview(null); }} />I checked {fact.label} for expiry and suitability for the next occurrence</label>}
      </fieldset>;
    })}
    <button disabled={busy || reviewed.length !== source.facts.length} onClick={() => { try {
      const review = { title,recurrenceLabel:label,values:structuredClone(values),reviewedLinks:[...links] };
      setPreview({ bundle:duplicateCampaign(source,review),review });
    } catch(e) { notify((e as Error).message); } }}>Preview recurring campaign</button>
    {preview && <div className="notice"><h3>Review new campaign: {preview.bundle.campaign.title}</h3><p>The original campaign and its history stay intact. Check unlinked wording for dates and other details that need manual editing.</p>
      {preview.bundle.drafts.map((draft,index) => <div key={draft.id}><h4>{draft.title}</h4>{destinations.map(id => <details key={id}><summary>{destinationNames[id]}</summary><div className="compare"><div><strong>Original</strong><pre className="text-preview">{adapt(activeDoc(source.drafts[index],id),state(source.drafts[index]),id,unicodeDisabled).output}</pre>{id === 'email' && <p>Subject: {adapt(version(state(source.drafts[index]),id).subject,state(source.drafts[index]),id,unicodeDisabled).output}</p>}</div><div><strong>New occurrence</strong><pre className="text-preview">{adapt(activeDoc(draft,id),state(draft),id,unicodeDisabled).output}</pre>{id === 'email' && <p>Subject: {adapt(version(state(draft),id).subject,state(draft),id,unicodeDisabled).output}</p>}</div></div></details>)}</div>)}
      <button disabled={busy} className="primary" onClick={() => void onCreate(preview.review)}>Create reviewed recurring campaign</button>
    </div>}
  </section>;
}
