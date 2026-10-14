import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Store, defaultPreferences } from '../../src/storage';
import { newDraft, fromText, sourceText, type Backup } from '../../src/model';
import { initialStudio } from '../../src/studio';
const store = new Store(); beforeEach(async () => { await store.clear(); });
describe('Draft durability and atomic writes', () => {
  it('restores preferences in an empty workspace and preserves them when adding to existing work', async () => {
    const preferences = { ...defaultPreferences, unicodeDisabled:true };
    await store.addImported([newDraft()],[],undefined,preferences); expect(await store.meta('preferences',null)).toEqual(preferences);
    await store.addImported([newDraft()],[],undefined,defaultPreferences); expect(await store.meta('preferences',null)).toEqual(preferences);
  });
  it('snapshots schema-1 data before its first additive Studio save', async () => {
    const legacy = await store.save(newDraft(fromText('Existing தமிழ்')),0);
    const saved = await store.save({ ...legacy, studio: initialStudio() },legacy.revision);
    expect(saved.id).toBe(legacy.id); expect(saved.editorDocument).toEqual(legacy.editorDocument);
    const db = await store.open(); const original = await new Promise<any>(resolve => { const req = db.transaction('migrationBackup').objectStore('migrationBackup').get(legacy.id); req.onsuccess = () => resolve(req.result); });
    expect(original.payload).toEqual(legacy);
  });
  it('adds a whole validated import atomically and leaves existing work intact on cap failure', async () => {
    const original = await store.save(newDraft(fromText('Keep me')),0);
    await store.addImported([newDraft(fromText('New one')),newDraft(fromText('New two'))],[]); expect(await store.list()).toHaveLength(3); expect(await store.get(original.id)).toEqual(original);
    await expect(store.addImported(Array.from({length:48},() => newDraft()),[])).rejects.toThrow('50 drafts'); expect(await store.list()).toHaveLength(3);
  });
  it('guards replacement and Trash purge against another tab changing the snapshot', async () => {
    const d = await store.save(newDraft(fromText('Original')),0), expected = await store.list(); await store.save({ ...d,title:'Other tab'},d.revision);
    const backup: Backup = { schemaVersion:1,kind:'backup',drafts:[],snippets:[],preferences:defaultPreferences,recent:[] };
    await expect(store.importBackup(backup,expected)).rejects.toThrow('another tab'); expect(await store.list()).toHaveLength(1);
    await expect(store.purgeTrash([d])).rejects.toThrow('another tab'); expect(await store.list()).toHaveLength(1);
  });
  it('commits source and marks and keeps only the last 20 successful revisions', async () => {
    let draft = newDraft(fromText('தமிழ் 👨‍👩‍👧‍👦')); for (let i = 0; i < 25; i++) draft = await store.save(draft, draft.revision);
    expect(await store.get(draft.id)).toEqual(draft); expect((await store.revisions(draft.id)).map(d => d.revision)).toEqual(Array.from({ length: 20 }, (_,i) => i + 6)); expect(sourceText((await store.get(draft.id))!.editorDocument)).toBe('தமிழ் 👨‍👩‍👧‍👦');
  });
  it('rejects simultaneous stale writers without last-write-wins', async () => {
    const d = await store.save(newDraft(), 0); const results = await Promise.allSettled([store.save({ ...d, title: 'Tab one' }, d.revision), store.save({ ...d, title: 'Tab two' }, d.revision)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(results.filter(r => r.status === 'rejected')).toHaveLength(1); expect((await store.get(d.id))!.revision).toBe(2);
  });
  it('rejects draft 51 without touching existing drafts', async () => { for (let i = 0; i < 50; i++) await store.save(newDraft(), 0); await expect(store.save(newDraft(), 0)).rejects.toThrow('50 drafts'); expect(await store.list()).toHaveLength(50); });
  it('imports validated backup atomically and rejects malformed backup', async () => {
    const d = await store.save(newDraft(fromText('Original')), 0); const backup: Backup = { schemaVersion: 1, kind: 'backup', drafts: [newDraft(fromText('Imported'))], snippets: [{ id: 's', title: 'Signature', text: 'Regards' }], preferences: defaultPreferences, recent: [] };
    await expect(store.importBackup({ ...backup, drafts: [{ ...d, schemaVersion: 999 } as any] })).rejects.toThrow(); expect(await store.get(d.id)).toEqual(d);
    await store.importBackup(backup); expect(await store.get(d.id)).toBeUndefined(); expect(await store.meta('snippets', [])).toEqual(backup.snippets);
  });
  it('retains legacy payload during migration and does not overwrite on failure', async () => {
    const db = await store.open(); const old = { schemaVersion: 0, id: 'legacy', title: 'Old', text: 'Tamil தமிழ்\r\nHello' }; const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(old); await new Promise(r => { tx.oncomplete = r; });
    const migrated = await store.migrate(old); expect(sourceText(migrated.editorDocument)).toBe('Tamil தமிழ்\nHello');
    const savedOriginal = await new Promise<any>(r => { const req = db.transaction('migrationBackup').objectStore('migrationBackup').get('legacy'); req.onsuccess = () => r(req.result); }); expect(savedOriginal.payload).toEqual(old);
    await store.save({ ...migrated, studio: initialStudio() },migrated.revision);
    const afterUpgrade = await new Promise<any>(resolve => { const req = db.transaction('migrationBackup').objectStore('migrationBackup').get('legacy'); req.onsuccess = () => resolve(req.result); });
    expect(afterUpgrade.payload).toEqual(old); expect(afterUpgrade.studioBaseline.editorDocument).toEqual(migrated.editorDocument);
    await expect(store.migrate({ schemaVersion: 0, id: 'bad', text: 'x'.repeat(50001) })).rejects.toThrow(); expect(await store.raw('bad')).toBeUndefined();
  });
});
