import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { browserPaste } from './helpers';

const source = (page: Page) => page.getByRole('textbox',{name:'Post source editor'});
async function diskText(page: Page) {
  return page.evaluate(() => new Promise<string>((resolve,reject) => {
    const req = indexedDB.open('sriram-linkedin-formatter',1);
    req.onsuccess = () => {
      const db = req.result, names = ['drafts','revisions','meta','migrationBackup'];
      const tx = db.transaction(names), records: unknown[] = [];
      for (const name of names) { const read = tx.objectStore(name).getAll(); read.onsuccess = () => records.push(read.result); }
      tx.oncomplete = () => { db.close(); resolve(JSON.stringify(records)); }; tx.onerror = () => reject(tx.error);
    }; req.onerror = () => reject(req.error);
  }));
}
test.beforeEach(async ({page}) => { await page.goto('/'); await expect(source(page)).toBeVisible(); });

test('new users can format, copy, save reusable text and export without device writes, then opt in',async ({page}) => {
  await expect(page.getByLabel('Destination',{exact:true})).toHaveValue('whatsapp');
  await source(page).evaluate(browserPaste,{plain:'SESSIONPRIVATETOKEN'});
  await source(page).focus(); await page.keyboard.press('Control+a'); await page.getByRole('button',{name:'Bold',exact:true}).click();
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async (text: string) => { (window as any).copied = text; }}}));
  await page.locator('.copy-actions').getByRole('button',{name:'Copy for WhatsApp'}).click();
  expect(await page.evaluate(() => (window as any).copied)).toBe('*SESSIONPRIVATETOKEN*');
  await page.getByRole('button',{name:'＋ Saved text'}).click();
  await page.getByLabel('Name',{exact:true}).fill('Session snippet'); await page.getByLabel('Plain text',{exact:true}).fill('SNIPPET_PRIVATE_TOKEN');
  await page.getByRole('button',{name:'Save text',exact:true}).click(); await page.getByRole('button',{name:'Close dialog'}).click();
  // Exceed the autosave debounce to verify that it still makes no durable content writes.
  await page.waitForTimeout(750);
  await expect(page.locator('.save-status')).toHaveText('In this tab only');
  expect(await diskText(page)).not.toContain('PRIVATE');
  await page.getByRole('button',{name:'Export ↓'}).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button',{name:'Editable draft JSON'}).click();
  const download = await pending, stream = await download.createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toContain('SESSIONPRIVATETOKEN');
  // Download closes the export dialog.
  if (await page.getByRole('button',{name:'Close dialog'}).count()) await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'Save on this device',exact:true}).click();
  await expect(page.locator('.save-status')).toContainText('Saved locally');
  expect(await diskText(page)).toContain('SESSIONPRIVATETOKEN'); expect(await diskText(page)).toContain('SNIPPET_PRIVATE_TOKEN');
  await page.reload(); await expect(page.getByTestId('export-output')).toHaveText('*SESSIONPRIVATETOKEN*');
  await expect(page.getByRole('button',{name:'Save on this device',exact:true})).toHaveCount(0);
});

test('session-only changes disappear on reload and campaign entry needs no brief',async ({page}) => {
  await page.getByRole('button',{name:'Campaign workspace',exact:true}).click();
  await expect(page.getByLabel('Communication objective')).toBeHidden();
  await expect(page.getByRole('button',{name:'Campaign: Create or import'})).toBeVisible();
  await source(page).evaluate(browserPaste,{plain:'DISCARD_SESSION_TOKEN'});
  await page.waitForTimeout(750);
  page.on('dialog',dialog => void dialog.accept());
  await page.reload(); await expect(source(page)).toHaveText('');
  expect(await diskText(page)).not.toContain('DISCARD_SESSION_TOKEN');
  await page.setViewportSize({width:360,height:800});
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('chosen destinations survive reload and new messages',async ({page}) => {
  await page.getByRole('button',{name:'Save on this device',exact:true}).click();
  await page.getByLabel('Destination',{exact:true}).selectOption('email');
  await source(page).evaluate(browserPaste,{plain:'Saved email'});
  await expect(page.locator('.save-status')).toContainText('Saved locally');
  await page.reload(); await expect(page.getByLabel('Destination',{exact:true})).toHaveValue('email');
  await page.getByRole('button',{name:'New message',exact:true}).click();
  await expect(page.getByLabel('Destination',{exact:true})).toHaveValue('email');
});

test('suggestions span formatting and bind only checked matching occurrences with one undo',async ({page}) => {
  const text = '18 October 2026 | 18 October 2026 | 18 October 2026';
  await source(page).evaluate(browserPaste,{plain:text}); await source(page).focus();
  await source(page).evaluate(el => {
    const node = el.querySelector('p')!.firstChild!, range = document.createRange();
    range.setStart(node,3); range.setEnd(node,10);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(page.getByRole('button',{name:'Clear formatting',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Bold',exact:true}).click();
  await expect(source(page).locator('strong')).toHaveText('October');
  await page.getByRole('button',{name:'Shared details',exact:true}).click();
  await page.getByRole('button',{name:'Find fact suggestions'}).click();
  await page.getByRole('button',{name:'18 October 2026 · occurrence 1',exact:true}).click();
  await page.getByLabel('Link 18 October 2026 · occurrence 2',{exact:true}).check();
  await page.getByRole('button',{name:'Confirm value and review format'}).click();
  await page.getByRole('button',{name:'Preview typed fact change'}).click(); await page.getByRole('button',{name:'Apply reviewed change'}).click();
  await expect(source(page).locator('[data-detail-id]')).toHaveCount(2);
  await expect(page.getByTestId('export-output')).toContainText('| 18 October 2026');
  await page.getByRole('button',{name:'Undo reviewed change'}).click();
  await expect(source(page)).toHaveText(text); await expect(source(page).locator('strong')).toHaveText('October');
});

test('typed datetimes require explicit zones, reject gaps and surface repeated times',async ({page}) => {
  await source(page).evaluate(browserPaste,{plain:'Repeated time'}); await source(page).focus(); await page.keyboard.press('Control+a');
  await page.getByRole('button',{name:'Shared details',exact:true}).click(); await page.getByRole('button',{name:'Keep selected text consistent'}).click();
  await page.getByRole('button',{name:'Apply reviewed change'}).click(); await page.getByRole('button',{name:'Shared details',exact:true}).click();
  await page.getByLabel('Fact type',{exact:true}).selectOption('datetime');
  await expect(page.getByLabel('IANA timezone',{exact:true})).toHaveValue('');
  await page.getByLabel('Calendar date',{exact:true}).fill('2026-11-01'); await page.getByLabel('Local time',{exact:true}).fill('01:30');
  await page.getByLabel('IANA timezone',{exact:true}).fill('America/New_York');
  await expect(page.getByRole('button',{name:'Preview typed fact change'})).toBeDisabled();
  await page.getByLabel('I reviewed this repeated local time.',{exact:false}).check();
  await expect(page.getByRole('button',{name:'Preview typed fact change'})).toBeEnabled();
  await page.getByLabel('Calendar date',{exact:true}).fill('2026-03-08'); await page.getByLabel('Local time',{exact:true}).fill('02:30');
  await page.getByRole('button',{name:'Preview typed fact change'}).click();
  await expect(page.locator('.live-status')).toContainText('does not exist'); await expect(source(page)).toHaveText('Repeated time');
});
