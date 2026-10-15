import { useEffect, useRef, useState } from 'react';
import { config } from './config';
import { activeDoc, state, version, remapDraft, type Studio, type Destination, type Brand } from './studio';
import { newDraft, validateDraft, validatePreferences, validateSnippets, type Backup, type Doc, type Draft, type Preferences, type Snippet } from './model';
import { ConflictError, defaultPreferences, storage } from './storage';
import { CampaignStore } from './campaigns/storage';
import { campaignFromLegacy, remapWorkspaceBackup, refreshCampaignDraft, type CampaignMetadata } from './campaigns/transfer';
import type { CampaignBundle } from './campaigns/model';

export function useWorkbench() {
  const [draft, setDraft] = useState<Draft>(newDraft()); const current = useRef(draft);
  const [drafts, setDrafts] = useState<Draft[]>([]); const [corrupt, setCorrupt] = useState<{ id: string; raw: unknown; legacy: boolean }[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignMetadata[]>([]);
  const [ready, setReady] = useState(false), [saveState, setSaveState] = useState('Loading local drafts…'), [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false); const conflictRef = useRef(false);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [snippets, setSnippets] = useState<Snippet[]>([]), [recent, setRecent] = useState<string[]>([]);
  const [change, setChange] = useState(0); const dirty = useRef(false), editGeneration = useRef(0), composing = useRef(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [resumeSelection, setResumeSelection] = useState<{ from: number; to: number } | undefined>();
  const saving = useRef<Promise<boolean> | null>(null), channel = useRef<BroadcastChannel | null>(null); const tabId = useRef(crypto.randomUUID());
  const maintenance = useRef(false);
  const alive = useRef(true);
  const notify = (text: string) => setMessage(text);
  function adopt(d: Draft, isDirty = false) { current.current = d; setDraft(d); dirty.current = isDirty; editGeneration.current++; setChange(c => c + 1); }
  async function refresh() {
    let raw = await storage.list();
    const expired = raw.filter((item): item is Draft => { try { validateDraft(item); return !!item.studio?.trashedAt && Date.now() - Date.parse(item.studio.trashedAt) >= 7 * 86400000; } catch { return false; } });
    if (expired.length) { try { await storage.purgeTrash(expired); raw = await storage.list(); } catch { /* A concurrent restore wins; retry on the next refresh. */ } }
    const valid: Draft[] = [], invalid: typeof corrupt = [];
    for (const item of raw) { try { validateDraft(item); valid.push(item); } catch { const x = item as { id?: string; schemaVersion?: number }; if (typeof x?.id === 'string') invalid.push({ id: x.id, raw: item, legacy: x.schemaVersion === 0 }); } }
    valid.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); setDrafts(valid); setCorrupt(invalid); setCampaigns(await storage.campaignMetadata()); return valid;
  }
  function markConflict() { conflictRef.current = true; setConflict(true); setSaveState('Conflict — saving paused'); }
  function clearConflict() { conflictRef.current = false; setConflict(false); }
  async function flush(): Promise<boolean> {
    if (composing.current || conflictRef.current || maintenance.current) return false;
    if (saving.current) { await saving.current; if (dirty.current && !conflictRef.current) return flush(); return !dirty.current; }
    if (!dirty.current) return true;
    const snapshot = current.current, version = editGeneration.current;
    setSaveState('Saving…');
    saving.current = (async () => {
      try {
        const saved = await storage.save(snapshot, snapshot.revision);
        if (current.current.id === saved.id) {
          const merged = version === editGeneration.current ? saved : { ...current.current, revision: saved.revision, updatedAt: saved.updatedAt };
          current.current = merged; if (alive.current) setDraft(merged); dirty.current = version !== editGeneration.current;
          if (alive.current) setSaveState(dirty.current ? 'Saving…' : 'Saved locally');
        }
        channel.current?.postMessage({ type: 'save', id: saved.id, revision: saved.revision, tab: tabId.current });
        if (alive.current) await refresh(); return true;
      } catch (e) {
        if (e instanceof ConflictError) markConflict(); else setSaveState('Could not save — working in memory');
        notify(`${e instanceof Error ? e.message : 'Local storage unavailable.'} Your current words remain in this tab. Export a backup.`); return false;
      } finally { saving.current = null; }
    })();
    const result = await saving.current;
    if (result && dirty.current && !conflictRef.current) return flush();
    return result;
  }
  const flushRef = useRef(flush); flushRef.current = flush;
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const list = await refresh(); const active = await storage.meta<{ id?: string; selection?: { from: number; to: number } }>('active', {});
        const activeList = list.filter(d => !d.studio?.trashedAt); const chosen = activeList.find(d => d.id === active.id) || activeList[0];
        if (chosen) { adopt(chosen); setSaveState('Saved locally'); if (active.id === chosen.id) setResumeSelection(active.selection); }
        else { adopt(newDraft()); setSaveState('New local draft'); }
        const pref = await storage.meta('preferences', defaultPreferences); validatePreferences(pref); setPreferences(pref);
        const snips = await storage.meta<Snippet[]>('snippets', []); validateSnippets(snips); setSnippets(snips);
        const rec = await storage.meta<string[]>('recent', []); if (Array.isArray(rec) && rec.length <= 30 && rec.every(s => typeof s === 'string' && s.length < 100)) setRecent(rec);
      } catch { adopt(newDraft(), true); setSaveState('Could not load storage — working in memory'); notify('Local storage could not be loaded. Saved drafts have not been overwritten. You can edit and export this draft.'); }
      finally { if (alive.current) setReady(true); }
    })();
    let bc: BroadcastChannel | undefined;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('formatter-drafts'); channel.current = bc;
      bc.onmessage = async ({ data }) => {
        if (data.tab === tabId.current) return;
        if (data.type === 'preferences') { try { validatePreferences(data.preferences); setPreferences(data.preferences); } catch { /* Ignore malformed local notifications. */ } return; }
        if (data.type === 'reset' || (data.id === current.current.id && (data.type === 'delete' || data.revision > current.current.revision))) markConflict();
        try { await refresh(); } catch { /* Working draft stays in memory. */ }
      };
    }
    const visibility = () => { if (document.visibilityState === 'hidden') void flushRef.current(); };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current || composing.current || conflictRef.current) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('beforeunload', beforeUnload);
    return () => { alive.current = false; bc?.close(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('beforeunload', beforeUnload); };
  }, []);
  useEffect(() => { if (!ready || composing.current) return; const timer = setTimeout(() => { void flushRef.current(); }, config.autosaveMs); return () => clearTimeout(timer); }, [change, ready]);
  useEffect(() => { document.documentElement.dataset.theme = preferences.theme; }, [preferences.theme]);

  function updateDraft(d: Draft, reloadEditor = false) { validateDraft(d); adopt(d, true); setSaveState('Unsaved changes'); if (reloadEditor) setLoadVersion(v => v + 1); }
  function setStudio(patch: Partial<Studio>, reloadEditor = false) { updateDraft({ ...current.current, studio: { ...state(current.current), ...patch } }); if (reloadEditor) setLoadVersion(v => v + 1); }
  function edit(doc: Doc) {
    const d = current.current, s = state(d);
    if (!s.editingOriginal && version(s).overrideDocument) setStudio({ versions: { ...s.versions, [s.activeDestination]: { ...version(s), overrideDocument: doc, revision: version(s).revision + 1 } } });
    else updateDraft({ ...d, editorDocument: doc, studio: { ...s, originalRevision: s.originalRevision + 1 } });
  }
  function chooseDestination(id: Destination) { if (composing.current) throw Error('Finish composing before switching destinations.'); setStudio({ activeDestination: id, editingOriginal: !version(state(current.current), id).overrideDocument }, true); }
  function editVersion() { const s = state(current.current); setStudio({ editingOriginal: false, versions: { ...s.versions, [s.activeDestination]: { ...version(s), overrideDocument: structuredClone(activeDoc(current.current)), basedOnOriginalRevision: s.originalRevision } } }, true); }
  function resetVersion() { const s = state(current.current); setStudio({ editingOriginal: true, versions: { ...s.versions, [s.activeDestination]: { ...version(s), overrideDocument: undefined, basedOnOriginalRevision: s.originalRevision, revision: version(s).revision + 1 } } }, true); }
  function editSubject(doc: Doc) { const s = state(current.current); setStudio({ versions: { ...s.versions, email: { ...version(s, 'email'), subject: doc, revision: version(s, 'email').revision + 1 } } }); }
  async function duplicate(input = current.current, title = `${input.title.slice(0, 140)} (copy)`, allowConflict = false) {
    if (!allowConflict && !await flush()) throw Error('Resolve or export unsaved changes before continuing.');
    const next = remapDraft(input); next.title = title; const saved = await storage.save(next, 0); adopt(saved); setLoadVersion(v => v + 1); clearConflict(); await refresh(); await storage.setMeta('active', { id: saved.id });
  }
  function rename(title: string) { if (!title.trim() || title.length > 200) throw Error('Use a name from 1 to 200 characters.'); adopt({ ...current.current, title: title.trim() }, true); }
  async function select(d: Draft) { if (!await flush()) throw Error('Save is blocked. Resolve the conflict or export the current draft before switching.'); const fresh = await storage.get(d.id); if (!fresh) throw Error('This draft is no longer available.'); adopt(fresh); setResumeSelection(undefined); clearConflict(); setSaveState('Saved locally'); await storage.setMeta('active', { id: fresh.id }); }
  async function create(doc?: Doc, title?: string, allowConflict = false) {
    if (!allowConflict && !await flush()) throw Error('Export this draft or resolve its save failure before creating another.');
    const count = (await storage.list()).length; if (count >= config.draftLimit) throw Error('50 drafts reached. Export or delete a draft first.');
    const d = newDraft(doc, title); const saved = await storage.save(d, 0); adopt(saved); clearConflict(); setResumeSelection(undefined); setSaveState('Saved locally'); await refresh(); await storage.setMeta('active', { id: saved.id }); channel.current?.postMessage({ type: 'save', id: saved.id, revision: saved.revision, tab: tabId.current });
  }
  async function keepCopy() { await duplicate(current.current, `${current.current.title.slice(0,140)} (copy)`, true); }
  async function reload() { const saved = await storage.get(current.current.id); if (!saved) throw Error('The saved draft was removed. Keep this tab as a new copy.'); adopt(saved); setLoadVersion(v => v + 1); clearConflict(); setSaveState('Saved locally'); }
  async function remove(d: Draft) {
    if (d.id === current.current.id && !await flush()) throw Error('Resolve the save failure before deleting the active draft.');
    const latest = d.id === current.current.id ? current.current : d; await storage.save({ ...latest, studio: { ...state(latest), trashedAt: new Date().toISOString() } }, latest.revision);
    channel.current?.postMessage({ type: 'delete', id: d.id, tab: tabId.current }); const list = (await refresh()).filter(d => !d.studio?.trashedAt);
    if (d.id === current.current.id) {
      const next = list[0] || newDraft();
      adopt(next); clearConflict(); setResumeSelection(undefined);
      setSaveState(list.length ? 'Saved locally' : 'New local draft');
      await storage.setMeta('active', list.length ? { id: next.id } : {});
    }
    notify('Draft moved to Trash. Restore it from Drafts for seven days.');
  }
  async function setPreference(patch: Partial<Preferences>) { const next = { ...preferences, ...patch }; setPreferences(next); try { await storage.setMeta('preferences', next); channel.current?.postMessage({ type: 'preferences', preferences: next, tab: tabId.current }); } catch { notify('Preference could not be saved. It remains active in this tab.'); } }
  async function saveSnippets(next: Snippet[]) { validateSnippets(next); await storage.setMeta('snippets', next); setSnippets(next); }
  async function chooseEmoji(id: string) { const next = [id, ...recent.filter(x => x !== id)].slice(0, 30); setRecent(next); try { await storage.setMeta('recent', next); } catch { notify('Recent emoji history could not be saved.'); } }
  async function backup(): Promise<Backup> {
    let all = drafts; try { all = await refresh(); } catch { /* Export available without storage. */ }
    const others = all.filter(d => d.id !== current.current.id); const active = current.current;
    let brandProfile: Brand | undefined; try { brandProfile = await storage.meta<Brand | undefined>('brandProfile',undefined); } catch { /* Export active content even when storage is denied. */ }
    let metadata = campaigns;
    try { metadata = await storage.campaignMetadata(); } catch { notify('Storage is unavailable. Exporting the drafts and campaign metadata already loaded in this tab.'); }
    const latestDrafts = [...others, active];
    // A backup is also an escape path for unsaved edits/conflicts. Reconcile only the
    // exported snapshot; never require a successful write or mutate stored records.
    const allCampaigns = metadata.map(c => c.campaign.draftIds.reduce((snapshot, id) => {
      const d = latestDrafts.find(d => d.id === id); return d ? refreshCampaignDraft(snapshot, d) : snapshot;
    }, c));
    return { schemaVersion: 1, kind: 'backup', drafts: latestDrafts, snippets, preferences, recent, ...(brandProfile ? { brandProfile } : {}), ...(allCampaigns.length ? { campaigns: allCampaigns } : {}) };
  }
  async function importData(data: Draft | Backup) {
    if (!await flush()) throw Error('Resolve or export unsaved changes before importing.');
    maintenance.current = true;
    try {
      const remapped = 'kind' in data ? remapWorkspaceBackup(data) : undefined;
      const drafts = remapped ? remapped.drafts : [remapDraft(data as Draft)];
      const incomingSnippets = remapped?.snippets || [];
      const merged = [...snippets, ...incomingSnippets]; validateSnippets(merged);
      for (const d of drafts) if (d.studio?.trashedAt) d.studio.trashedAt = new Date().toISOString();
      await storage.addImported(drafts, merged, 'kind' in data ? data.brandProfile : undefined, 'kind' in data ? data.preferences : undefined, remapped?.campaigns);
      const restoredPreferences = await storage.meta('preferences',preferences); setPreferences(restoredPreferences);
      setSnippets(merged); if (drafts[0]) { adopt(drafts[0]); setLoadVersion(v => v + 1); }
      await refresh(); channel.current?.postMessage({ type: 'save', id: current.current.id, revision: current.current.revision, tab: tabId.current });
    } finally { maintenance.current = false; }
  }
  async function replaceWorkspace(data: Backup) {
    if (!await flush()) throw Error('Resolve or export unsaved changes before replacing the workspace.');
    maintenance.current = true;
    try {
      const expected = await storage.list();
      const next = remapWorkspaceBackup(data);
      await storage.importBackup(next, expected); setSnippets(next.snippets); setPreferences(next.preferences); setRecent(next.recent); adopt(next.drafts[0] || newDraft()); setLoadVersion(v => v + 1); clearConflict(); await refresh(); channel.current?.postMessage({ type: 'reset', tab: tabId.current });
    } finally { maintenance.current = false; }
  }
  async function restoreTrash(d: Draft) { const next = { ...d, studio: { ...state(d), trashedAt: undefined } }; await storage.save(next, d.revision); await refresh(); notify('Draft restored.'); }
  async function emptyTrash() { const trash = (await refresh()).filter(d => d.studio?.trashedAt); await storage.purgeTrash(trash); await refresh(); }

  async function deleteDrafts() {
    maintenance.current = true;
    try {
      if (saving.current) await saving.current;
      await storage.clearDrafts(); adopt(newDraft()); clearConflict(); setResumeSelection(undefined);
      await refresh(); channel.current?.postMessage({ type: 'reset', tab: tabId.current });
      setSaveState('Drafts removed; new empty draft'); notify('All drafts deleted.');
    } finally { maintenance.current = false; }
  }
  async function saveCaret(selection: { from: number; to: number }) { if (!ready || composing.current) return; try { await storage.setMeta('active', { id: current.current.id, selection }); } catch { /* Caret persistence is best effort. */ } }
  async function createCampaign(title: string) {
    if (!title.trim()) throw Error('Enter a campaign title.');
    if (!await flush()) throw Error('Resolve unsaved changes before creating a campaign.');
    if ((await storage.campaignMetadata()).some(c => c.campaign.draftIds.includes(current.current.id))) throw Error('This draft already belongs to a campaign.');
    const d = structuredClone(current.current); d.studio = { ...state(d), campaign: title.trim() };
    const identify = (doc: Doc) => { for (const p of doc.content) for (const n of p.content || []) if (n.type === 'sharedDetail' && !n.attrs.nodeId) n.attrs.nodeId = crypto.randomUUID(); };
    identify(d.editorDocument); for (const v of Object.values(d.studio.versions)) { if (v.overrideDocument) identify(v.overrideDocument); identify(v.subject); }
    const saved = await new CampaignStore(storage).save(campaignFromLegacy(d),null);
    adopt(saved.drafts[0]); setLoadVersion(v => v + 1); await refresh();
    channel.current?.postMessage({ type:'save',id:saved.drafts[0].id,revision:saved.drafts[0].revision,tab:tabId.current });
  }
  async function exportCampaign() {
    if (!await flush()) throw Error('Resolve unsaved changes before exporting this campaign.');
    const meta = (await storage.campaignMetadata()).find(c => c.campaign.draftIds.includes(current.current.id));
    if (!meta) throw Error('Create a campaign for this draft first.');
    const bundle = await new CampaignStore(storage).get(meta.campaign.id); if (!bundle) throw Error('Campaign no longer available.'); return bundle;
  }
  async function importCampaign(bundle: CampaignBundle) {
    if (!await flush()) throw Error('Resolve unsaved changes before importing.');
    maintenance.current = true;
    try {
      const saved = await new CampaignStore(storage).import(bundle);
      if (saved.drafts[0]) { adopt(saved.drafts[0]); setLoadVersion(v => v + 1); await storage.setMeta('active',{ id:saved.drafts[0].id }); }
      await refresh(); channel.current?.postMessage({ type:'save',id:current.current.id,revision:current.current.revision,tab:tabId.current });
    } finally { maintenance.current = false; }
  }
  return { draft, drafts, campaigns, createCampaign, exportCampaign, importCampaign, corrupt, ready, saveState, message, notify, conflict, preferences, snippets, recent, resumeSelection, loadVersion, composing, document: state(draft).editingOriginal ? draft.editorDocument : activeDoc(draft), updateDraft, setStudio, chooseDestination, editVersion, resetVersion, editSubject, duplicate, restoreTrash, emptyTrash, edit, rename, flush, select, create, keepCopy, reload, remove, setPreference, saveSnippets, chooseEmoji, backup, importData, replaceWorkspace, deleteDrafts, saveCaret, refresh };
}
export type Workbench = ReturnType<typeof useWorkbench>;
