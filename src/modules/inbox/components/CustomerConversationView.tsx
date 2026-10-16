import { suggestLeadSource } from '@/shared/lib/leadSource';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { useConversationsList } from '@/modules/inbox/hooks/useInboxConversations';
import {
  buildConversationIdByChannelFromMessages,
  useCustomerMessages,
  useUnlinkedGroupTimeline,
  useUnlinkedHandleTimeline,
} from '@/modules/inbox/hooks/useInboxMessages';
import { ConversationHeader, ThreadChromeBar, type ConversationHeaderAction, type ThreadHeaderChrome } from './ConversationHeader';
import { ConversationSummaryBanner } from './ConversationSummaryBanner';
import { ConversationThread } from './ConversationThread';
import { useThreadSummary } from '@/modules/inbox/hooks/useThreadSummary';
import { useContactDirectory } from '@/modules/inbox/hooks/useContactDirectory';
import { LinkConversationModal } from './LinkConversationModal';
import { AddToCustomersDialog } from './AddToCustomersDialog';
import { useNavigate } from 'react-router-dom';
import { ConversationNextStepBar } from './ConversationNextStepBar';
import { conversationStatusLine, newJobConfirmCopy } from '@/shared/lib/orderPanel';
import { rowPrimary, inboxRowAction, type InboxOrderLike } from '@/modules/inbox/utils/inboxRowAction';
import { isOrderOpen } from '@/modules/inbox/utils/inboxBuckets';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { useMutedSenders } from '@/modules/inbox/hooks/useMutedSenders';
import { normalizeHandle } from '@/modules/inbox/utils/conversationGroupKey';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { formatStageLabel, useAddToPipeline, useConversationsJobs, useJobsByPersonId } from '@/modules/jobsPipeline';
import { useOrdersByPersonId } from '@/modules/orders/hooks/useOrders';
import { JobPicker } from './JobPicker';
import { buildOrdersByJobId, effectiveJobId } from '@/modules/inbox/utils/jobPickerLabels';
import type { CustomersSelection, InboxMessage } from '@/modules/inbox/types/inbox.types';

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  web: 'GHL',
};

interface CustomerConversationViewProps {
  customersSelection: CustomersSelection | null;
  /** Shell v2: the selected row's reply-clock aging, so the header pill matches the Inbox card. */
  rowAging?: Parameters<typeof inboxRowAction>[0];
  /** Name shown on the selected list card; header fallback while the person loads. */
  fallbackName?: string | null;
  /**
   * Conversation ids of the selected UNLINKED group (from useCustomerThreads'
   * grouping). When provided, the timeline fetches by conversation_id IN (ids)
   * so cross-channel merged groups show every member thread — the handle+channel
   * fetch only surfaces the most-recent thread's subset. Optional: without it,
   * behaviour falls back to the handle+channel timeline. Ignored for linked
   * selections (person timeline already spans all channels via person_id).
   */
  unlinkedGroupConversationIds?: string[];
  /** All conversation ids of the selected group (linked or unlinked) — pipeline job probe. */
  groupConversationIds?: string[];
  /** Most-recent conversation of the group — target for Add to pipeline / New job. */
  groupLatestConversationId?: string;
  /** Multi-job picker (FR-1/FR-2): null = default selection rule applies. */
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onLinkedToPerson?: (personId: string) => void;
  onRequestNewConversation?: (args: { channel: 'email' | 'whatsapp'; personId: string }) => void;
  /** Phone: Back, Order, and a one-row header. Absent on the desktop split. */
  headerChrome?: ThreadHeaderChrome | null;
  /** Phone: the priority bar, collapsed, sitting under the compact header. */
  prioritySlot?: React.ReactNode;
}

