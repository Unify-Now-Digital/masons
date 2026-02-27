import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
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
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { customerFormSchema, type CustomerFormData } from "../schemas/customer.schema";
import { toCustomerUpdate } from "../utils/customerTransform";
import { useUpdateCustomer, type Customer } from "../hooks/useCustomers";

interface EditCustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
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
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
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
            <DrawerFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DrawerFooter>
          </form>
        </Form>
        )}
      </DrawerContent>
    </Drawer>
  );
};

