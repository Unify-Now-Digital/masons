import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomerInsert = Omit<Customer, "id" | "created_at" | "updated_at">;
export type CustomerUpdate = Partial<CustomerInsert>;

export const customersKeys = {
  all: ["customers"] as const,
  detail: (id: string) => ["customers", id] as const,
};

async function fetchCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("last_name", { ascending: true });

  if (error) throw error;
  return data as Customer[];
}

async function fetchCustomer(id: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Customer;
}

async function createCustomer(payload: CustomerInsert) {
  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as Customer;
}

async function updateCustomer(id: string, updates: CustomerUpdate) {
  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Customer;
}

async function deleteCustomer(id: string) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

export function useCustomersList() {
  return useQuery({
    queryKey: customersKeys.all,
    queryFn: fetchCustomers,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customersKeys.detail(id),
    queryFn: () => fetchCustomer(id),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerInsert) => createCustomer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CustomerUpdate }) =>
      updateCustomer(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all });
      queryClient.setQueryData(customersKeys.detail(data.id), data);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all });
    },
  });
}

