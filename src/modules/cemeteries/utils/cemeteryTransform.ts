import type { CemeteryFormData } from '../schemas/cemetery.schema';
import type { CemeteryInsert } from '../hooks/useCemeteries';

export function toCemeteryInsert(values: CemeteryFormData): CemeteryInsert {
  return {
    name: values.name.trim(),
    primary_email: values.primary_email ? values.primary_email.trim() : null,
    phone: values.phone ? values.phone.trim() : null,
    address: values.address ? values.address.trim() : null,
    avg_approval_days:
      values.avg_approval_days === '' || values.avg_approval_days == null
        ? null
        : Number(values.avg_approval_days),
    notes: values.notes ? values.notes.trim() : null,
  };
}
