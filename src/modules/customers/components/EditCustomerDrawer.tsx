import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  useOnDrawerReset,
} from "@/shared/components/ui/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/hooks/use-toast";
import { customerFormSchema, type CustomerFormData } from "../schemas/customer.schema";
import { toCustomerUpdate } from "../utils/customerTransform";
import { useUpdateCustomer, type Customer } from "../hooks/useCustomers";
import { useLinkedContactsByCustomer, useUnlinkContact } from "@/modules/customers";
import { X, Loader2 } from "lucide-react";

interface EditCustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

const channelBadgeClass: Record<'email' | 'sms' | 'whatsapp', string> = {
  email: 'bg-muted text-muted-foreground',
  sms: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
};

function LinkedContactsSection({ customerId }: { customerId: string }) {
  const { contacts, isLoading } = useLinkedContactsByCustomer(customerId);
  const unlinkMutation = useUnlinkContact();
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [unlinkError, setUnlinkError] = React.useState<string | null>(null);
  const [errorConversationId, setErrorConversationId] = React.useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Linked Contacts</p>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No linked contacts. Link addresses from the Inbox.
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {contacts.map((contact) => {
            const rowKey = `${contact.channel}:${contact.value.toLowerCase()}`;
            const rowPending =
              unlinkMutation.isPending &&
              unlinkMutation.variables?.customerId === customerId &&
              unlinkMutation.variables?.channel === contact.channel &&
              unlinkMutation.variables?.value?.trim().toLowerCase() === contact.value.trim().toLowerCase();
            const isConfirming = confirmingId === rowKey;
            const rowError =
              errorConversationId === rowKey ? unlinkError : null;

            return (
              <div key={rowKey} className="space-y-1">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <Badge variant="secondary" className={channelBadgeClass[contact.channel]}>
                    {contact.channel === 'sms'
                      ? 'SMS'
                      : contact.channel === 'whatsapp'
                        ? 'WhatsApp'
                        : 'Email'}
                  </Badge>
                  <span className="truncate flex-1 min-w-0">{contact.value}</span>
                  {!isConfirming && !rowPending && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-destructive hover:text-destructive"
                      aria-label={`Unlink ${contact.value}`}
                      onClick={() => {
                        setConfirmingId(rowKey);
                        setUnlinkError(null);
                        setErrorConversationId(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {rowPending && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </div>
                {isConfirming && (
                  <div className="pl-0 sm:pl-1 text-sm text-muted-foreground flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                    <span>
                      Unlink <span className="font-medium text-foreground">{contact.value}</span>?
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={rowPending}
                        onClick={() => {
                          setUnlinkError(null);
                          setErrorConversationId(null);
                          unlinkMutation.mutate(
                            { customerId, channel: contact.channel, value: contact.value },
                            {
                              onSuccess: () => {
                                setConfirmingId(null);
                              },
                              onError: (err: unknown) => {
                                setUnlinkError(
                                  err instanceof Error ? err.message : 'Failed to unlink contact.',
                                );
                                setErrorConversationId(rowKey);
                              },
                            },
                          );
                        }}
                      >
                        Confirm
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={rowPending}
                        onClick={() => {
                          setConfirmingId(null);
                          setUnlinkError(null);
                          setErrorConversationId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {rowError && (
                  <p className="text-xs text-destructive pl-0 sm:pl-1">{rowError}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const EditCustomerDrawer: React.FC<EditCustomerDrawerProps> = ({
  open,
  onOpenChange,
  customer,
}) => {
  const { mutate: updateCustomer, isPending } = useUpdateCustomer();
  const { toast } = useToast();

  const defaultValues = useMemo<CustomerFormData | null>(() => {
    if (!customer) return null;
    return {
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      city: customer.city ?? "",
      country: customer.country ?? "",
    };
  }, [customer]);

  const emptyDefaults: CustomerFormData = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
  };
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultValues ?? emptyDefaults,
    values: defaultValues ?? emptyDefaults,
  });

  // Clear draft only when drawer closes and we have person data
  useOnDrawerReset(() => {
    if (customer) form.reset(defaultValues ?? undefined);
  });

  const onSubmit = (values: CustomerFormData) => {
    if (!customer) return;
    const payload = toCustomerUpdate(values);
    updateCustomer(
      { id: customer.id, updates: payload },
      {
        onSuccess: () => {
          toast({
            title: "Person updated",
            description: "Person details have been saved.",
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description =
            error instanceof Error ? error.message : "Failed to update person.";
          toast({
            title: "Error updating person",
            description,
            variant: "destructive",
          });
        },
      }
    );
  };

  const showForm = !!customer && !!defaultValues;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Edit Person</DrawerTitle>
          <DrawerDescription>
            {showForm ? "Update person details." : "Person not available."}
          </DrawerDescription>
        </DrawerHeader>

        {!showForm ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {!customer
                ? "This person could not be loaded. You may not have access, or the record may have been removed."
                : "Unable to load person details."}
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
        <div className="flex min-h-0 flex-1 flex-col">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <LinkedContactsSection customerId={customer.id} />
            </div>
            <div className="shrink-0 border-t bg-background p-4">
              <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
        </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};

