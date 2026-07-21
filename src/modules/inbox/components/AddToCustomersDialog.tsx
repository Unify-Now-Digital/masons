import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Users } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import {
  useCreateCustomer,
  useCustomersList,
  type Customer,
} from "@/modules/customers/hooks/useCustomers";
import { toCustomerInsert } from "@/modules/customers/utils/customerTransform";
import {
  customerFormSchema,
  type CustomerFormData,
} from "@/modules/customers/schemas/customer.schema";
import { useLinkConversations } from "@/modules/inbox/hooks/useInboxConversations";

interface AddToCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill from the unlinked group's handle (email lowercased, phone as stored). */
  prefill: { email?: string; phone?: string };
  /** All conversation ids of the group — every one gets linked to the new person. */
  conversationIds: string[];
  onCompleted?: (personId: string) => void;
}

const normalizeEmail = (value?: string | null) => (value ?? "").trim().toLowerCase();
// Mirrors autoLinkConversation's phone matching: compare on the last 10 digits.
const phoneLast10 = (value?: string | null) => (value ?? "").replace(/\D/g, "").slice(-10);

function getPersonDisplayName(c: Customer): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.email || c.phone || "—";
}

export const AddToCustomersDialog: React.FC<AddToCustomersDialogProps> = ({
  open,
  onOpenChange,
  prefill,
  conversationIds,
  onCompleted,
}) => {
  const { toast } = useToast();
  const { data: customers = [] } = useCustomersList();
  const { mutate: createCustomer, isPending: isCreating } = useCreateCustomer();
  const linkBulkMutation = useLinkConversations();
  const [duplicate, setDuplicate] = useState<Customer | null>(null);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      first_name: "",
      last_name: "",
      email: prefill.email ?? "",
      phone: prefill.phone ?? "",
      address: "",
      city: "",
      country: "",
    });
    setDuplicate(null);
    // Re-prefill only when the dialog (re)opens — not on every prefill identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isPending = isCreating || linkBulkMutation.isPending;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
      setDuplicate(null);
    }
    onOpenChange(nextOpen);
  };

  const linkTo = (personId: string) => {
    linkBulkMutation.mutate(
      { conversationIds, personId },
      {
        onSuccess: () => {
          toast({
            title: "Added to Customers",
            description: "Conversations linked to the person.",
          });
          onCompleted?.(personId);
          handleOpenChange(false);
        },
        onError: (error: unknown) => {
          const description =
            error instanceof Error ? error.message : "Failed to link conversations.";
          toast({
            title: "Person saved, but linking failed",
            description: `${description} Use "Link person" to finish linking.`,
            variant: "destructive",
          });
          handleOpenChange(false);
        },
      }
    );
  };

  const findDuplicate = (values: CustomerFormData): Customer | null => {
    const email = normalizeEmail(values.email);
    const phone = phoneLast10(values.phone);
    return (
      customers.find((c) => {
        if (email && normalizeEmail(c.email) === email) return true;
        if (phone && phone.length >= 7 && phoneLast10(c.phone) === phone) return true;
        return false;
      }) ?? null
    );
  };

  const onSubmit = (values: CustomerFormData) => {
    if (!duplicate) {
      const match = findDuplicate(values);
      if (match) {
        setDuplicate(match);
        return;
      }
    }

    createCustomer(toCustomerInsert(values), {
      onSuccess: (customer) => linkTo(customer.id),
      onError: (error: unknown) => {
        const description =
          error instanceof Error ? error.message : "Failed to create person.";
        toast({
          title: "Error creating person",
          description,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Customers</DialogTitle>
          <DialogDescription>
            Create a person and link all of this group's conversations to them.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          {/* No <form> element — mirrors QuickCreatePersonDialog to avoid submit bubbling. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">First Name *</FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="Jane" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Last Name *</FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Email</FormLabel>
                  <FormControl>
                    <Input className="h-9" type="email" placeholder="jane@example.com" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Phone</FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="+44 123 456 7890" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>
        </Form>
        {duplicate && (
          <div className="rounded-md border border-gardens-bdr bg-gardens-page p-3 space-y-2">
            <p className="text-sm text-gardens-tx flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              This person may already exist: {getPersonDisplayName(duplicate)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => linkTo(duplicate.id)}
              disabled={isPending}
            >
              Link to this person instead
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => form.handleSubmit(onSubmit)()}
            disabled={isPending}
          >
            {isPending
              ? "Saving..."
              : duplicate
                ? "Create anyway"
                : "Create & link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
