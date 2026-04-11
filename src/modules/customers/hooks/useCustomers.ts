import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useOrganization } from "@/shared/context/OrganizationContext";

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
  list: (organizationId: string) => ["customers", "list", organizationId] as const,
  detail: (id: string, organizationId: string) => ["customers", id, organizationId] as const,
};

async function fetchCustomers(organizationId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId)
    .order("last_name", { ascending: true });

  if (error) throw error;
  return data as Customer[];
}

async function fetchCustomer(id: string, organizationId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (error) throw error;
  return data as Customer;
}

async function createCustomer(payload: CustomerInsert, organizationId: string) {
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...payload, organization_id: organizationId })
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
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? customersKeys.list(organizationId)
      : ["customers", "list", "disabled"],
    queryFn: () => fetchCustomers(organizationId!),
    enabled: !!organizationId,
  });
}

export function useCustomer(id: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      id && organizationId
        ? customersKeys.detail(id, organizationId)
        : ["customers", id, "disabled"],
    queryFn: () => fetchCustomer(id, organizationId!),
    enabled: !!id && !!organizationId,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (payload: CustomerInsert) => {
      if (!organizationId) throw new Error("No organization selected");
      return createCustomer(payload, organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: customersKeys.list(organizationId) });
      }
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CustomerUpdate }) =>
      updateCustomer(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: customersKeys.list(organizationId) });
        queryClient.setQueryData(
          customersKeys.detail(data.id, organizationId),
          data,
        );
      }
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: customersKeys.list(organizationId) });
      }
    },
  });
}
