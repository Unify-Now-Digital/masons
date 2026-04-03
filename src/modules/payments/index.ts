// Page
export { PaymentsPage } from './pages/PaymentsPage';

// Legacy manual payment components (still available for other modules)
export { CreatePaymentDrawer } from './components/CreatePaymentDrawer';
export { EditPaymentDrawer } from './components/EditPaymentDrawer';
export { DeletePaymentDialog } from './components/DeletePaymentDialog';
export { usePaymentsList, usePayment, useCreatePayment, useUpdatePayment, useDeletePayment } from './hooks/usePayments';
export type { Payment, PaymentInsert, PaymentUpdate } from './hooks/usePayments';
export type { UIPayment } from './utils/paymentTransform';

// Reconciliation types
export type {
  OrderPayment,
  OrderPaymentInsert,
  OrderPaymentUpdate,
  OrderExtra,
  OrderExtraInsert,
  OrderExtraUpdate,
  MatchCandidate,
  ReconciliationStats,
  OutstandingOrder,
  RevolutConnection,
} from './types/reconciliation.types';

// Reconciliation hooks
export { useOrderPaymentsList, useUpdateOrderPayment, orderPaymentsKeys } from './hooks/useOrderPayments';
export { useUnmatchedPayments } from './hooks/useUnmatchedPayments';
export { useMatchedPayments } from './hooks/useMatchedPayments';
export { useMatchPayment, useMarkPassThrough } from './hooks/useMatchPayment';
export { useOutstandingOrders } from './hooks/useOutstandingOrders';
export { useOrderExtrasList, useUpdateOrderExtra, useDismissExtra, useAddExtraToInvoice } from './hooks/useOrderExtras';
export { useReconciliationStats } from './hooks/useReconciliationStats';
export { useRevolutConnection } from './hooks/useRevolutConnection';

// API
export { syncRevolutTransactions, refreshRevolutToken } from './api/revolut.api';
export { detectOrderExtras } from './api/extras.api';
