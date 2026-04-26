import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Loader2, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/shared/lib/supabase';
import { useToast } from '@/shared/hooks/use-toast';
import {
  useProofByOrder,
  useApproveProof,
  useRequestProofChanges,
} from '../hooks/useProofs';
import {
  canSendProof,
  canApproveProof,
  canRequestChanges,
  canRegenerateProof,
} from '../utils/proofState';
import { ProofGenerateForm } from './ProofGenerateForm';
import { ProofApprovalBadge } from './ProofApprovalBadge';
import { ProofSendModal } from './ProofSendModal';
import type { OrderProof } from '../types/proofs.types';

interface ProofPanelProps {
  orderId: string;
  initialInscriptionText?: string | null;
  initialStonePhotoUrl?: string | null;
  initialFontStyle?: string | null;
  customerId?: string | null;
}

/** Fetch a signed URL for a proof render from Supabase Storage (client-side). */
function useProofSignedUrl(storagePath: string | null) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from('proof-renders')
      .createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          console.error('ProofPanel: failed to get signed URL', error);
          return;
        }
        setSignedUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [storagePath]);

  return signedUrl;
}

// ── Sub-screens ──────────────────────────────────────────────────────────────

function GeneratingScreen() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Generating proof… this may take up to 30 seconds.
      </p>
      <Skeleton className="w-full h-48 rounded" />
    </div>
  );
}

function ProofImage({ signedUrl }: { signedUrl: string | null }) {
  if (!signedUrl) {
    return <Skeleton className="w-full h-48 rounded mb-3" />;
  }
  return (
    <img
      src={signedUrl}
      alt="Proof render"
      className="w-full rounded border mb-3 max-h-64 object-contain bg-gardens-page"
    />
  );
}

function DraftScreen({
  proof,
  signedUrl,
  customerId,
  onRegenerate,
}: {
  proof: OrderProof;
  signedUrl: string | null;
  customerId?: string | null;
  onRegenerate: () => void;
}) {
  const [sendOpen, setSendOpen] = useState(false);

  return (
    <div className="space-y-3">
      <ProofImage signedUrl={signedUrl} />
      <p className="text-xs text-muted-foreground">
        Review the proof above before sending to the customer.
      </p>
      <Button
        className="w-full"
        onClick={() => setSendOpen(true)}
        disabled={!canSendProof(proof)}
      >
        Send to Customer
      </Button>
      <ProofSendModal
        open={sendOpen}
        onOpenChange={setSendOpen}
        proof={proof}
        renderUrl={signedUrl}
        customerId={customerId ?? ''}
        onSuccess={() => setSendOpen(false)}
      />
      <Button variant="outline" size="sm" className="w-full" onClick={onRegenerate}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Regenerate
      </Button>
    </div>
  );
}

