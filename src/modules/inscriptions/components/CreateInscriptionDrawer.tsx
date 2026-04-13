import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer, DrawerContent } from '@/shared/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { useCreateInscription } from '../hooks/useInscriptions';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';
import { inscriptionFormSchema, type InscriptionFormData } from '../schemas/inscription.schema';
import { toInscriptionInsert } from '../utils/inscriptionTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { getOrderDisplayIdShort } from '@/modules/orders/utils/orderDisplayId';

interface CreateInscriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateInscriptionDrawer: React.FC<CreateInscriptionDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createInscription, isPending } = useCreateInscription();
  const { toast } = useToast();
  const { data: ordersData } = useOrdersList();

  const form = useForm<InscriptionFormData>({
    resolver: zodResolver(inscriptionFormSchema),
    defaultValues: {
      orderId: null,
      inscriptionText: '',
      type: 'front',
      style: '',
      color: null,
      proofUrl: '',
      status: 'pending',
      engravedBy: '',
      engravedDate: null,
      notes: '',
    },
  });

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      form.reset({
        orderId: null,
        inscriptionText: '',
        type: 'front',
        style: '',
        color: null,
        proofUrl: '',
        status: 'pending',
        engravedBy: '',
        engravedDate: null,
        notes: '',
      });
    }
  }, [open, form]);

  const onSubmit = (values: InscriptionFormData) => {
    const payload = toInscriptionInsert(values);
    createInscription(payload, {
      onSuccess: () => {
        toast({
          title: 'Inscription created',
          description: 'Inscription has been created successfully.',
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        let errorMessage = 'Failed to create inscription.';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String(error.message);
        }
        console.error('Error creating inscription:', error);
        toast({
          title: 'Error creating inscription',
          description: errorMessage,
          variant: 'destructive',
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
              title="Create Inscription"
              description="Add a new inscription record."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Creating...' : 'Create'}
              primaryDisabled={isPending}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
              <DrawerSection>
                <DrawerGrid cols={2}>
                  <FormField
                    control={form.control}
                    name="orderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Linked Order (optional)</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                          value={field.value || 'none'}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select an order (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {Array.isArray(ordersData) && ordersData.length > 0
                              ? ordersData.map((order) => (
                                  <SelectItem key={order.id} value={order.id}>
                                    {order.customer_name || getOrderDisplayIdShort(order)}
                                  </SelectItem>
                                ))
                              : (
                                <div className="p-2 text-sm text-muted-foreground">No orders found</div>
                              )}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="front">Front</SelectItem>
                            <SelectItem value="back">Back</SelectItem>
                            <SelectItem value="side">Side</SelectItem>
                            <SelectItem value="plaque">Plaque</SelectItem>
                            <SelectItem value="additional">Additional</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="inscriptionText"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs font-medium">Inscription Text *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter inscription text..."
                            className="resize-none min-h-[80px]"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="style"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Style</FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="e.g., Times New Roman, Script" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Color</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                          value={field.value ?? '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select color" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            <SelectItem value="gold">Gold</SelectItem>
                            <SelectItem value="silver">Silver</SelectItem>
                            <SelectItem value="white">White</SelectItem>
                            <SelectItem value="black">Black</SelectItem>
                            <SelectItem value="natural">Natural</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="proofing">Proofing</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="engraving">Engraving</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="installed">Installed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="engravedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Engraved By</FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="Enter engraver name" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="engravedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Engraved Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'h-9 w-full pl-3 text-left font-normal text-xs',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (() => {
                                  try {
                                    const date = new Date(field.value);
                                    if (isNaN(date.getTime())) return <span>Invalid date</span>;
                                    return format(date, 'PPP');
                                  } catch {
                                    return <span>Invalid date</span>;
                                  }
                                })() : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? (() => {
                                try {
                                  const date = new Date(field.value);
                                  return isNaN(date.getTime()) ? undefined : date;
                                } catch {
                                  return undefined;
                                }
                              })() : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : null)}
                              disabled={(date) => date < new Date('1900-01-01')}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs font-medium">Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any additional notes..."
                            className="min-h-[60px] resize-none"
                            rows={2}
                            {...field}
                          />
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

