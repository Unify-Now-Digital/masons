import { z } from 'zod';

// ---------------------------------------------------------------------------
// ProofGenerateForm validation schema
// ---------------------------------------------------------------------------

export const proofGenerateFormSchema = z.object({
  inscription_text: z
    .string()
    .trim()
    .min(1, 'Inscription text is required'),
  stone_photo_url: z
    .string()
    .trim()
    .min(1, 'Stone photo URL is required')
    .url('Must be a valid URL'),
  font_style: z.string().trim().optional().nullable(),
  additional_instructions: z.string().trim().optional().nullable(),
});

export type ProofGenerateFormData = z.infer<typeof proofGenerateFormSchema>;

// ---------------------------------------------------------------------------
// ProofSendForm validation schema
// ---------------------------------------------------------------------------

export const proofSendFormSchema = z
  .object({
    channels: z
      .array(z.enum(['email', 'whatsapp']))
      .min(1, 'Select at least one channel'),
    customer_email: z.string().trim().email('Invalid email').optional().nullable(),
    customer_phone: z.string().trim().optional().nullable(),
    message_text: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.channels.includes('email') && !data.customer_email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customer_email'],
        message: 'Customer email is required when sending via email',
      });
    }
    if (data.channels.includes('whatsapp') && !data.customer_phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customer_phone'],
        message: 'Customer phone is required when sending via WhatsApp',
      });
    }
  });

export type ProofSendFormData = z.infer<typeof proofSendFormSchema>;
