import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { inquiriesKeys } from '../api/inquiriesKeys';
import { getInquiriesPipeline } from '../api/getInquiriesPipeline';
import type { GetInquiriesPipelineRpcArgs, InquiriesFilterState, InquiryChannel } from '../types/inquiries';

const ALL_CHANNELS: InquiryChannel[] = ['contact', 'quote', 'appointment', 'call', 'shortlist'];

function channelsRpcPayload(channels: InquiryChannel[]): InquiryChannel[] | null {
  if (channels.length === ALL_CHANNELS.length) return null;
  return channels;
}

function boundsFromPreset(filters: InquiriesFilterState): { from: string | null; to: string | null } {
  const now = new Date();

  switch (filters.preset) {
    case 'today':
      return {
        from: startOfDay(now).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'last_7_days':
      return {
        from: startOfDay(subDays(now, 6)).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'last_30_days':
      return {
        from: startOfDay(subDays(now, 29)).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'all_time':
      return { from: null, to: null };
    case 'custom': {
      if (!filters.customFrom || !filters.customTo) {
        return {
          from: startOfDay(subDays(now, 29)).toISOString(),
          to: endOfDay(now).toISOString(),
        };
      }
      return {
        from: startOfDay(filters.customFrom).toISOString(),
        to: endOfDay(filters.customTo).toISOString(),
      };
    }
    default:
      return { from: null, to: null };
  }
}

export function buildInquiriesRpcArgs(
  organizationId: string,
  filters: InquiriesFilterState,
): GetInquiriesPipelineRpcArgs {
  const { from, to } = boundsFromPreset(filters);
  return {
    organizationId,
    channels: channelsRpcPayload(filters.channels),
    fromDateIso: from,
    toDateIso: to,
  };
}

export function useDefaultInquiriesFilters(): InquiriesFilterState {
  return useMemo(
    () => ({
      channels: [...ALL_CHANNELS],
      preset: 'last_30_days',
      customFrom: null,
      customTo: null,
    }),
    [],
  );
}

export function useInquiriesPipeline(filters: InquiriesFilterState) {
  const { organizationId } = useOrganization();

  const rpcArgs = useMemo(() => {
    if (!organizationId) return null;
    return buildInquiriesRpcArgs(organizationId, filters);
  }, [organizationId, filters]);

  return useQuery({
    queryKey: inquiriesKeys.pipeline.list(organizationId, rpcArgs),
    enabled: !!organizationId && !!rpcArgs,
    queryFn: () => getInquiriesPipeline(rpcArgs!),
  });
}