function SentScreen({
  proof,
  signedUrl,
  onApprove,
  onRequestChanges,
  isApproving,
}: {
  proof: OrderProof;
  signedUrl: string | null;
  onApprove: () => void;
  onRequestChanges: () => void;
  isApproving: boolean;
}) {
  const [changesNote, setChangesNote] = useState('');
  const [showChangesInput, setShowChangesInput] = useState(false);
  const requestChangesMutation = useRequestProofChanges();

  const handleRequestChanges = () => {
    if (!changesNote.trim()) return;
    requestChangesMutation.mutate(
      { proofId: proof.id, changesNote: changesNote.trim() },
      { onSuccess: () => { setShowChangesInput(false); setChangesNote(''); onRequestChanges(); } },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ProofApprovalBadge proof={proof} size="md" />
        {proof.sent_at && (
          <span className="text-xs text-muted-foreground">
            Sent {formatDistanceToNow(new Date(proof.sent_at), { addSuffix: true })}
          </span>
        )}
      </div>
      <ProofImage signedUrl={signedUrl} />
      <Button
        className="w-full"
        onClick={onApprove}
        disabled={isApproving || !canApproveProof(proof)}
      >
        {isApproving ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approving…</>
        ) : (
          <><CheckCircle2 className="h-4 w-4 mr-2" />Mark as Approved</>
        )}
      </Button>
      {!showChangesInput ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowChangesInput(true)}
          disabled={!canRequestChanges(proof)}
        >
          Request Changes
        </Button>
      ) : (
        <div className="space-y-2">
          <textarea
            className="w-full rounded border p-2 text-sm resize-none min-h-[60px] focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Describe the changes needed…"
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
          />
          {requestChangesMutation.isError && (
            <p className="text-xs text-destructive">
              {requestChangesMutation.error instanceof Error
                ? requestChangesMutation.error.message
                : 'Failed to record changes.'}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowChangesInput(false); setChangesNote(''); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRequestChanges}
              disabled={!changesNote.trim() || requestChangesMutation.isPending}
            >
              {requestChangesMutation.isPending ? 'Saving…' : 'Submit'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovedScreen({ proof, signedUrl }: { proof: OrderProof; signedUrl: string | null }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ProofApprovalBadge proof={proof} size="md" />
        {proof.approved_at && (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(proof.approved_at), { addSuffix: true })}
          </span>
        )}
      </div>
      <ProofImage signedUrl={signedUrl} />
      <div className="flex items-center gap-2 rounded-md bg-gardens-grn-lt border border-gardens-grn-lt px-3 py-2 text-sm text-gardens-grn-dk">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Job can now be started for this order.</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Approved by:{' '}
        {proof.approved_by === 'staff_manual' ? 'Staff (manual)' : proof.approved_by ?? 'Unknown'}
      </p>
    </div>
  );
}

function ChangesRequestedScreen({
  proof,
  signedUrl,
  onRegenerate,
}: {
  proof: OrderProof;
  signedUrl: string | null;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-3">
      <ProofApprovalBadge proof={proof} size="md" />
      {proof.changes_note && (
        <div className="rounded-md bg-gardens-amb-lt border border-gardens-amb-lt px-3 py-2 text-sm text-gardens-amb-dk">
          <span className="font-medium">Changes requested: </span>{proof.changes_note}
        </div>
      )}
      {proof.render_url && <ProofImage signedUrl={signedUrl} />}
      <Button className="w-full" onClick={onRegenerate} disabled={!canRegenerateProof(proof)}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Regenerate Proof
      </Button>
    </div>
  );
}

function FailedScreen({
  proof,
  onRetry,
}: {
  proof: OrderProof;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md bg-gardens-red-lt border border-gardens-red-lt px-3 py-2 text-sm text-gardens-red-dk">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Proof generation failed</p>
          {proof.last_error && (
            <p className="text-xs mt-0.5 opacity-80 line-clamp-3">{proof.last_error}</p>
          )}
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}

// ── Main ProofPanel ───────────────────────────────────────────────────────────

export const ProofPanel: React.FC<ProofPanelProps> = ({
  orderId,
  initialInscriptionText,
  initialStonePhotoUrl,
  initialFontStyle,
  customerId,
}) => {
  const { toast } = useToast();
  const approveMutation = useApproveProof();

  // Poll at 3 s while generating
  const { data: proof, refetch } = useProofByOrder(orderId);

  // Trigger faster polling when state is generating
  useEffect(() => {
    if (proof?.state !== 'generating') return;
    const interval = setInterval(() => refetch(), 3000);
    return () => clearInterval(interval);
  }, [proof?.state, refetch]);

  const signedUrl = useProofSignedUrl(proof?.render_url ?? null);

  // Regenerate = show generate form (tracks locally)
  const [showGenerateForm, setShowGenerateForm] = useState(false);

  const handleApprove = () => {
    if (!proof) return;
    approveMutation.mutate(proof.id, {
      onSuccess: () => toast({ title: 'Proof approved. Job can now be started.' }),
      onError: (err) =>
        toast({
          title: 'Could not approve proof',
          description: err instanceof Error ? err.message : 'Please refresh and try again.',
          variant: 'destructive',
        }),
    });
  };

  // ── Render by state ───────────────────────────────────────────────────────

  // Null / not_started → show generate form
  if (!proof || proof.state === 'not_started' || showGenerateForm) {
    return (
      <ProofGenerateForm
        orderId={orderId}
        initialInscriptionText={initialInscriptionText}
        initialStonePhotoUrl={initialStonePhotoUrl}
        initialFontStyle={initialFontStyle}
        isChangesRequested={
          showGenerateForm && proof?.state === 'changes_requested'
        }
        changesNote={
          showGenerateForm && proof?.state === 'changes_requested'
            ? proof.changes_note
            : null
        }
        onSuccess={() => setShowGenerateForm(false)}
      />
    );
  }

  if (proof.state === 'generating') {
    return <GeneratingScreen />;
  }

  if (proof.state === 'draft') {
    return (
      <DraftScreen
        proof={proof}
        signedUrl={signedUrl}
        customerId={customerId}
        onRegenerate={() => setShowGenerateForm(true)}
      />
    );
  }

  if (proof.state === 'sent') {
    return (
      <SentScreen
        proof={proof}
        signedUrl={signedUrl}
        onApprove={handleApprove}
        onRequestChanges={() => {}}
        isApproving={approveMutation.isPending}
      />
    );
  }

  if (proof.state === 'approved') {
    return <ApprovedScreen proof={proof} signedUrl={signedUrl} />;
  }

  if (proof.state === 'changes_requested') {
    return (
      <ChangesRequestedScreen
        proof={proof}
        signedUrl={signedUrl}
        onRegenerate={() => setShowGenerateForm(true)}
      />
    );
  }

  if (proof.state === 'failed') {
    return <FailedScreen proof={proof} onRetry={() => setShowGenerateForm(true)} />;
  }

  // Fallback
  return (
    <ProofGenerateForm
      orderId={orderId}
      initialInscriptionText={initialInscriptionText}
      initialStonePhotoUrl={initialStonePhotoUrl}
      initialFontStyle={initialFontStyle}
    />
  );
};