export const CustomerConversationView: React.FC<CustomerConversationViewProps> = ({
  customersSelection,
  rowAging,
  fallbackName,
  unlinkedGroupConversationIds,
  groupConversationIds,
  groupLatestConversationId,
  selectedJobId,
  onSelectJob,
  onLinkedToPerson,
  onRequestNewConversation,
  headerChrome = null,
  prioritySlot = null,
}) => {
  const { titleFor } = useContactDirectory();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [addToCustomersOpen, setAddToCustomersOpen] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<InboxMessage[]>([]);

  const selectionChannelKey =
    customersSelection == null
      ? null
      : customersSelection.type === 'linked'
        ? customersSelection.personId
        : customersSelection.type === 'unlinked'
          ? `${customersSelection.channel}:${customersSelection.handle}`
          : null;

  useEffect(() => {
    setDisplayMessages([]);
  }, [selectionChannelKey]);

  const linkedPersonId =
    customersSelection?.type === 'linked' ? customersSelection.personId : null;
  const unlinkedTarget =
    customersSelection?.type === 'unlinked'
      ? { channel: customersSelection.channel, handle: customersSelection.handle }
      : null;

  // Web stubs have no ingested messages to summarize — fall through to the
  // disabled personId:null variant so no fetch fires (and no error banner shows).
  const threadSummaryParams =
    linkedPersonId != null
      ? ({ scope: 'customer_timeline' as const, personId: linkedPersonId } as const)
      : unlinkedTarget != null && unlinkedTarget.channel !== 'web'
        ? ({
            scope: 'unlinked_timeline' as const,
            channel: unlinkedTarget.channel,
            handle: unlinkedTarget.handle,
          } as const)
        : ({ scope: 'customer_timeline' as const, personId: null } as const);

  const threadSummary = useThreadSummary(threadSummaryParams);

  const { data: person } = useCustomer(linkedPersonId ?? '');
  const { organizationId } = useOrganization();
  const { mutedHandles, mute, unmute } = useMutedSenders(organizationId);
  // Same normalization the muted set stores (see useMutedSenders) — safe to
  // re-normalize here because unlinkedTarget.handle is raw, not a group key.
  const selectedIsMuted =
    unlinkedTarget != null && mutedHandles.has(normalizeHandle(unlinkedTarget.handle));

  // Pipeline: probe all the group's conversations for jobs. The button never
  // disappears once resolved — no jobs → "Add to pipeline", jobs → "New job"
  // (repeat customers can have several memorials). The hint chip shows the most
  // recent ACTIVE job's stage as a duplicate-prevention nudge.
  // Linked persons probe by person_id — the group's conversationIds come from the
  // (possibly search-filtered) list row and can miss the job-bearing conversation.
  // Unlinked selections keep the conversation-keyed probe (no personId exists).
  const personJobs = useJobsByPersonId(linkedPersonId);
  const conversationJobs = useConversationsJobs(linkedPersonId ? undefined : groupConversationIds);
  const groupJobs = linkedPersonId ? personJobs : conversationJobs;
  const addToPipeline = useAddToPipeline();
  const groupJobsResolved = groupJobs.data !== undefined;
  const hasJobs = (groupJobs.data?.length ?? 0) > 0;
  const latestActiveJob = groupJobs.data?.find((j) => !j.exit_reason) ?? null;
  // Multi-job picker (FR-1): shown at 2+ jobs; 0-1 jobs keep the static hint
  // chip (D2 — pixel parity, incl. no chip for a lone exited job). Labels come
  // from the person's orders (cache-shared with the sidebar).
  const { data: personOrders = [] } = useOrdersByPersonId(linkedPersonId);
  const ordersByJobId = useMemo(() => buildOrdersByJobId(personOrders), [personOrders]);
  const pickerJobs = groupJobs.data ?? [];
  const pickerSelectedJobId = effectiveJobId(pickerJobs, selectedJobId);
  const { data: conversations = [] } = useConversationsList(
    linkedPersonId ? { status: 'open', person_id: linkedPersonId } : undefined,
    { enabled: !!linkedPersonId && linkModalOpen }
  );

  const { data: unlinkedConversations = [] } = useConversationsList(
    unlinkedTarget
      ? {
          status: 'open',
          unlinked_only: true,
          channel: unlinkedTarget.channel,
          primary_handle_exact: unlinkedTarget.handle,
        }
      : undefined,
    { enabled: !!unlinkedTarget && (linkModalOpen || addToCustomersOpen) }
  );

  // Group ids for the selected unlinked row (cross-channel). Null when linked,
  // no selection, or the caller didn't supply them (fallback path below).
  const unlinkedGroupIds =
    customersSelection?.type === 'unlinked' && (unlinkedGroupConversationIds?.length ?? 0) > 0
      ? unlinkedGroupConversationIds!
      : null;

  const bulkConversationIds = linkedPersonId
    ? conversations.map((c) => c.id)
    : unlinkedGroupIds ?? unlinkedConversations.map((c) => c.id);
  const representativeConversationId = bulkConversationIds[0] ?? '';
  const representativeConversation =
    linkedPersonId ? conversations[0] : unlinkedConversations[0];
  const canLink = bulkConversationIds.length > 0;

  const personMessages = useCustomerMessages(linkedPersonId);
  const unlinkedGroupMessages = useUnlinkedGroupTimeline(unlinkedGroupIds);
  // Fallback timeline (handle+channel) — disabled whenever the group-id fetch is active.
  const unlinkedMessages = useUnlinkedHandleTimeline(
    unlinkedGroupIds ? null : unlinkedTarget?.channel ?? null,
    unlinkedGroupIds ? null : unlinkedTarget?.handle ?? null
  );

  const activeUnlinkedMessages = unlinkedGroupIds ? unlinkedGroupMessages : unlinkedMessages;
  const messages = linkedPersonId ? personMessages.messages : activeUnlinkedMessages.messages;
  const isLoading = linkedPersonId ? personMessages.isLoading : activeUnlinkedMessages.isLoading;
  const isError = linkedPersonId ? personMessages.isError : activeUnlinkedMessages.isError;
  const retryMessages = linkedPersonId ? personMessages.refetch : activeUnlinkedMessages.refetch;
  // Slow-load cue: after 12s still loading, offer a retry (requests also time out at 20s).
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    setSlowLoad(false);
    if (!isLoading) return;
    const t = setTimeout(() => setSlowLoad(true), 12_000);
    return () => clearTimeout(t);
  }, [isLoading, linkedPersonId, unlinkedTarget?.handle]);

  useEffect(() => {
    if (isLoading) return;
    setDisplayMessages(messages);
  }, [messages, isLoading]);

  const personDisplay = person
    ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.email || person.phone || '—'
    : fallbackName?.trim() || '—';

  const enabledReplyChannels =
    customersSelection?.type === 'unlinked'
      ? // 'web' is read-only in V1 — no reply pills, composer stays disabled.
        customersSelection.channel === 'web'
        ? []
        : [customersSelection.channel]
      : customersSelection?.type === 'linked' && person
        ? [
            ...(person.email?.trim() ? (['email'] as const) : []),
            ...(person.phone?.trim() ? (['sms', 'whatsapp'] as const) : []),
          ]
        : undefined;

  const headerTitle = titleFor(linkedPersonId ? personDisplay : (unlinkedTarget?.handle ?? '—'));
  const handleLine = linkedPersonId
    ? 'all channels'
    : unlinkedTarget
      ? CHANNEL_LABEL[unlinkedTarget.channel] ?? unlinkedTarget.channel
      : '—';
  const linkStateLabel = linkedPersonId ? 'Linked' : unlinkedTarget ? 'Unlinked' : '';

  // Actions menu (C7), reading order: the primary link action, then Link
  // person, then Hide/Unmute. Each entry is pushed under exactly the condition
  // that gated its button, so no condition is lost in the collapse. At one
  // entry — the linked case, and the commonest one — the header renders a plain
  // button rather than a menu.
  const headerActions: ConversationHeaderAction[] = [
    {
      id: 'link',
      label: linkedPersonId ? 'Change link…' : 'Add to Customers',
      hint: linkedPersonId
        ? [`Linked to ${personDisplay}`, ...personOrders.slice(0, 2).map(getOrderDisplayId)].join(' · ')
        : null,
      onSelect: () => {
        if (!linkedPersonId) {
          setAddToCustomersOpen(true);
          return;
        }
        setLinkModalOpen(true);
      },
    },
  ];
  if (!linkedPersonId) {
    headerActions.push({
      id: 'link-person',
      label: 'Link person',
      onSelect: () => setLinkModalOpen(true),
    });
  }
  if (unlinkedTarget) {
    headerActions.push({
      id: 'mute',
      label: selectedIsMuted ? 'Unmute sender' : 'Hide sender',
      // Distinct per state. This is the old tertiaryActionTitle, now travelling
      // with the item instead of being passed unconditionally for a button that
      // only sometimes rendered.
      title: selectedIsMuted
        ? 'Restore this sender from the Hidden filter'
        : 'Move this sender to the Hidden filter (reversible via Unmute)',
      onSelect: () =>
        selectedIsMuted
          ? unmute.mutate(unlinkedTarget.handle)
          : mute.mutate(unlinkedTarget.handle),
    });
  }

  const summaryBannerBusy =
    threadSummary.isFetching && !!threadSummary.summary?.trim();

  // inbox-v11 header status + next-step bar (presentation over existing data).
  const navigate = useNavigate();
  const threadPaneRef = useRef<HTMLDivElement | null>(null);
  const openPersonOrders = personOrders.filter(isOrderOpen);
  const activeJobOrders = latestActiveJob ? personOrders.filter((o) => o.job_id === latestActiveJob.id) : [];
  const statusLine = conversationStatusLine({
    linked: !!linkedPersonId,
    jobStage: latestActiveJob?.stage ?? null,
    hasInvoice: activeJobOrders.some((o) => !!o.invoice_id),
    depositPaid: !!latestActiveJob?.paid_at || activeJobOrders.some((o) => !!o.deposit_date),
  });
  const rowAction = inboxRowAction(rowAging ?? null, openPersonOrders as unknown as InboxOrderLike[]);
  // Deposit / balance open the deciding order's invoice Collect payment, pre-filled.
  const primaryDef = rowPrimary(rowAction);
  const primary = primaryDef
    ? {
        label: primaryDef.label,
        onClick: () => {
          if (primaryDef.target === 'composer') {
            threadPaneRef.current?.querySelector('textarea')?.focus();
            return;
          }
          navigate(primaryDef.target);
        },
      }
    : null;
  const openJobs = (groupJobs.data ?? []).filter((j) => !j.exit_reason);
  const firstName = (person?.first_name ?? '').trim() || headerTitle.split(' ')[0] || '';
  const pipelineConfirm = hasJobs
    ? newJobConfirmCopy(
        firstName,
        openJobs.map((j) => {
          const o = ordersByJobId.get(j.id);
          return {
            orderRef: o ? getOrderDisplayId(o) : null,
            description: [o?.custom_product_name || o?.quote_product_name, formatStageLabel(j.stage).toLowerCase()]
              .filter(Boolean)
              .join(', ') || null,
          };
        }),
      )
    : null;
  const menuExtras: ConversationHeaderAction[] = [];
  if (latestActiveJob) {
    menuExtras.push({
      id: 'open-pipeline',
      label: 'Open in Pipeline',
      hint: `Stage: ${formatStageLabel(latestActiveJob.stage)}`,
      separatorBefore: true,
      onSelect: () => navigate('/dashboard/inquiries'),
    });
  }

  const showSummarySlot =
    summaryBannerBusy ||
    threadSummary.error != null ||
    !!(threadSummary.summary && threadSummary.summary.trim());

  const { conversationIdByChannel, defaultChannel } = useMemo(() => {
    const map = buildConversationIdByChannelFromMessages(displayMessages);
    const latestInbound = displayMessages
      .slice()
      .reverse()
      .find((m) => m.direction === 'inbound')?.channel ?? null;
    const firstEnabled = (['email', 'sms', 'whatsapp'] as const).find((channel) => !!map[channel]) ?? 'email';
    return {
      conversationIdByChannel: map,
      defaultChannel: latestInbound ?? firstEnabled,
    };
  }, [displayMessages]);

  const autoScrollResetKey =
    linkedPersonId ?? (unlinkedTarget ? `unlinked:${unlinkedTarget.channel}:${unlinkedTarget.handle}` : '');

  if (!customersSelection) {
    return (
      <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
        {headerChrome && <ThreadChromeBar leading={headerChrome.leading} orderSlot={headerChrome.orderSlot} />}
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <p className="text-sm text-gardens-txs">Select a customer thread to view messages</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
        {headerChrome && <ThreadChromeBar leading={headerChrome.leading} orderSlot={headerChrome.orderSlot} title={fallbackName ? titleFor(fallbackName) : undefined} />}
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm text-gardens-txs">Couldn't load messages{fallbackName ? ` for ${fallbackName}` : ''}.</p>
          <button type="button" onClick={retryMessages} className="rounded-lg border border-gardens-bdr bg-white px-3 py-1 text-xs font-semibold text-gardens-tx hover:bg-gardens-page">
            Try again
          </button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
      <div className="shrink-0">
        <LinkConversationModal
          open={linkModalOpen && canLink}
          onOpenChange={setLinkModalOpen}
          conversationId={representativeConversationId}
          conversationIds={bulkConversationIds}
          conversationPersonId={linkedPersonId}
          candidates={representativeConversation?.link_meta?.candidates}
          onLinked={(personId) => onLinkedToPerson?.(personId)}
          onUnlinked={() => {
            // Keep selection behaviour consistent with existing Customers-tab effects.
            setLinkModalOpen(false);
          }}
          onCreateNew={
            unlinkedTarget
              ? () => {
                  setLinkModalOpen(false);
                  setAddToCustomersOpen(true);
                }
              : undefined
          }
        />
        {unlinkedTarget && (
          <AddToCustomersDialog
            open={addToCustomersOpen && canLink}
            onOpenChange={setAddToCustomersOpen}
            prefill={
              unlinkedTarget.channel === 'email'
                ? { email: unlinkedTarget.handle.toLowerCase().trim() }
                : { phone: unlinkedTarget.handle }
            }
            conversationIds={bulkConversationIds}
            onCompleted={(personId) => onLinkedToPerson?.(personId)}
          />
        )}
        <ConversationHeader
          compact={headerChrome != null}
          leading={headerChrome?.leading}
          orderSlot={headerChrome?.orderSlot}
          displayName={headerTitle}
          handleLine={handleLine}
          statusLine={statusLine}
          linkStateLabel={linkStateLabel}
          linkStateTone={linkedPersonId ? 'linked' : 'neutral'}
          pipelineHintLabel={
            latestActiveJob ? `In pipeline: ${formatStageLabel(latestActiveJob.stage)}` : undefined
          }
          pipelineHintSlot={
            pickerJobs.length >= 2 && pickerSelectedJobId ? (
              <JobPicker
                jobs={pickerJobs}
                ordersByJobId={ordersByJobId}
                selectedJobId={pickerSelectedJobId}
                onSelectJob={onSelectJob}
              />
            ) : undefined
          }
          pipelineActionButtonLabel={
            groupJobsResolved && groupLatestConversationId
              ? addToPipeline.isPending
                ? 'Adding…'
                : hasJobs
                  ? 'New job'
                  : 'Add to pipeline'
              : undefined
          }
          onPipelineActionClick={(leadSource) => {
            if (addToPipeline.isPending || !groupLatestConversationId) return;
            addToPipeline.mutate(
              {
                conversationId: groupLatestConversationId,
                allowAdditional: hasJobs,
                leadSource: leadSource || null,
              },
              // FR-6: land on the job just created (hook-level invalidation +
              // toast still fire alongside this per-call callback).
              { onSuccess: (result) => onSelectJob(result.jobId) },
            );
          }}
          defaultLeadSource={suggestLeadSource(unlinkedTarget?.channel ?? null)}
          actions={headerActions}
          pipelineConfirm={pipelineConfirm}
          menuExtras={menuExtras}
          summarySlot={
            threadSummary.error != null ? (
              <ConversationSummaryBanner summary={null} isLoading={false} error={threadSummary.error} onRetry={threadSummary.refetch} />
            ) : undefined
          }
        />
        {prioritySlot}
        {showSummarySlot || rowAction.action.kind !== 'none' ? (
          <ConversationNextStepBar
            action={rowAction.action}
            summary={threadSummary.summary}
            summaryLoading={summaryBannerBusy || threadSummary.isFetching}
            primary={primary}
            overdue={rowAction.timer?.tone === 'over'}
            collapseSummary={headerChrome != null}
          />
        ) : null}
      </div>

      <div ref={threadPaneRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading && displayMessages.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-sm text-gardens-txs">Loading messages…</p>
              {slowLoad && (
                <button type="button" onClick={retryMessages} className="rounded-lg border border-gardens-bdr bg-white px-3 py-1 text-xs font-semibold text-gardens-tx hover:bg-gardens-page">
                  Taking a while · Retry
                </button>
              )}
            </div>
          </div>
        ) : (
          <ConversationThread
            messages={displayMessages}
            readOnly={false}
            conversationIdByChannel={conversationIdByChannel}
            defaultChannel={defaultChannel}
            participantName={headerTitle}
            scrollContainerRef={scrollContainerRef}
            conditionalAutoScroll
            autoScrollResetKey={autoScrollResetKey}
            sendChannelOnlyMode
            linkedInboxPersonId={linkedPersonId}
            showEmailSubjectInHeader
            enabledReplyChannels={enabledReplyChannels}
            prefillSuggestedReply={rowAction.action.kind === 'follow'}
            startConversationContext={
              linkedPersonId && person
                ? {
                    personId: linkedPersonId,
                    email: person.email ?? null,
                    phone: person.phone ?? null,
                  }
                : null
            }
            onRequestStartConversation={
              linkedPersonId && person && onRequestNewConversation
                ? (ch) => {
                    const ok =
                      ch === 'email' ? !!person.email?.trim() : !!person.phone?.trim();
                    if (!ok) return;
                    onRequestNewConversation({ channel: ch, personId: linkedPersonId });
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
};
