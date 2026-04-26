export type InboxTag = 'order' | 'enquiry' | 'cemetery';

export interface ConversationTagResult {
  tags: InboxTag[];
  /** Order numbers linked to this conversation (via orderId, or via the
   *  matched person's orders). Used to enrich the "Existing order" pill. */
  orderRefs: string[];
}

export const INBOX_TAG_LABEL: Record<InboxTag, string> = {
  order: 'Existing order',
  enquiry: 'New enquiry',
  cemetery: 'Cemetery',
};
