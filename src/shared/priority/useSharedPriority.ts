import { useMemo } from 'react';
import { useOpportunities } from '@/modules/jobsPipeline/hooks/useOpportunities';
import { useCustomerPriority } from './useCustomerPriority';
import { customerPriorityRows, enquiryPriorityRows, type SharedPriorityRow } from './lanes';

/**
 * THE priority lists. Inbox Priority (Enquiries / Customers) and Hub lanes (Sales / CS)
 * both render exactly these rows. Enquiries = jobsPipeline todayList (same as Pipeline).
 */
export function useSharedPriority(): { enquiries: SharedPriorityRow[]; customers: SharedPriorityRow[]; enquiriesLoading: boolean; customersLoading: boolean } {
  const opps = useOpportunities();
  const customers = useCustomerPriority();
  return useMemo(() => ({
    enquiries: enquiryPriorityRows(opps.today),
    customers: customerPriorityRows(customers.rows),
    enquiriesLoading: opps.isLoading || opps.listLoading,
    customersLoading: customers.isLoading,
  }), [opps.today, opps.isLoading, opps.listLoading, customers.rows, customers.isLoading]);
}
