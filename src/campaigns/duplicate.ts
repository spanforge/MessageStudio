import { validateFactValue, type FactValue } from '../facts/values';
import { state, updateDetail, updateTypedDetail } from '../studio';
import { validateCampaignBundle, type CampaignBundle } from './model';
import { refreshCampaignDraft, remapCampaign } from './transfer';

export type RecurrenceReview = { title: string; recurrenceLabel: string; values: Record<string, FactValue>; reviewedLinks: string[] };

/** Creates an isolated, reviewed recurrence. Never edits the original or schedules work. */
export function duplicateCampaign(source: CampaignBundle, review: RecurrenceReview, now = new Date().toISOString()): CampaignBundle {
  validateCampaignBundle(source);
  if (!review.title.trim() || review.title.length > 160) throw Error('Enter a campaign title of at most 160 characters.');
  if (Object.keys(review.values).length !== source.facts.length || Object.keys(review.values).some(id => !source.facts.some(f => f.id === id))) throw Error('Review every replacement fact.');
  for (const fact of source.facts) {
    const value = review.values[fact.id]; validateFactValue(value);
    if (value.type !== fact.value.type) throw Error('Replacement fact types must stay the same.');
    // Expiry is not part of the current schema; require review of every link, including literal links.
    const detail = source.drafts.flatMap(d => state(d).sharedDetails).find(d => d.id === fact.metadata.legacyDetailId);
    if ((fact.value.type === 'url' || detail?.kind === 'link') && !review.reviewedLinks.includes(fact.id)) throw Error('Review registration links for expiry and the next occurrence.');
  }
  let next = remapCampaign(source);
  next.campaign = { ...next.campaign,title:review.title.trim(),createdAt:now,updatedAt:now,parentCampaignId:source.campaign.id };
  if (review.recurrenceLabel.trim()) next.campaign.recurrenceLabel = review.recurrenceLabel.trim();
  else delete next.campaign.recurrenceLabel;
  next.facts.forEach((fact,index) => {
    const value = structuredClone(review.values[source.facts[index].id]);
    fact.value = value; fact.revision = 0; fact.previousValues = [];
    next.drafts = next.drafts.map(draft => {
      const detail = state(draft).sharedDetails.find(d => d.id === fact.metadata.legacyDetailId);
      if (!detail) return draft;
      if (detail.typed) detail.typed.previousValues = [];
      let updated = detail.typed ? updateTypedDetail(draft,detail.id,value,detail.typed.templates) : updateDetail(draft,detail.id,value.type === 'literal' ? value.text : detail.canonicalValue,value.type === 'url' ? value.url : undefined);
      const fresh = updated.studio!.sharedDetails.find(d => d.id === detail.id)!;
      fresh.revision = 0; if (fresh.typed) fresh.typed.previousValues = [];
      return updated;
    });
  });
  for (const draft of next.drafts) {
    draft.createdAt = draft.updatedAt = now; draft.revision = 0;
    if (draft.studio) { draft.studio.campaign = next.campaign.title; draft.studio.exceptions = []; delete draft.studio.trashedAt; }
  }
  next.occurrences.forEach(o => { delete o.exception; });
  for (const draft of next.drafts) next = { ...refreshCampaignDraft(next,draft),drafts:next.drafts };
  validateCampaignBundle(next); return next;
}
