import { z } from 'zod';

export const searchTerminalSchema = z.object({
  cemeteryName: z.string().trim().min(1, 'Cemetery or church name is required'),
});

export type SearchTerminalFormData = z.infer<typeof searchTerminalSchema>;

export const emailDraftSchema = z.object({
  to: z.string().trim().min(1, 'Recipient email is required').email('Invalid email address'),
  subject: z.string().trim().min(1, 'Subject is required'),
  body: z.string().trim().min(1, 'Email body is required'),
});

export type EmailDraftFormData = z.infer<typeof emailDraftSchema>;

export const activityNoteSchema = z.object({
  description: z.string().trim().min(1, 'Note content is required'),
});

export type ActivityNoteFormData = z.infer<typeof activityNoteSchema>;
