import { useMemo } from 'react';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { contactNamesByPhone, resolveContactTitle } from '../utils/contactTitle';

export function useContactDirectory() {
  const { data: customers = [] } = useCustomersList();
  const { data: orders = [] } = useOrdersList();
  const directory = useMemo(
    () => contactNamesByPhone(customers, orders),
    [customers, orders],
  );
  return useMemo(
    () => ({
      directory,
      titleFor: (raw: string) => resolveContactTitle(raw, directory),
    }),
    [directory],
  );
}
