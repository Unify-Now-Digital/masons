import type { Inscription, InscriptionInsert, InscriptionUpdate } from '../hooks/useInscriptions';
import type { InscriptionFormData } from '../schemas/inscription.schema';

// UI-friendly inscription format (camelCase)
export interface UIInscription {
  id: string;
  orderId: string;
  inscriptionText: string;
  type: 'front' | 'back' | 'side' | 'plaque' | 'additional';
  style: string | null;
  color: 'gold' | 'silver' | 'white' | 'black' | 'natural' | 'other' | null;
  proofUrl: string | null;
  status: 'pending' | 'proofing' | 'approved' | 'engraving' | 'completed' | 'installed';
  engravedBy: string | null;
  engravedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Transform database inscription to UI-friendly format
 */
export function transformInscriptionFromDb(inscription: Inscription): UIInscription {
  return {
    id: inscription.id,
    orderId: inscription.order_id,
    inscriptionText: inscription.inscription_text,
    type: inscription.type,
    style: inscription.style || null,
    color: inscription.color || null,
    proofUrl: inscription.proof_url || null,
    status: inscription.status,
    engravedBy: inscription.engraved_by || null,
    engravedDate: inscription.engraved_date || null,
    notes: inscription.notes || null,
    createdAt: inscription.created_at,
    updatedAt: inscription.updated_at,
  };
}

/**
 * Transform array of database inscriptions to UI format
 */
export function transformInscriptionsFromDb(inscriptions: Inscription[]): UIInscription[] {
  return inscriptions.map(transformInscriptionFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toInscriptionInsert(form: InscriptionFormData): InscriptionInsert {
  return {
    order_id: form.orderId,
    inscription_text: form.inscriptionText.trim(),
    type: form.type,
    style: normalizeOptional(form.style),
    color: form.color || null,
    proof_url: normalizeOptional(form.proofUrl),
    status: form.status,
    engraved_by: normalizeOptional(form.engravedBy),
    engraved_date: normalizeOptional(form.engravedDate),
    notes: normalizeOptional(form.notes),
  };
}

/**
 * Convert form data to database update payload
 */
export function toInscriptionUpdate(form: InscriptionFormData): InscriptionUpdate {
  return {
    order_id: form.orderId,
    inscription_text: form.inscriptionText.trim(),
    type: form.type,
    style: normalizeOptional(form.style),
    color: form.color || null,
    proof_url: normalizeOptional(form.proofUrl),
    status: form.status,
    engraved_by: normalizeOptional(form.engravedBy),
    engraved_date: normalizeOptional(form.engravedDate),
    notes: normalizeOptional(form.notes),
  };
}

