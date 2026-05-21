export const ghlInboxKeys = {
  all: ['ghl-inbox'] as const,
  connection: (organizationId: string) => ['ghl-inbox', 'connection', organizationId] as const,
  conversations: (organizationId: string) => ['ghl-inbox', 'conversations', organizationId] as const,
  messages: (organizationId: string, conversationId: string) =>
    ['ghl-inbox', 'messages', organizationId, conversationId] as const,
  contact: (organizationId: string, contactId: string) =>
    ['ghl-inbox', 'contact', organizationId, contactId] as const,
};
