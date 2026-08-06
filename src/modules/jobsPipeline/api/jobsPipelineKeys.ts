// Query keys for the jobs pipeline module. Namespace is 'jobsPipeline' —
// never 'jobs', which belongs to the legacy scheduling module's cache
// (src/modules/jobs/hooks/useJobs.ts).
export const jobsPipelineKeys = {
  all: ['jobsPipeline'] as const,
  active: (organizationId: string | null) => ['jobsPipeline', 'active', organizationId] as const,
  afterPaid: (organizationId: string | null) =>
    ['jobsPipeline', 'afterPaid', organizationId] as const,
  invoiceSummaries: (organizationId: string | null) =>
    ['jobsPipeline', 'invoiceSummaries', organizationId] as const,
  exited: (organizationId: string | null) => ['jobsPipeline', 'exited', organizationId] as const,
  dueDormantCount: (organizationId: string | null) =>
    ['jobsPipeline', 'dueDormantCount', organizationId] as const,
  conversationJob: (conversationId: string) =>
    ['jobsPipeline', 'conversationJob', conversationId] as const,
  conversationJobs: (conversationIds: string[]) =>
    ['jobsPipeline', 'conversationJobs', conversationIds.slice().sort().join(',')] as const,
};
