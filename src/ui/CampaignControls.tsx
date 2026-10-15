import { useState } from 'react';
import type { Workbench } from '../useWorkbench';
import { parseCampaignImport } from '../campaigns/transfer';
import type { CampaignBundle } from '../campaigns/model';
import { exportJSON } from '../services';
import { config } from '../config';
import { Dialog } from './Dialog';
import { RecurrenceEditor } from './RecurrenceEditor';

export function CampaignControls({ w }: { w: Workbench }) {
  const [open,setOpen] = useState(false), [title,setTitle] = useState(w.draft.title), [text,setText] = useState(''), [incoming,setIncoming] = useState<CampaignBundle | null>(null), [busy,setBusy] = useState(false);
  const [recurring,setRecurring] = useState<CampaignBundle | null>(null);
  const campaign = w.campaigns.find(c => c.campaign.draftIds.includes(w.draft.id));
  const run = async (action: () => Promise<unknown> | unknown) => { if (busy) return; setBusy(true); try { await action(); } catch(e) { w.notify((e as Error).message); } finally { setBusy(false); } };
  return <><button onClick={() => setOpen(true)}>Campaign: {campaign?.campaign.title || 'Create or import'}</button>{open && <Dialog title="Local campaign" onClose={() => setOpen(false)} wide>
    <p>Organize this announcement and its channel versions. Campaign storage requires choosing Save on this device. Export backups before clearing browser data.</p>
    {campaign ? <><h3>{campaign.campaign.title}</h3><p>{campaign.facts.length} approved facts · {campaign.occurrences.length} linked channel occurrences</p><button disabled={busy} onClick={() => void run(async () => { const bundle = await w.exportCampaign(); if (!exportJSON('message-studio-campaign.json',bundle,config.importBytes)) w.notify('Campaign exported, but it exceeds the import size limit.'); })}>Export campaign JSON</button></> : <><label>Campaign title<input value={title} maxLength={160} onChange={e => setTitle(e.target.value)} /></label><p>Existing shared details are preserved as literals unless you explicitly confirmed a typed value. Creating a campaign adds stable reference identities without rewriting your message.</p><button disabled={busy} onClick={() => void run(async () => { await w.createCampaign(title); w.notify('Campaign created locally.'); })}>Create campaign from this draft</button></>}
    {campaign && <><button disabled={busy} onClick={() => void run(async () => { setRecurring(await w.exportCampaign()); })}>Duplicate with new facts</button>{recurring && <RecurrenceEditor key={recurring.campaign.id + ':' + recurring.campaign.revision} source={recurring} busy={busy} notify={w.notify} unicodeDisabled={w.preferences.unicodeDisabled} onCreate={async review => { await run(async () => { await w.duplicateCampaign(recurring,review); setRecurring(null); setOpen(false); w.notify('New recurring campaign created locally. Original history preserved.'); }); }} />}</>}
    <details><summary>Import a campaign JSON backup</summary><label>Campaign JSON<textarea rows={6} value={text} onChange={e => { setText(e.target.value); setIncoming(null); }} /></label><button disabled={busy || !text} onClick={() => void run(() => setIncoming(parseCampaignImport(text)))}>Review campaign import</button>{incoming && <div className="notice"><p>Add “{incoming.campaign.title}” with {incoming.drafts.length} drafts and {incoming.facts.length} facts? Existing work stays; incoming copy receipts are discarded.</p><button disabled={busy} onClick={() => void run(async () => { await w.importCampaign(incoming); setIncoming(null); setText(''); setOpen(false); w.notify('Campaign imported as new local work.'); })}>Add campaign as new work</button></div>}</details>
  </Dialog>}</>;
}
