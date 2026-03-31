// ---------------------------------------------------------------------------
// Proof Agent — TypeScript types
// ---------------------------------------------------------------------------

export type ProofState =
  | 'not_started'
  | 'generating'
  | 'draft'
  | 'sent'
  | 'approved'
  | 'changes_requested'
  | 'failed';

export type ProofRenderMethod = 'ai_image' | 'canvas_composite' | 'manual_upload';
export type ProofSentVia = 'email' | 'whatsapp' | 'both';
export type ProofApprovedBy = 'staff_manual' | 'customer_email' | 'customer_whatsapp';

export interface OrderProof {
  id: string;
  order_id: string;
  user_id: string;
  inscription_text: string;
  stone_photo_url: string;
  font_style: string | null;
  additional_instructions: string | null;
  render_url: string | null;
  render_method: ProofRenderMethod;
  render_provider: string | null;
  render_meta: Record<string, unknown> | null;
  state: ProofState;
  last_error: string | null;
  sent_via: ProofSentVia | null;
  sent_at: string | null;
  inbox_conversation_id: string | null;
  approved_at: string | null;
  approved_by: ProofApprovedBy | null;
  changes_requested_at: string | null;
  changes_note: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderProofInsert = Pick<
  OrderProof,
  | 'order_id'
  | 'user_id'
  | 'inscription_text'
  | 'stone_photo_url'
  | 'font_style'
  | 'additional_instructions'
>;

// ---------------------------------------------------------------------------
// Edge Function request/response types
// ---------------------------------------------------------------------------

export interface ProofGenerateRequest {
  order_id: string;
  inscription_text: string;
  stone_photo_url: string;
  font_style?: string | null;
  additional_instructions?: string | null;
}

export interface ProofGenerateResponse {
  proof_id: string;
  render_url: string | null;
  state: ProofState;
  error?: string;
}

export interface ProofSendRequest {
  proof_id: string;
  channels: ('email' | 'whatsapp')[];
  customer_email?: string | null;
  customer_phone?: string | null;
  message_text?: string;
}

export interface ProofSendResponse {
  proof_id: string;
  state: ProofState;
  sent_via: ProofSentVia;
  inbox_conversation_ids: string[];
}
