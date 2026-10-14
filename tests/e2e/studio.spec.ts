import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { browserPaste } from './helpers';
const source = (p: Page) => p.getByRole('textbox',{name: 'Post source editor'});
const output = (p: Page) => p.getByTestId('export-output');
async function paste(p: Page,text: string) { await source(p).focus(); await p.keyboard.press('Control+a'); await source(p).evaluate(browserPaste,{plain:text}); }
async function select(p: Page,start: number,length: number) { await source(p).focus(); await p.keyboard.press('Home'); for(let i=0;i<start;i++) await p.keyboard.press('ArrowRight'); for(let i=0;i<length;i++) await p.keyboard.press('Shift+ArrowRight'); }
test.beforeEach(async ({page}) => { await page.goto('/'); await expect(source(page)).toBeVisible(); });

test('Quick Format works without a brief; optional Studio metadata and channel edits survive reopening',async ({page}) => {
  await paste(page,'Launch தமிழ் 👨‍👩‍👧‍👦'); await page.keyboard.press('Control+a'); await page.getByRole('button',{name:'Bold',exact:true}).click();
  await expect(output(page)).toHaveText('Launch தமிழ் 👨‍👩‍👧‍👦'); await page.getByLabel('Opt in to Unicode emphasis').check(); await expect(output(page)).toContainText('𝗟𝗮𝘂𝗻𝗰𝗵');
  await page.getByLabel('Destination',{exact:true}).selectOption('whatsapp'); await expect(output(page)).toHaveText('*Launch தமிழ் 👨‍👩‍👧‍👦*');
  await page.getByRole('button',{name:'Edit this version',exact:true}).click(); await paste(page,'WhatsApp wording தமிழ்');
  await page.getByLabel('Destination',{exact:true}).selectOption('linkedin'); await expect(output(page)).toContainText('𝗟𝗮𝘂𝗻𝗰𝗵');
  await page.getByRole('button',{name:'Prepare a Product Message',exact:true}).click(); await page.getByLabel('Audience',{exact:true}).fill('Working professionals'); await page.getByLabel('Communication objective').selectOption('trial'); await page.getByLabel('Next action / CTA').fill('Register');
  await page.getByRole('button',{name:'Quick Format',exact:true}).click(); await page.getByLabel('Destination',{exact:true}).selectOption('whatsapp'); await expect(output(page)).toHaveText('WhatsApp wording தமிழ்');
  await expect(page.locator('.save-status')).toContainText('Saved locally'); await page.reload(); await expect(output(page)).toHaveText('WhatsApp wording தமிழ்'); await page.getByRole('button',{name:'Prepare a Product Message',exact:true}).click(); await expect(page.getByLabel('Audience',{exact:true})).toHaveValue('Working professionals');
});

test('reviewed shared date updates only explicit references and undo restores all outputs',async ({page}) => {
  await paste(page,'18 October · unbound 18 October'); await select(page,0,10);
  await page.getByRole('button',{name:'Shared details',exact:true}).click(); await page.getByLabel('Label',{exact:true}).fill('Launch date'); await page.getByRole('dialog').getByLabel('LinkedIn',{exact:true}).check(); await page.getByRole('button',{name:'Keep selected text consistent'}).click();
  await page.getByRole('button',{name:'Apply reviewed change'}).click(); await expect(source(page).locator('[data-detail-id]')).toHaveText('18 October');
  await page.getByRole('button',{name:'Shared details',exact:true}).click(); await page.getByRole('button',{name:'Update shared detail',exact:true}).click(); await page.getByLabel('New canonical value').fill('25 October'); await page.getByRole('button',{name:'Preview selective update'}).click(); await page.getByRole('button',{name:'Apply reviewed change'}).click();
  await expect(output(page)).toHaveText('25 October · unbound 18 October'); await page.getByRole('button',{name:'Undo reviewed change'}).click(); await expect(output(page)).toHaveText('18 October · unbound 18 October');
});

test('required omission blocks copying until a recorded exception; copy receipt follows clipboard success',async ({page}) => {
  await paste(page,'18 October'); await select(page,0,10); await page.getByRole('button',{name:'Shared details',exact:true}).click(); await page.getByLabel('Label',{exact:true}).fill('Date'); await page.getByRole('dialog').getByLabel('WhatsApp',{exact:true}).check(); await page.getByRole('button',{name:'Keep selected text consistent'}).click(); await page.getByRole('button',{name:'Apply reviewed change'}).click();
  await page.getByLabel('Destination',{exact:true}).selectOption('whatsapp'); await page.getByRole('button',{name:'Edit this version',exact:true}).click(); await paste(page,'Short invitation');
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText: async (text: string) => {(window as any).copied=text;}}}));
  await page.locator('.copy-actions').getByRole('button',{name:'Copy for WhatsApp'}).click(); await expect(page.getByRole('dialog',{name:'Review before copying'})).toBeVisible(); expect(await page.evaluate(() => (window as any).copied)).toBeUndefined();
  await page.getByRole('button',{name:'Record intentional destination exception'}).click(); await page.getByLabel('Reason',{exact:true}).fill('Date omitted intentionally'); await page.getByRole('button',{name:'Record reviewed exception'}).click(); await page.getByRole('dialog').getByRole('button',{name:'Copy for WhatsApp'}).click(); expect(await page.evaluate(() => (window as any).copied)).toBe('Short invitation');
  await page.getByRole('button',{name:'Close dialog'}).click(); await expect(page.getByLabel('Destination',{exact:true}).locator('option:checked')).toContainText('Copied'); await paste(page,'Short invitation updated'); await expect(page.getByLabel('Destination',{exact:true}).locator('option:checked')).toContainText('Changed since copy');
});

