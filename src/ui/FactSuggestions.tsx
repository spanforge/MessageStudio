import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { FactSuggestion } from '../facts/suggestions';
import { suggestEditorFacts } from '../facts/editorSuggestions';
import { validateFactValue, type FactValue } from '../facts/values';
import { TypedFactEditor } from './TypedFactEditor';
import type { Detail } from '../studio';
import { defaultFactTemplate, type FactTemplate } from '../facts/templates';
import { destinations, type Destination } from '../studio';

type Candidate = FactSuggestion;
export function FactSuggestions({ editor, composing, onBind, notify }: { editor: Editor | null; composing: () => boolean; onBind: (occurrences: FactSuggestion[], literal: string, value: FactValue, templates: Partial<Record<Destination,FactTemplate>>) => void; notify: (message: string) => void }) {
  const [candidates,setCandidates] = useState<Candidate[]>([]);
  const [snapshot,setSnapshot] = useState('');
  const [selected,setSelected] = useState<Candidate | null>(null);
  const [choice,setChoice] = useState('');
  const [zone,setZone] = useState('');
  const [confirmed,setConfirmed] = useState<Detail | null>(null);
  const [occurrences,setOccurrences] = useState<Candidate[]>([]);
  function scan() {
    if (!editor || composing()) { notify('Finish composing before finding suggestions.'); return; }
    const found = suggestEditorFacts(editor.state.doc);
    setSnapshot(JSON.stringify(editor.state.doc.toJSON())); setCandidates(found); setSelected(null); setConfirmed(null);
  }
  function current() {
    if (!editor || composing() || JSON.stringify(editor.state.doc.toJSON()) !== snapshot) throw Error('The message changed. Find suggestions again after composing.');
  }
  return <section><h3>Suggested facts</h3><p>Find dates with years, times, INR amounts, HTTP(S) links and international phone numbers. Choose a fact, then select the matching occurrences to link. Other formats can be linked manually.</p><button onClick={scan}>Find fact suggestions</button>
    {snapshot && !candidates.length && <p>No supported candidates found.</p>}
    {candidates.map((c,i) => <button key={i} onClick={() => { setSelected(c); setOccurrences([c]); setChoice(c.choices.length === 1 ? '0' : ''); setZone(''); setConfirmed(null); }}>{c.literal} · occurrence {i+1}</button>)}
    {selected && <fieldset><legend>Occurrences to keep consistent</legend>{candidates.filter(c => c.literal === selected.literal).map(c => <label className="check-label" key={c.from}><input type="checkbox" checked={occurrences.some(o => o.from === c.from)} onChange={e => { setOccurrences(e.target.checked ? [...occurrences,c] : occurrences.filter(o => o.from !== c.from)); }} />Link {c.literal} · occurrence {candidates.indexOf(c)+1}</label>)}</fieldset>}
    {selected && !confirmed && <div className="detail-record"><p>Keep consistent: {selected.literal}</p><label>Confirmed value<select aria-label="Confirmed suggestion value" value={choice} onChange={e => setChoice(e.target.value)}><option value="">Choose day/month order</option>{selected.choices.map((v,i) => <option key={i} value={i}>{v.type === 'time' ? v.time : JSON.stringify(v)}</option>)}</select></label>{selected.needsTimeZone && <label>IANA timezone (required)<input value={zone} onChange={e => setZone(e.target.value)} placeholder="Enter a confirmed timezone" /></label>}<button disabled={choice === '' || !!selected.needsTimeZone && !zone} onClick={() => { try {
      current(); const value = { ...selected.choices[Number(choice)], ...(selected.needsTimeZone ? { timeZone:zone } : {}) } as FactValue; validateFactValue(value);
      setConfirmed({ id:crypto.randomUUID(),label:selected.literal,kind:value.type === 'date' ? 'date' : value.type === 'money' ? 'price' : value.type === 'url' ? 'link' : 'phrase',canonicalValue:selected.literal,revision:0,requiredDestinations:[],typed:{ value,templates:Object.fromEntries(destinations.map(id => [id,defaultFactTemplate(id)])),previousValues:[] } });
    } catch(e) { notify((e as Error).message); } }}>Confirm value and review format</button></div>}
    {selected && confirmed && <TypedFactEditor key={confirmed.id} detail={confirmed} onPreview={(value,templates) => { try { current(); if (!occurrences.length) throw Error('Select at least one occurrence.'); onBind(occurrences,selected.literal,value,templates); } catch(e) { notify((e as Error).message); } }} />}
  </section>;
}
