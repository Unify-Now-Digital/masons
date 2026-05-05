import type { GetInquiriesPipelineRpcArgs } from '../types/inquiries';

export const inquiriesKeys = {
  all: ['inquiries'] as const,
  pipeline: {
    all: ['inquiries', 'pipeline'] as const,
    list: (organizationId: string | undefined, args: GetInquiriesPipelineRpcArgs | null) =>
      ['inquiries', 'pipeline', organizationId ?? 'none', args] as const,
  },
};
