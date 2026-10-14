import React, { createContext, useCallback, useContext, useState } from 'react';
import { OrderDetailsSidebar } from '@/modules/orders/components/OrderDetailsSidebar';
import { useOrder } from '@/modules/orders/hooks/useOrders';

/**
 * Universal side panel rule (Arin, 14 Oct): clicking an order anywhere (Hub, Finance,
 * Pipeline, Search, Map) opens the SAME order panel in place; it never navigates away.
 * One host, mounted once in PageShell.
 */
const Ctx = createContext<{ openOrder: (id: string) => void }>({ openOrder: () => {} });
export const useOpenOrder = () => useContext(Ctx).openOrder;

const Host: React.FC<{ id: string | null; setId: (v: string | null) => void }> = ({ id, setId }) => {
  const { data } = useOrder(id ?? '');
  return (
    <>
      {id && <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setId(null)} aria-hidden />}
      <OrderDetailsSidebar order={id ? data ?? null : null} onClose={() => setId(null)} onSelectOrder={setId} />
    </>
  );
};

export const OrderPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [id, setId] = useState<string | null>(null);
  const openOrder = useCallback((v: string) => setId(v), []);
  return (
    <Ctx.Provider value={{ openOrder }}>
      {children}
      <Host id={id} setId={setId} />
    </Ctx.Provider>
  );
};
