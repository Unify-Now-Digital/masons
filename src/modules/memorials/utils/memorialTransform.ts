import type { Memorial, MemorialInsert, MemorialUpdate } from '../hooks/useMemorials';
import type { MemorialFormData } from '../schemas/memorial.schema';

// UI-friendly memorial format (camelCase)
export interface UIMemorial {
  id: string;
  orderId: string;
  jobId: string | null;
  deceasedName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  cemeteryName: string;
  cemeterySection: string | null;
  cemeteryPlot: string | null;
  memorialType: string;
  name: string | null;
  price: number | null;
  material: string | null;
  color: string | null;
  dimensions: string | null;
  inscriptionText: string | null;
  inscriptionLanguage: string | null;
  installationDate: string | null;
  status: 'planned' | 'in_progress' | 'installed' | 'removed';
  condition: string | null;
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
 * Transform database memorial to UI-friendly format
 */
export function transformMemorialFromDb(memorial: Memorial): UIMemorial {
  return {
    id: memorial.id,
    orderId: memorial.order_id,
    jobId: memorial.job_id,
    deceasedName: memorial.deceased_name,
    dateOfBirth: memorial.date_of_birth || null,
    dateOfDeath: memorial.date_of_death || null,
    cemeteryName: memorial.cemetery_name,
    cemeterySection: memorial.cemetery_section || null,
    cemeteryPlot: memorial.cemetery_plot || null,
    memorialType: memorial.memorial_type,
    name: memorial.name || null,
    price: memorial.price ?? null,
    material: memorial.material || null,
    color: memorial.color || null,
    dimensions: memorial.dimensions || null,
    inscriptionText: memorial.inscription_text || null,
    inscriptionLanguage: memorial.inscription_language || null,
    installationDate: memorial.installation_date || null,
    status: memorial.status,
    condition: memorial.condition || null,
    notes: memorial.notes || null,
    createdAt: memorial.created_at,
    updatedAt: memorial.updated_at,
  };
}

/**
 * Transform array of database memorials to UI format
 */
export function transformMemorialsFromDb(memorials: Memorial[]): UIMemorial[] {
  return memorials.map(transformMemorialFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toMemorialInsert(form: MemorialFormData): MemorialInsert {
  return {
    order_id: form.orderId,
    job_id: form.jobId || null,
    deceased_name: form.deceasedName.trim(),
    date_of_birth: normalizeOptional(form.dateOfBirth),
    date_of_death: normalizeOptional(form.dateOfDeath),
    cemetery_name: form.cemeteryName.trim(),
    cemetery_section: normalizeOptional(form.cemeterySection),
    cemetery_plot: normalizeOptional(form.cemeteryPlot),
    memorial_type: form.memorialType.trim(),
    material: normalizeOptional(form.material),
    color: normalizeOptional(form.color),
    dimensions: normalizeOptional(form.dimensions),
    inscription_text: normalizeOptional(form.inscriptionText),
    inscription_language: normalizeOptional(form.inscriptionLanguage),
    installation_date: normalizeOptional(form.installationDate),
    status: form.status,
    condition: normalizeOptional(form.condition),
    notes: normalizeOptional(form.notes),
  };
}

/**
 * Convert form data to database update payload
 */
export function toMemorialUpdate(form: MemorialFormData): MemorialUpdate {
  return {
    order_id: form.orderId,
    job_id: form.jobId || null,
    deceased_name: form.deceasedName.trim(),
    date_of_birth: normalizeOptional(form.dateOfBirth),
    date_of_death: normalizeOptional(form.dateOfDeath),
    cemetery_name: form.cemeteryName.trim(),
    cemetery_section: normalizeOptional(form.cemeterySection),
    cemetery_plot: normalizeOptional(form.cemeteryPlot),
    memorial_type: form.memorialType.trim(),
    material: normalizeOptional(form.material),
    color: normalizeOptional(form.color),
    dimensions: normalizeOptional(form.dimensions),
    inscription_text: normalizeOptional(form.inscriptionText),
    inscription_language: normalizeOptional(form.inscriptionLanguage),
    installation_date: normalizeOptional(form.installationDate),
    status: form.status,
    condition: normalizeOptional(form.condition),
    notes: normalizeOptional(form.notes),
  };
}

