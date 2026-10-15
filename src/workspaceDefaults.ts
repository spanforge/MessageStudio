import { newDraft, type Doc } from './model';
import { initialStudio, type Destination } from './studio';

/** New workspace drafts use WhatsApp; legacy records retain the legacy fallback. */
export function newWorkspaceDraft(doc?: Doc, title?: string, destination: Destination = 'whatsapp') {
  return { ...newDraft(doc,title),studio:{ ...initialStudio(),activeDestination:destination } };
}
