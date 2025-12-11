import type { Customer } from "../hooks/useCustomers";
import type { CustomerFormData } from "../schemas/customer.schema";

export interface UICustomer {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export function transformCustomerFromDb(customer: Customer): UICustomer {
  const firstName = customer.first_name ?? "";
  const lastName = customer.last_name ?? "";
  return {
    id: customer.id,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    country: customer.country,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}

export function transformCustomersFromDb(customers: Customer[]): UICustomer[] {
  return customers.map(transformCustomerFromDb);
}

export function toCustomerInsert(form: CustomerFormData) {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    email: normalizeOptional(form.email),
    phone: normalizeOptional(form.phone),
    address: normalizeOptional(form.address),
    city: normalizeOptional(form.city),
    country: normalizeOptional(form.country),
  };
}

export function toCustomerUpdate(form: CustomerFormData) {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    email: normalizeOptional(form.email),
    phone: normalizeOptional(form.phone),
    address: normalizeOptional(form.address),
    city: normalizeOptional(form.city),
    country: normalizeOptional(form.country),
  };
}

