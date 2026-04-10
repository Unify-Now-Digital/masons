import React, { useState, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Bot, RefreshCw, Plus, Clock, Mail, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePermitPipeline, useUpdateOrderPermit, useCreateActivity, useInitializePermits } from '../hooks/usePermitAgent';
import { updatePermitWithOrderSync } from '../api/permitAgent.api';
import { PipelineView } from '../components/PipelineView';
import { PermitDetailPanel } from '../components/PermitDetailPanel';
import { SearchTerminal } from '../components/SearchTerminal';
import { SubmitPermitDialog } from '../components/SubmitPermitDialog';
import { SendToClientDialog } from '../components/SendToClientDialog';
import { FollowUpDialog } from '../components/FollowUpDialog';
import type { PermitPipelineItem, PermitPhase, SearchResult } from '../types/permitAgent.types';
import { sendGmailNewEmail } from '@/modules/inbox/api/inboxGmail.api';
import { useToast } from '@/shared/hooks/use-toast';

export const PermitAgentPage: React.FC = () => {
  const { data: pipeline, isLoading, error, refetch } = usePermitPipeline();
  const updatePermit = useUpdateOrderPermit();
  const createActivity = useCreateActivity();
  const initializePermits = useInitializePermits();
  const { toast } = useToast();

  const [selectedItem, setSelectedItem] = useState<PermitPipelineItem | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [sendToClientOpen, setSendToClientOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const items = useMemo(() => pipeline || [], [pipeline]);

  // Summary stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = {
      pending: 0,
      awaiting_client: 0,
      awaiting_authority: 0,
      approved: 0,
      urgent: 0,
    };
    for (const item of items) {
      const phase = item.permit.permit_phase;
      if (phase === 'APPROVED') counts.approved++;
      else if (phase === 'SENT_TO_CLIENT') counts.awaiting_client++;
      else if (phase === 'SUBMITTED') counts.awaiting_authority++;
      else counts.pending++;
      if (item.isUrgent) counts.urgent++;
    }
    return counts;
  }, [items]);

  const handleSelectItem = (item: PermitPipelineItem) => {
    setSelectedItem(item);
    setShowSearch(false);
  };

  const handleSearchForm = () => {
    setShowSearch(true);
  };

  const handleFormFound = async (result: SearchResult) => {
    if (!selectedItem) return;

    const readinessBoost = Math.min(selectedItem.permit.readiness_score + 30, 100);

    await updatePermit.mutateAsync({
      id: selectedItem.permit.id,
      payload: {
        permit_phase: 'FORM_FOUND' as PermitPhase,
        form_url: result.links[0]?.url || null,
        authority_name: result.authorityName,
        authority_contact: result.authorityContact,
        readiness_score: readinessBoost,
      },
    });

    await createActivity.mutateAsync({
      order_permit_id: selectedItem.permit.id,
      activity_type: 'FORM_FOUND',
      description: `AI discovered permit form: ${result.links[0]?.title || 'Unknown form'}`,
      metadata: { links: result.links, authority: result.authorityName },
    });

    refetch();
  };

  const handlePrefill = async () => {
    if (!selectedItem) return;

    const readinessBoost = Math.min(selectedItem.permit.readiness_score + 20, 100);

    await updatePermit.mutateAsync({
      id: selectedItem.permit.id,
      payload: {
        permit_phase: 'PREFILLED' as PermitPhase,
        readiness_score: readinessBoost,
        prefilled_data: {
          authority_recipient: selectedItem.permit.authority_name || '',
          deceased_full_name: selectedItem.order.customer_name,
          memorial_dimensions: 'As per order specification',
          material_type: selectedItem.order.material || 'TBD',
          inscription_summary: 'As per approved proof',
          grave_location: selectedItem.order.location || 'TBD',
        },
      },
    });

    await createActivity.mutateAsync({
      order_permit_id: selectedItem.permit.id,
      activity_type: 'PREFILLED',
      description: `AI pre-filled permit application with order data for ${selectedItem.order.customer_name}`,
      metadata: null,
    });

    refetch();
  };

  const handleSendToClient = async (emailData: { to: string; subject: string; body: string }) => {
    if (!selectedItem) return;

    let emailSent = false;
    try {
      await sendGmailNewEmail({
        to: emailData.to,
        subject: emailData.subject,
        bodyText: emailData.body,
      });
      emailSent = true;
    } catch (err) {
      console.error('Failed to send email to client', err);
      toast({
        title: 'Email failed to send',
        description: err instanceof Error ? err.message : 'Could not send via Gmail. Status updated locally.',
        variant: 'destructive',
      });
    }

    const readinessBoost = Math.min(selectedItem.permit.readiness_score + 15, 100);

    await updatePermitWithOrderSync(
      selectedItem.permit.id,
      {
        permit_phase: 'SENT_TO_CLIENT' as PermitPhase,
        readiness_score: readinessBoost,
      },
      selectedItem.order.id,
    );

    await createActivity.mutateAsync({
      order_permit_id: selectedItem.permit.id,
      activity_type: 'SENT_TO_CLIENT',
      description: emailSent
        ? `Permit form sent to client at ${emailData.to} for signature`
        : `Phase set to Sent to Client (email to ${emailData.to} failed — send manually)`,
      metadata: {
        to: emailData.to,
        subject: emailData.subject,
        email_sent: emailSent,
      },
    });

    setSendToClientOpen(false);

    if (emailSent) {
      toast({
        title: 'Sent to client',
        description: `Permit form emailed to ${emailData.to}. Awaiting signed form return.`,
      });
    }

    refetch();
  };

  const handleClientReturned = async () => {
    if (!selectedItem) return;

    const readinessBoost = Math.min(selectedItem.permit.readiness_score + 10, 100);

    await updatePermitWithOrderSync(
      selectedItem.permit.id,
      { readiness_score: readinessBoost },
      selectedItem.order.id,
    );

    await createActivity.mutateAsync({
      order_permit_id: selectedItem.permit.id,
      activity_type: 'CLIENT_RETURNED',
      description: `Client returned signed permit form for ${selectedItem.order.customer_name}`,
      metadata: null,
    });

    toast({
      title: 'Form received',
      description: 'Client returned the signed form. You can now submit to the authority.',
    });

    refetch();
  };

  const handleFollowUp = async (emailData: { to: string; subject: string; body: string }) => {
    if (!selectedItem) return;

    let emailSent = false;
    try {
      await sendGmailNewEmail({
        to: emailData.to,
        subject: emailData.subject,
        bodyText: emailData.body,
      });
      emailSent = true;
    } catch (err) {
      console.error('Failed to send follow-up email', err);
      toast({
        title: 'Follow-up email failed',
        description: err instanceof Error ? err.message : 'Could not send via Gmail.',
        variant: 'destructive',
      });
    }

    await createActivity.mutateAsync({
      order_permit_id: selectedItem.permit.id,
      activity_type: 'FOLLOW_UP_SENT',
      description: emailSent
        ? `Follow-up sent to ${emailData.to}`
        : `Follow-up to ${emailData.to} failed — send manually`,
      metadata: {
        to: emailData.to,
        subject: emailData.subject,
        email_sent: emailSent,
      },
    });

    setFollowUpOpen(false);

    if (emailSent) {
      toast({
        title: 'Follow-up sent',
        description: `Reminder emailed to ${emailData.to}.`,
      });
    }

    refetch();
  };

  const handleSubmitPermit = async (emailData: { to: string; subject: string; body: string }) => {
    if (!selectedItem) return;

    let conversationId: string | null = null;
    let emailSent = false;
    try {
      const result = await sendGmailNewEmail({
        to: emailData.to,
        subject: emailData.subject,
        bodyText: emailData.body,
      });
      conversationId = result.conversationId;
      emailSent = true;
    } catch (err) {
      console.error('Failed to send permit submission email', err);
      toast({
        title: 'Email failed to send',
        description: err instanceof Error ? err.message : 'Could not send via Gmail. Status updated locally.',
        variant: 'destructive',
      });
    }

    const readinessBoost = Math.min(selectedItem.permit.readiness_score + 25, 100);

    await updatePermitWithOrderSync(
      selectedItem.permit.id,
      {
        permit_phase: 'SUBMITTED' as PermitPhase,
        readiness_score: readinessBoost,
        submission_date: new Date().toISOString().split('T')[0],
      },
      selectedItem.order.id,
    );

    await createActivity.mutateAsync({
      order_permit_id: selectedItem.permit.id,
      activity_type: 'SUBMITTED',
      description: emailSent
        ? `Permit application emailed to ${emailData.to}`
        : `Permit phase set to Submitted (email to ${emailData.to} failed — send manually)`,
      metadata: {
        subject: emailData.subject,
        to: emailData.to,
        email_sent: emailSent,
        ...(conversationId ? { inbox_conversation_id: conversationId } : {}),
      },
    });

    setSubmitDialogOpen(false);

    if (emailSent) {
      toast({
        title: 'Permit application submitted',
        description: `Email sent to ${emailData.to}. Thread tracked in the unified inbox.`,
      });
    }

    refetch();
  };

  const handleAdvancePhase = async (phase: string) => {
    if (!selectedItem) return;

    const readiness = phase === 'APPROVED' ? 100 : selectedItem.permit.readiness_score;

    await updatePermitWithOrderSync(
      selectedItem.permit.id,
      {
        permit_phase: phase as PermitPhase,
        readiness_score: readiness,
      },
      selectedItem.order.id,
    );

    await createActivity.mutateAsync({
      order_permit_id: selectedItem.permit.id,
      activity_type: phase === 'APPROVED' ? 'APPROVED' : 'NOTE',
      description: phase === 'APPROVED'
        ? `Permit approved for ${selectedItem.order.customer_name}`
        : `Phase updated to ${phase}`,
      metadata: null,
    });

    refetch();
  };

  const handleInitialize = async () => {
    await initializePermits.mutateAsync();
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-600" />
            Permit Agent
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            AI-powered permit discovery, pre-filling, and submission tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleInitialize} disabled={initializePermits.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            {initializePermits.isPending ? 'Syncing...' : 'Sync Orders'}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <Clock className="h-4 w-4 text-slate-400" />
              <div>
                <div className="text-lg font-bold">{stats.pending}</div>
                <div className="text-xs text-slate-500">Pending</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <Mail className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-lg font-bold">{stats.awaiting_client}</div>
                <div className="text-xs text-slate-500">Awaiting Client</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <Send className="h-4 w-4 text-orange-500" />
              <div>
                <div className="text-lg font-bold">{stats.awaiting_authority}</div>
                <div className="text-xs text-slate-500">Awaiting Authority</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-lg font-bold">{stats.approved}</div>
                <div className="text-xs text-slate-500">Approved</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <div className="text-lg font-bold">{stats.urgent}</div>
                <div className="text-xs text-slate-500">Urgent</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main layout: pipeline + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline View - takes 2 cols on large screens */}
        <div className={selectedItem ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <PipelineView
            items={items}
            isLoading={isLoading}
            error={error as Error | null}
            onSelectItem={handleSelectItem}
            selectedId={selectedItem?.permit.id}
            onRefetch={() => refetch()}
            onInitialize={handleInitialize}
            isInitializing={initializePermits.isPending}
          />
        </div>

        {/* Detail panel */}
        {selectedItem && (
          <div className="lg:col-span-1">
            {showSearch ? (
              <div className="space-y-4">
                <SearchTerminal onFormFound={handleFormFound} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSearch(false)}
                  className="w-full"
                >
                  Back to Details
                </Button>
              </div>
            ) : (
              <PermitDetailPanel
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onSearchForm={handleSearchForm}
                onPrefill={handlePrefill}
                onSubmit={() => setSubmitDialogOpen(true)}
                onSendToClient={() => setSendToClientOpen(true)}
                onClientReturned={handleClientReturned}
                onFollowUp={() => setFollowUpOpen(true)}
                onAdvancePhase={handleAdvancePhase}
              />
            )}
          </div>
        )}
      </div>

      {/* Submit to authority dialog */}
      <SubmitPermitDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        item={selectedItem}
        onSubmit={handleSubmitPermit}
        isSubmitting={updatePermit.isPending}
      />

      {/* Send to client dialog */}
      <SendToClientDialog
        open={sendToClientOpen}
        onOpenChange={setSendToClientOpen}
        item={selectedItem}
        onSend={handleSendToClient}
        isSending={updatePermit.isPending}
      />

      {/* Follow-up dialog */}
      <FollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        item={selectedItem}
        onSend={handleFollowUp}
        isSending={createActivity.isPending}
      />
    </div>
  );
};
