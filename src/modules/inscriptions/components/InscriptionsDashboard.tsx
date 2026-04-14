import React, { useEffect, useMemo, useState } from 'react';
import {
  PenTool, CheckCircle2, Hash, Globe, RefreshCw, MapPin, Box, Ruler,
  ExternalLink, MessageSquare, ClipboardCopy, Mail,
} from 'lucide-react';
import VisualProof from '@/modules/inscriptions/components/VisualProof';
import {
  useInscriptionsList,
  type Inscription,
} from '../hooks/useInscriptions';
import {
  useCreateRevision,
  useInscriptionsAwaitingEdits,
  useRevisionsByInscription,
  useSendRevision,
  useUpdateRevision,
} from '../hooks/useProofRevisions';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { inscriptionTextToLines, linesToText } from '../utils/inscriptionToLines';
import { getOrderDisplayIdShort } from '@/modules/orders/utils/orderDisplayId';
import { useToast } from '@/shared/hooks/use-toast';
import { getAppUrl } from '@/shared/lib/appUrl';
import type { StoneShape } from '@/shared/types/prototype.types';
import type { ProofLine } from '../api/proofRevisions.api';
import type { Order } from '@/modules/orders/types/orders.types';

function inferShape(order: Order | undefined): StoneShape {
  const sku = order?.sku?.toLowerCase() ?? '';
  if (sku.includes('heart')) return 'heart';
  if (sku.includes('half') || sku.includes('round')) return 'half-round';
  if (sku.includes('kerb')) return 'kerb-set';
  if (sku.includes('square') || sku.includes('rect')) return 'square';
  return 'ogee';
}

function inferMaterialColor(order: Order | undefined): string {
  const m = (order?.material ?? '').toLowerCase();
  if (m.includes('black')) return '#1a1a1a';
  if (m.includes('white')) return '#e5e5e5';
  return '#525252';
}

