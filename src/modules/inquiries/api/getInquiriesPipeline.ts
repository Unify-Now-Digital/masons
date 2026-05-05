import { supabase } from '@/shared/lib/supabase';
import type { GetInquiriesPipelineRpcArgs, InquiryPipelineRow } from '../types/inquiries';

export async function getInquiriesPipeline(args: GetInquiriesPipelineRpcArgs): Promise<InquiryPipelineRow[]> {
  const { organizationId, channels, fromDateIso, toDateIso } = args;

  const { data, error } = await supabase.rpc('get_inquiries_pipeline', {
    p_organization_id: organizationId,
    p_channels: channels,
    p_from_date: fromDateIso,
    p_to_date: toDateIso,
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to load inquiries pipeline');
  }

  return (data ?? []) as InquiryPipelineRow[];
}
