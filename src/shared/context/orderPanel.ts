import { createContext, useContext } from 'react';

export const OrderPanelContext = createContext<{ openOrder: (id: string) => void }>({ openOrder: () => {} });
export const useOpenOrder = () => useContext(OrderPanelContext).openOrder;
