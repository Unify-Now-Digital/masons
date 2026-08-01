// Query keys for the jobs pipeline module. Namespace is 'jobsPipeline' —
// never 'jobs', which belongs to the legacy scheduling module's cache
// (src/modules/jobs/hooks/useJobs.ts).
export const jobsPipelineKeys = {
  all: ['jobsPipeline'] as const,
  active: (organizationId: string | null) => ['jobsPipeline', 'active', organizationId] as const,
  invoiceSummaries: (organizationId: string | null) =>
    ['jobsPipeline', 'invoiceSummaries', organizationId] as const,
  exited: (organizationId: string | null) => ['jobsPipeline', 'exited', organizationId] as const,
  conversationJob: (conversationId: string) =>
    ['jobsPipeline', 'conversationJob', conversationId] as const,
};
