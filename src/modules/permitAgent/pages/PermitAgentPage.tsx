import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Bot, RefreshCw, Plus } from 'lucide-react';
import { usePermitPipeline, useUpdateOrderPermit, useCreateActivity, useInitializePermits } from '../hooks/usePermitAgent';
import { PipelineView } from '../components/PipelineView';
import { PermitDetailPanel } from '../components/PermitDetailPanel';
import { SearchTerminal } from '../components/SearchTerminal';
import { SubmitPermitDialog } from '../components/SubmitPermitDialog';
import type { PermitPipelineItem, PermitPhase, SearchResult } from '../types/permitAgent.types';

export const PermitAgentPage: React.FC = () => {
  const { data: pipeline, isLoading, error, refetch } = usePermitPipeline();
  const updatePermit = useUpdateOrderPermit();
  const createActivity = useCreateActivity();
  const initializePermits = useInitializePermits();

  const [selectedItem, setSelectedItem] = useState<PermitPipelineItem | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const items = pipeline || [];

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

  const handleSubmitPermit = async (emailData: { to: string; subject: string; body: string }) => {
    if (!selectedItem) return;

    const readinessBoost = Math.min(selectedItem.permit.readiness_score + 25, 100);

    await updatePermit.mutateAsync({
      id: selectedItem.permit.id,
      payload: {
        permit_phase: 'SUBMITTED' as PermitPhase,
        readiness_score: readinessBoost,
        submission_date: new Date().toISOString().split('T')[0],
      },
    });

    await createActivity.mutateAsync({
      order_permit_id: selectedItem.permit.id,
      activity_type: 'SUBMITTED',
      description: `Permit application submitted to ${emailData.to}`,
      metadata: { subject: emailData.subject },
    });

    setSubmitDialogOpen(false);
    refetch();
  };

  const handleAdvancePhase = async (phase: string) => {
    if (!selectedItem) return;

    const readiness = phase === 'APPROVED' ? 100 : selectedItem.permit.readiness_score;

    await updatePermit.mutateAsync({
      id: selectedItem.permit.id,
      payload: {
        permit_phase: phase as PermitPhase,
        readiness_score: readiness,
      },
    });

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
                onAdvancePhase={handleAdvancePhase}
              />
            )}
          </div>
        )}
      </div>

      {/* Submit dialog */}
      <SubmitPermitDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        item={selectedItem}
        onSubmit={handleSubmitPermit}
        isSubmitting={updatePermit.isPending}
      />
    </div>
  );
};
