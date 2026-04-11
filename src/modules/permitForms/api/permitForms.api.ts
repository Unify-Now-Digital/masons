import { supabase } from '@/shared/lib/supabase';

export interface PermitForm {
  id: string;
  name: string;
  link: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type PermitFormInsert = {
  name: string;
  link?: string | null;
  note?: string | null;
};

export type PermitFormUpdate = Partial<PermitFormInsert>;

export async function listPermitForms(organizationId: string, search?: string): Promise<PermitForm[]> {
  let query = supabase
    .from('permit_forms')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  const q = search?.trim();
  if (q) {
    query = query.ilike('name', `%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PermitForm[];
}

export async function getPermitForm(id: string, organizationId: string): Promise<PermitForm> {
  const { data, error } = await supabase
    .from('permit_forms')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single();

  if (error) throw error;
  return data as PermitForm;
}

export async function createPermitForm(
  payload: PermitFormInsert,
  organizationId: string,
): Promise<PermitForm> {
  const { data, error } = await supabase
    .from('permit_forms')
    .insert({
      name: payload.name,
      link: payload.link ?? null,
      note: payload.note ?? null,
      organization_id: organizationId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PermitForm;
}

export async function updatePermitForm(id: string, updates: PermitFormUpdate): Promise<PermitForm> {
  const { data, error } = await supabase
    .from('permit_forms')
    .update({
      ...updates,
      link: updates.link === undefined ? undefined : updates.link ?? null,
      note: updates.note === undefined ? undefined : updates.note ?? null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as PermitForm;
}

export async function deletePermitForm(id: string): Promise<void> {
  const { error } = await supabase.from('permit_forms').delete().eq('id', id);
  if (error) throw error;
}
