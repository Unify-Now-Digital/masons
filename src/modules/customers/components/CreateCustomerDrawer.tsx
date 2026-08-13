import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  DrawerContent,
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
import { useToast } from "@/shared/hooks/use-toast";
import { customerFormSchema, type CustomerFormData } from "../schemas/customer.schema";
import { toCustomerInsert } from "../utils/customerTransform";
import { useCreateCustomer } from "../hooks/useCustomers";
import { AppDrawerLayout, DrawerSection, DrawerGrid } from "@/shared/components/drawer";

interface CreateCustomerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateCustomerDrawer: React.FC<CreateCustomerDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createCustomer, isPending } = useCreateCustomer();
  const { toast } = useToast();

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

  // Clear any draft state when the drawer has been closed
  useOnDrawerReset(() => {
    form.reset();
  });

  const onSubmit = (values: CustomerFormData) => {
    const payload = { ...toCustomerInsert(values), created_via: "manual" as const };
    createCustomer(payload, {
      onSuccess: () => {
        toast({
          title: "Person created",
          description: "Person has been created successfully.",
        });
        form.reset();
        onOpenChange(false);
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Create Person"
              description="Add a new person record."
              primaryLabel={isPending ? "Creating..." : "Create Person"}
              primaryDisabled={isPending}
              primaryType="submit"
              secondaryLabel="Cancel"
              onSecondary={() => onOpenChange(false)}
              onClose={() => onOpenChange(false)}
            >
              <DrawerSection>
                <DrawerGrid cols={2}>
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
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="text-xs font-medium">Address</FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="123 Memorial Road" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">City</FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="London" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Country</FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="United Kingdom" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                </DrawerGrid>
              </DrawerSection>
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};
