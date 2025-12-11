import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
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
import { inscriptionFormSchema, type InscriptionFormData } from '../schemas/inscription.schema';
import { toInscriptionInsert } from '../utils/inscriptionTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';

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
      orderId: '',
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
        orderId: '',
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
      <DrawerContent className="max-h-[96vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Create Inscription</DrawerTitle>
          <DrawerDescription>Add a new inscription record.</DrawerDescription>
        </DrawerHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 px-4 pb-4 overflow-y-auto flex-1">
            {/* Order Selection - REQUIRED */}
            <FormField
              control={form.control}
              name="orderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an order" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(ordersData) && ordersData.length > 0
                        ? ordersData.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              {order.id} - {order.customer_name} - {order.location || 'No location'}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type - REQUIRED */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Inscription Text - REQUIRED */}
            <FormField
              control={form.control}
              name="inscriptionText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inscription Text *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter inscription text..."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Style and Color */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="style"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Style</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Times New Roman, Script" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status - REQUIRED */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Proof URL */}
            <FormField
              control={form.control}
              name="proofUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proof URL</FormLabel>
                  <FormControl>
                    <Input 
                      type="url"
                      placeholder="https://example.com/proof.pdf" 
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Engraved By and Engraved Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="engravedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engraved By</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter engraver name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="engravedDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Engraved Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (() => {
                              try {
                                const date = new Date(field.value);
                                if (isNaN(date.getTime())) {
                                  return <span>Invalid date</span>;
                                }
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>

            <DrawerFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create'}
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

