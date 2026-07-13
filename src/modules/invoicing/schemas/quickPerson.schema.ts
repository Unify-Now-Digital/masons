import { z } from "zod";

// Stricter than the customers module's schema: email is REQUIRED here because
// stripe-create-invoice rejects people without an email.
export const quickPersonFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("A valid email is required"),
  phone: z.string().trim().optional().or(z.literal("")),
});

export type QuickPersonFormData = z.infer<typeof quickPersonFormSchema>;
