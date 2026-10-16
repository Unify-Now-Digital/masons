import { createContext, useContext } from 'react';

/** Section to scroll into view when the order panel opens (IA-8.2). */
export type OrderPanelSection = 'permit' | 'proof' | 'stone' | 'fixing' | 'payments';

export interface OpenOrderOptions {
  section?: OrderPanelSection;
}

export const OrderPanelContext = createContext<{
  openOrder: (id: string, options?: OpenOrderOptions) => void;
  isOpen: boolean;
}>({ openOrder: () => {}, isOpen: false });

export const useOpenOrder = () => useContext(OrderPanelContext).openOrder;
export const useOrderPanelOpen = () => useContext(OrderPanelContext).isOpen;
