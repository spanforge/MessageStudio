// Firefox omits constructor-provided clipboardData on untrusted synthetic events.
import type { Page } from '@playwright/test';

/** Existing-workspace regression setup: consent and destination chosen in a prior session. */
export async function openSavedWorkspace(page: Page, url = '/') {
  await page.goto(url);
  await page.getByRole('textbox',{name:'Post source editor'}).waitFor();
  await page.evaluate(() => new Promise<void>((resolve,reject) => {
    const request = indexedDB.open('sriram-linkedin-formatter',1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('meta','readwrite');
      tx.objectStore('meta').put({id:'localSavingConsent',value:true});
      tx.objectStore('meta').put({id:'preferredDestination',value:'linkedin'});
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await page.getByRole('textbox',{name:'Post source editor'}).waitFor();
}

// Define the supplied test data explicitly; production still uses native paste events.
export function browserPaste(el: HTMLElement, data: { plain?: string; html?: string }) {
  const transfer = new DataTransfer(); if (data.plain !== undefined) transfer.setData('text/plain', data.plain); if (data.html !== undefined) transfer.setData('text/html', data.html);
  const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer });
  Object.defineProperty(event, 'clipboardData', { value: transfer }); el.dispatchEvent(event);
}
