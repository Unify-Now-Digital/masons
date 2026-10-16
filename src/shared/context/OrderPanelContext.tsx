import React, { useCallback, useState } from 'react';
import { OrderDetailsSidebar } from '@/modules/orders/components/OrderDetailsSidebar';
import { useOrder } from '@/modules/orders/hooks/useOrders';
import { SidePanel } from '@/shared/components/panel/SidePanel';
import { OrderPanelContext, type OrderPanelSection } from './orderPanel';

/**
 * Universal side panel rule (Arin, 14 Oct): clicking an order anywhere (Hub, Finance,
 * Pipeline, Search, Map) opens the SAME order panel in place; it never navigates away.
 * One host, mounted once in PageShell.
 */
const Host: React.FC<{
  id: string | null;
  section: OrderPanelSection | null;
  setId: (v: string | null) => void;
}> = ({ id, section, setId }) => {
  const { data, isError, isFetching } = useOrder(id ?? '');
  if (!id) return null;
  if (!data) {
    return (
      <SidePanel mode="overlay" label="Order" testId="order-context-panel" kicker="Order" name={isError ? 'Order unavailable' : 'Loading…'} onClose={() => setId(null)}>
        <p className="m-0 px-6 py-4 text-[13px] text-gardens-txs">
          {isError && !isFetching ? 'This order could not be loaded.' : 'Loading order…'}
        </p>
      </SidePanel>
    );
  }
  return (
    <OrderDetailsSidebar
      order={data ?? null}
      focusSection={section}
      onClose={() => setId(null)}
      onSelectOrder={setId}
    />
  );
};

export const OrderPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [id, setId] = useState<string | null>(null);
  const [section, setSection] = useState<OrderPanelSection | null>(null);
  const openOrder = useCallback((v: string, options?: { section?: OrderPanelSection }) => {
    setSection(options?.section ?? null);
    setId(v);
  }, []);
  return (
    <OrderPanelContext.Provider value={{ openOrder, isOpen: !!id }}>
      {children}
      <Host id={id} section={section} setId={setId} />
    </OrderPanelContext.Provider>
  );
};
