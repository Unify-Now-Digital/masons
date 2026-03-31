export { CustomersPage } from "./pages/CustomersPage";
export { CreateCustomerDrawer } from "./components/CreateCustomerDrawer";
export { EditCustomerDrawer } from "./components/EditCustomerDrawer";
export { DeleteCustomerDialog } from "./components/DeleteCustomerDialog";
export {
  useCustomersList,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  type Customer,
  type CustomerInsert,
  type CustomerUpdate,
} from "./hooks/useCustomers";

export { useLinkedContactsByCustomer, useUnlinkContact } from './hooks/useLinkedContacts';
export type { LinkedContact } from './hooks/useLinkedContacts';
export { buildEmailOptions, buildPhoneOptions } from './hooks/useLinkedContacts';

