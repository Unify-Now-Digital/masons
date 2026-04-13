import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  useApproveProofByToken,
  useRevisionByToken,
  useSubmitProofFeedback,
} from '../hooks/useProofRevisions';
import PublicProofView, { type PublicProofViewContext } from '../components/PublicProofView';
import { supabase } from '@/shared/lib/supabase';
import type { StoneShape } from '@/shared/types/prototype.types';
import { useToast } from '@/shared/hooks/use-toast';

interface OrderContext {
  customer_name: string | null;
  order_number: number | null;
  material: string | null;
  sku: string | null;
}

async function fetchOrderContext(orderId: string): Promise<OrderContext | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_name, order_number, material, sku')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return (data as OrderContext | null) ?? null;
}

export const PublicProofPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const { data: revision, isLoading, error } = useRevisionByToken(token);

  const { data: orderContext } = useQuery({
    queryKey: ['public-proof-order-context', revision?.order_id],
    queryFn: () => fetchOrderContext(revision!.order_id as string),
    enabled: !!revision?.order_id,
  });

  const approve = useApproveProofByToken();
  const submitFeedback = useSubmitProofFeedback();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading proof…</p>
      </div>
    );
  }

  if (error || !revision) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <h1 className="text-2xl font-black text-slate-900 mb-3">Proof not found</h1>
        <p className="text-sm font-medium text-slate-500 max-w-md">
          This proof link is invalid or has expired. Please contact your mason for an updated link.
        </p>
      </div>
    );
  }

  const context: PublicProofViewContext = {
    customerName: orderContext?.customer_name ?? null,
    material: orderContext?.material ?? null,
    shape: (revision.shape as StoneShape) ?? null,
    orderDisplayId: orderContext?.order_number ? `#${orderContext.order_number}` : null,
  };

  const handleApprove = async (name: string) => {
    if (!token) return;
    try {
      await approve.mutateAsync({ token, name });
      toast({ title: 'Design approved', description: 'Thank you — your mason has been notified.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to approve proof.';
      toast({ title: 'Approval failed', description: msg, variant: 'destructive' });
    }
  };

  const handleSubmitFeedback = async (feedback: string) => {
    if (!token) return;
    try {
      await submitFeedback.mutateAsync({ token, feedback });
      toast({ title: 'Feedback sent', description: 'Your mason has been notified.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to submit feedback.';
      toast({ title: 'Submission failed', description: msg, variant: 'destructive' });
    }
  };

  return (
    <PublicProofView
      revision={revision}
      context={context}
      onApprove={handleApprove}
      onSubmitFeedback={handleSubmitFeedback}
      isApproving={approve.isPending}
      isSubmittingFeedback={submitFeedback.isPending}
    />
  );
};

export default PublicProofPage;