test('clipboard refusal exposes exact selectable payload and records only confirmed manual copy',async ({page}) => {
  await paste(page,'Exact தமிழ்\n\nhttps://example.com'); await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}})); await page.locator('.copy-actions').getByRole('button',{name:'Copy for LinkedIn'}).click();
  await expect(page.getByLabel('Manual copy text')).toHaveValue('Exact தமிழ்\n\nhttps://example.com'); await expect(page.getByLabel('Destination',{exact:true}).locator('option:checked')).toContainText('Not copied'); await page.getByRole('button',{name:'I completed manual copy'}).click(); await expect(page.getByLabel('Destination',{exact:true}).locator('option:checked')).toContainText('Copied');
});

test('360px Studio layout, keyboard controls and automatic accessibility checks',async ({page}) => {
  await page.setViewportSize({width:360,height:800}); await page.getByRole('button',{name:'Prepare a Product Message',exact:true}).click(); await page.getByLabel('Communication objective').selectOption('trial'); await page.getByLabel('Audience',{exact:true}).fill('Founders');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze(); expect(result.violations).toEqual([]);
  await page.screenshot({path:'test-results/message-studio-mobile.png',fullPage:true});
});

test('email rich clipboard uses the same plain payload and a separate editable subject',async ({page}) => {
  await page.getByLabel('Destination',{exact:true}).selectOption('email'); await page.getByLabel('Email subject',{exact:true}).fill('Workshop invitation'); await paste(page,'Hello <safe> தமிழ்'); await page.keyboard.press('Control+a'); await page.getByRole('button',{name:'Bold',exact:true}).click(); await page.getByLabel('Rich email clipboard (client unverified)').check();
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async(items:ClipboardItem[]) => { const item = items[0]; (window as any).richText = await (await item.getType('text/plain')).text(); (window as any).richHTML = await (await item.getType('text/html')).text(); },writeText:async(text:string) => { (window as any).subjectText = text; }}}));
  await page.locator('.copy-actions').getByRole('button',{name:'Copy for Email'}).click(); expect(await page.evaluate(() => (window as any).richText)).toBe(await output(page).textContent()); expect(await page.evaluate(() => (window as any).richHTML)).toContain('<strong>Hello &lt;safe&gt; தமிழ்</strong>');
  await page.getByRole('button',{name:'Copy subject',exact:true}).click(); expect(await page.evaluate(() => (window as any).subjectText)).toBe('Workshop invitation');
  await page.getByRole('button',{name:'Email layout estimate',exact:true}).click(); await expect(output(page).locator('strong')).toHaveText('Hello <safe> தமிழ்');
});

test('global Unicode setting leaves source intact and survives reopening',async ({page}) => {
  await paste(page,'Launch'); await page.keyboard.press('Control+a'); await page.getByRole('button',{name:'Bold',exact:true}).click(); await page.getByLabel('Opt in to Unicode emphasis').check(); await expect(output(page)).toHaveText('𝗟𝗮𝘂𝗻𝗰𝗵');
  await page.getByLabel('Disable Unicode emphasis across all drafts').check(); await expect(output(page)).toHaveText('Launch'); await expect(source(page)).toHaveText('Launch'); await expect(page.locator('.save-status')).toContainText('Saved locally'); await page.reload(); await expect(page.getByLabel('Disable Unicode emphasis across all drafts')).toBeChecked(); await expect(output(page)).toHaveText('Launch');
});

test('workspace backup imports add a draft with remapped references and no copied status',async ({page}) => {
  await paste(page,'18 October'); await select(page,0,10); await page.getByRole('button',{name:'Shared details',exact:true}).click(); await page.getByLabel('Label',{exact:true}).fill('Date'); await page.getByRole('button',{name:'Keep selected text consistent'}).click(); await page.getByRole('button',{name:'Apply reviewed change'}).click();
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}})); await page.locator('.copy-actions').getByRole('button',{name:'Copy for LinkedIn'}).click(); await expect(page.locator('.save-status')).toContainText('Saved locally');
  const before = await page.evaluate(() => new Promise<any[]>(resolve => { const req = indexedDB.open('sriram-linkedin-formatter',1); req.onsuccess = () => { const read = req.result.transaction('drafts').objectStore('drafts').getAll(); read.onsuccess = () => { resolve(read.result); req.result.close(); }; }; }));
  const file = { schemaVersion:1,kind:'backup',drafts:before,snippets:[],preferences:{theme:'light',guidance:true,dismissedIntro:false},recent:[] };
  await page.locator('input[type=file]').setInputFiles({name:'bundle.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))}); await page.getByRole('button',{name:'Add as new drafts',exact:true}).click();
  await expect(output(page)).toHaveText('18 October'); await expect(source(page).locator('[data-detail-id]')).not.toHaveAttribute('data-detail-id',before[0].studio.sharedDetails[0].id); await expect(page.getByLabel('Destination',{exact:true}).locator('option:checked')).toContainText('Not copied');
  await page.getByRole('button',{name:/Drafts/}).click(); await expect(page.locator('.draft-record')).toHaveCount(2);
});
