import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { reviseStripeInvoice, createStripeInvoice } from '../api/stripe.api';
import { invoicesKeys } from '../hooks/useInvoices';
import { useToast } from '@/shared/hooks/use-toast';
import type { Invoice } from '../types/invoicing.types';

interface ReviseInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onRevised?: (newInvoiceId: string) => void;
}

export const ReviseInvoiceModal: React.FC<ReviseInvoiceModalProps> = ({
  open,
  onOpenChange,
  invoice,
  onRevised,
}) => {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRevise = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setLoading(true);
    try {
      const data = await reviseStripeInvoice(invoice.id);
      await createStripeInvoice(data.new_invoice_id);
      await queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      await queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(invoice.id) });
      await queryClient.invalidateQueries({ queryKey: invoicesKeys.detail(data.new_invoice_id) });
      toast({
        title: 'Invoice revised',
        description: `New invoice ${data.new_invoice_number} created. Previous invoice voided.`,
      });
      onOpenChange(false);
      onRevised?.(data.new_invoice_id);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not revise invoice',
        description: e instanceof Error ? e.message : 'Something went wrong.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revise invoice</AlertDialogTitle>
          <AlertDialogDescription>
            This will void the current Stripe invoice (if open) and create a new invoice{' '}
            <strong>{invoice.invoice_number}</strong> with the same orders. Payments already made
            remain on the previous invoice. The new invoice will be created and a Stripe hosted
            link will be available. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRevise} disabled={loading}>
            {loading ? 'Revising…' : 'Revise invoice'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