const InscriptionsDashboard: React.FC = () => {
  const { toast } = useToast();
  const { data: inscriptionsData, isLoading: inscriptionsLoading } = useInscriptionsList();
  const { data: ordersData } = useOrdersList();

  // Only show inscriptions that actually need a proof (pending or in proofing).
  const queueInscriptions = useMemo<Inscription[]>(
    () =>
      (inscriptionsData ?? []).filter(
        (i) => i.status === 'pending' || i.status === 'proofing',
      ),
    [inscriptionsData],
  );

  const ordersById = useMemo(() => {
    const map = new Map<string, Order>();
    (ordersData ?? []).forEach((o) => map.set(o.id, o));
    return map;
  }, [ordersData]);

  const queueIds = useMemo(() => queueInscriptions.map((i) => i.id), [queueInscriptions]);
  const { data: awaitingEditIds } = useInscriptionsAwaitingEdits(queueIds);

  // Surface "needs attention" items at the top of the queue so the mason
  // doesn't miss customer-requested changes.
  const sortedQueue = useMemo(() => {
    if (!awaitingEditIds || awaitingEditIds.size === 0) return queueInscriptions;
    return [...queueInscriptions].sort((a, b) => {
      const aWaiting = awaitingEditIds.has(a.id) ? 0 : 1;
      const bWaiting = awaitingEditIds.has(b.id) ? 0 : 1;
      return aWaiting - bWaiting;
    });
  }, [queueInscriptions, awaitingEditIds]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedInscription = useMemo(
    () => queueInscriptions.find((i) => i.id === selectedId) ?? null,
    [queueInscriptions, selectedId],
  );
  const selectedOrder = selectedInscription?.order_id
    ? ordersById.get(selectedInscription.order_id)
    : undefined;

  const { data: revisions } = useRevisionsByInscription(selectedInscription?.id);
  const latestRevision = revisions?.[0];

  // Local editor state — text lives as plain string; lines are derived.
  const [editorText, setEditorText] = useState('');
  const [draftRevisionId, setDraftRevisionId] = useState<string | null>(null);

  // Reset editor when switching inscriptions / when a revision exists.
  useEffect(() => {
    if (!selectedInscription) {
      setEditorText('');
      setDraftRevisionId(null);
      return;
    }
    if (latestRevision && latestRevision.status === 'draft') {
      setEditorText(linesToText(latestRevision.lines));
      setDraftRevisionId(latestRevision.id);
    } else if (latestRevision) {
      setEditorText(linesToText(latestRevision.lines));
      setDraftRevisionId(null);
    } else {
      setEditorText(selectedInscription.inscription_text || '');
      setDraftRevisionId(null);
    }
  }, [selectedInscription, latestRevision]);

  const previewLines: ProofLine[] = useMemo(() => inscriptionTextToLines(editorText), [editorText]);
  const shape = inferShape(selectedOrder);
  const materialColor = inferMaterialColor(selectedOrder);

  const createRevision = useCreateRevision();
  const updateRevision = useUpdateRevision();
  const sendRevision = useSendRevision();

  const characterCount = editorText.replace(/[^a-zA-Z0-9]/g, '').length;

  // Save changes into a draft revision (creates one if none).
  const handleSaveDraft = async () => {
    if (!selectedInscription) return;
    try {
      if (draftRevisionId) {
        await updateRevision.mutateAsync({
          id: draftRevisionId,
          updates: {
            lines: previewLines,
            material_color: materialColor,
            shape,
          },
        });
        toast({ title: 'Draft saved' });
      } else {
        const rev = await createRevision.mutateAsync({
          inscriptionId: selectedInscription.id,
          orderId: selectedInscription.order_id ?? null,
          lines: previewLines,
          materialColor,
          shape,
        });
        setDraftRevisionId(rev.id);
        toast({ title: 'Draft created', description: `Revision ${rev.revision_number}` });
      }
    } catch (e) {
      toast({
        title: 'Failed to save draft',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Save (if needed) then send to customer.
  const handlePublish = async () => {
    if (!selectedInscription) return;
    try {
      let revisionId = draftRevisionId;
      if (!revisionId) {
        const rev = await createRevision.mutateAsync({
          inscriptionId: selectedInscription.id,
          orderId: selectedInscription.order_id ?? null,
          lines: previewLines,
          materialColor,
          shape,
        });
        revisionId = rev.id;
      } else {
        // Persist any unsaved edits before sending.
        await updateRevision.mutateAsync({
          id: revisionId,
          updates: { lines: previewLines, material_color: materialColor, shape },
        });
      }
      const sent = await sendRevision.mutateAsync(revisionId);
      setDraftRevisionId(null);
      toast({
        title: 'Proof sent to customer',
        description: sent.public_token
          ? 'Share the link below with your customer.'
          : 'Customer can now review and approve the design.',
      });
    } catch (e) {
      toast({
        title: 'Failed to send proof',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const publicLink = latestRevision?.public_token
    ? `${getAppUrl()}/proof/${latestRevision.public_token}`
    : null;

  const handleCopyLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      toast({ title: 'Link copied to clipboard' });
    } catch {
      toast({ title: 'Could not copy link', variant: 'destructive' });
    }
  };

  // Comments = customer_feedback from any revision on this inscription that
  // had changes requested.
  const feedbackHistory = useMemo(
    () => (revisions ?? []).filter((r) => r.customer_feedback),
    [revisions],
  );

  const isPublishing = sendRevision.isPending || createRevision.isPending;

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] min-h-[calc(100vh-12rem)]">
      <div className="p-4 lg:p-6 border-b bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h2 className="text-xl xl:text-2xl font-black text-slate-900 tracking-tighter">Stonecraft Studio</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">
            Draft a proof, send it to the customer, and watch it through to lettering.
          </p>
        </div>
        {selectedInscription && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSaveDraft}
              disabled={createRevision.isPending || updateRevision.isPending || !editorText.trim()}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing || !editorText.trim()}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {isPublishing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4 text-blue-400" />
              )}
              {latestRevision && (latestRevision.status === 'sent' || latestRevision.status === 'changes_requested')
                ? 'Send New Revision'
                : 'Send to Customer'}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative">
        {/* Inscription Queue */}
        <div className="lg:col-span-2 border-r bg-white overflow-y-auto p-4 space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
            Design Queue
          </h3>
          {inscriptionsLoading && (
            <p className="text-[10px] font-medium text-slate-400 px-2">Loading…</p>
          )}
          {!inscriptionsLoading && queueInscriptions.length === 0 && (
            <p className="text-[10px] font-medium text-slate-400 px-2">
              No inscriptions awaiting proofs.
            </p>
          )}
          {sortedQueue.map((insc) => {
            const order = insc.order_id ? ordersById.get(insc.order_id) : undefined;
            const label = order
              ? order.customer_name || getOrderDisplayIdShort(order)
              : 'Unlinked';
            const isActive = selectedId === insc.id;
            const isProofing = insc.status === 'proofing';
            const awaitingEdits = awaitingEditIds?.has(insc.id);
            return (
              <button
                key={insc.id}
                onClick={() => setSelectedId(insc.id)}
                className={`w-full text-left p-4 rounded-2xl transition-all border-2 ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xl'
                    : awaitingEdits
                      ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                      : 'bg-white border-transparent hover:border-slate-100'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[9px] font-black uppercase ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {order ? getOrderDisplayIdShort(order) : insc.id.slice(0, 8)}
                  </span>
                  {isProofing && !awaitingEdits && (
                    <Globe className={`w-3 h-3 ${isActive ? 'text-blue-300' : 'text-blue-400'}`} />
                  )}
                </div>
                <p className="text-xs font-black truncate">{label}</p>
                {awaitingEdits ? (
                  <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isActive ? 'text-amber-300' : 'text-amber-700'}`}>
                    ⚠ Changes Requested
                  </p>
                ) : (
                  <p className={`text-[9px] font-medium uppercase tracking-widest mt-1 ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>
                    {insc.status}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Design Canvas */}
        <div className="lg:col-span-6 overflow-y-auto p-4 xl:p-8 bg-slate-50/50 flex flex-col items-center">
          {selectedInscription ? (
            <div className="w-full max-w-2xl space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                <InfoCard icon={<Box className="w-3 h-3 text-slate-400" />} label="Customer">
                  {selectedOrder?.customer_name ?? '—'}
                </InfoCard>
                <InfoCard icon={<MapPin className="w-3 h-3 text-slate-400" />} label="Location">
                  {selectedOrder?.location ?? '—'}
                </InfoCard>
                <InfoCard icon={<Ruler className="w-3 h-3 text-slate-400" />} label="Material">
                  {selectedOrder?.material ?? '—'}
                </InfoCard>
                <InfoCard icon={<Hash className="w-3 h-3 text-slate-400" />} label="Characters">
                  <span className="text-blue-600">{characterCount}</span>
                </InfoCard>
              </div>

              <div className="flex flex-col items-center">
                <VisualProof
                  id={`vector-proof-${selectedInscription.id}`}
                  shape={shape}
                  lines={previewLines}
                  materialColor={materialColor}
                  width={420}
                  height={520}
                />

                {publicLink && (
                  <div className="w-full mt-6 p-4 bg-white border border-blue-100 rounded-3xl shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Customer Proof Link
                        </p>
                        <p className="text-[11px] font-bold text-blue-600 truncate">{publicLink}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={handleCopyLink}
                        title="Copy link"
                        className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-500 transition-all"
                      >
                        <ClipboardCopy className="w-4 h-4" />
                      </button>
                      <a
                        href={publicLink}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in new tab"
                        className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-500 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        disabled
                        title="Email via Gmail (coming soon)"
                        className="p-2.5 rounded-xl text-slate-300 cursor-not-allowed"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {latestRevision?.status === 'approved' && (
                  <div className="w-full mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-[11px] font-black text-emerald-900 uppercase tracking-widest">
                        Approved by {latestRevision.approved_by_name ?? 'customer'}
                      </p>
                      <p className="text-xs text-emerald-700 font-medium">
                        Order moved to lettering.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 max-w-xs text-center py-20">
              <PenTool className="w-12 h-12 opacity-10 mb-6" />
              <h3 className="text-lg font-black text-slate-400 tracking-tight mb-2">Select an Inscription</h3>
              <p className="text-xs font-medium text-slate-400">
                Choose an inscription from the queue to start drafting a proof.
              </p>
            </div>
          )}
        </div>

        {/* Editor & Comments */}
        <div className="lg:col-span-4 border-l bg-white overflow-y-auto flex flex-col">
          {selectedInscription ? (
            <div className="p-4 xl:p-8 space-y-6 xl:space-y-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Live Editor</h3>
                  {latestRevision && (
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Rev {latestRevision.revision_number} • {latestRevision.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-medium text-slate-400 mb-3">
                  One line per row. Spacing and font size auto-fit the stone shape.
                </p>
                <textarea
                  value={editorText}
                  onChange={(e) => setEditorText(e.target.value)}
                  placeholder="In loving memory of…"
                  className="w-full min-h-[180px] p-6 bg-slate-900 rounded-2xl text-white text-sm font-medium leading-relaxed italic border-4 border-slate-800 shadow-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              <div className="pt-6 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    Customer Feedback
                  </h3>
                </div>

                {feedbackHistory.length > 0 ? (
                  <div className="space-y-4">
                    {feedbackHistory.map((rev) => (
                      <div key={rev.id} className="p-4 rounded-2xl border bg-blue-50 border-blue-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Revision {rev.revision_number} • {new Date(rev.updated_at).toLocaleString()}
                        </p>
                        <p className="text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-line">
                          {rev.customer_feedback}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      No feedback received yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-center text-slate-300 bg-slate-50/10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] leading-loose">
                Select an inscription to begin
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({
  icon, label, children,
}) => (
  <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
    <div className="flex items-center gap-2 mb-1.5">
      {icon}
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
    <p className="text-xs font-black text-slate-900 truncate">{children}</p>
  </div>
);

export default InscriptionsDashboard;
export { InscriptionsDashboard };
