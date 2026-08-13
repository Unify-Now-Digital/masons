import React from "react";
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
import { useToast } from "@/shared/hooks/use-toast";
import { useCreateCustomer, type Customer } from "@/modules/customers/hooks/useCustomers";
import { toCustomerInsert } from "@/modules/customers/utils/customerTransform";
import {
  quickPersonFormSchema,
  type QuickPersonFormData,
} from "../schemas/quickPerson.schema";

interface QuickCreatePersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}

export const QuickCreatePersonDialog: React.FC<QuickCreatePersonDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const { mutate: createCustomer, isPending } = useCreateCustomer();
  const { toast } = useToast();

  const form = useForm<QuickPersonFormData>({
    resolver: zodResolver(quickPersonFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  const onSubmit = (values: QuickPersonFormData) => {
    const payload = { ...toCustomerInsert({
      ...values,
      address: "",
      city: "",
      country: "",
    }), created_via: "manual" as const };
    createCustomer(payload, {
      onSuccess: (customer) => {
        toast({
          title: "Person created",
          description: "Person has been created successfully.",
        });
        form.reset();
        onCreated(customer);
      },
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
          <DialogTitle>Create New Person</DialogTitle>
          <DialogDescription>
            Add a person to link to this invoice. Email is required for Stripe invoicing.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          {/* No <form> element here — a submit would bubble into the parent invoice form. */}
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
                  <FormLabel className="text-xs font-medium">Email *</FormLabel>
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
            {isPending ? "Creating..." : "Create Person"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
