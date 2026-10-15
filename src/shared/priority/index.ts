/** One ranking source for Hub, Pipeline and Inbox. Enquiries = jobsPipeline todayList; Customers = customerPriority. */
export { todayList, buildOpportunity, type Opportunity } from '@/modules/jobsPipeline/utils/opportunities';
export { useOpportunities } from '@/modules/jobsPipeline/hooks/useOpportunities';
export * from './customerPriority';
export { useCustomerPriority } from './useCustomerPriority';
export { useSharedPriority } from './useSharedPriority';
export * from './lanes';
