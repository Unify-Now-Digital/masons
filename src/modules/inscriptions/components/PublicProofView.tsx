import React, { useState } from 'react';
import { CheckCircle2, Send, ShieldCheck, Download, History, Wand2, Edit3 } from 'lucide-react';
import VisualProof from '@/modules/inscriptions/components/VisualProof';
import type { ProofRevision } from '../api/proofRevisions.api';
import type { StoneShape } from '@/shared/types/prototype.types';

export interface PublicProofViewContext {
  customerName?: string | null;
  deceasedName?: string | null;
  material?: string | null;
  finish?: string | null;
  shape?: StoneShape | null;
  masonInitials?: string | null;
  masonName?: string | null;
  orderDisplayId?: string | null;
}

interface PublicProofViewProps {
  revision: ProofRevision;
  context?: PublicProofViewContext;
  onApprove: (name: string) => Promise<void> | void;
  onSubmitFeedback: (feedback: string) => Promise<void> | void;
  isApproving?: boolean;
  isSubmittingFeedback?: boolean;
  onBack?: () => void;
}

const PublicProofView: React.FC<PublicProofViewProps> = ({
  revision,
  context,
  onApprove,
  onSubmitFeedback,
  isApproving = false,
  isSubmittingFeedback = false,
  onBack,
}) => {
  const [comment, setComment] = useState('');
  const [approverName, setApproverName] = useState(context?.customerName ?? '');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const isApproved = revision.status === 'approved';
  const isChangesRequested = revision.status === 'changes_requested' || feedbackSent;

  const shape: StoneShape = (context?.shape ?? (revision.shape as StoneShape)) || 'ogee';
  const materialColor = revision.material_color
    ?? (context?.material?.toLowerCase().includes('black') ? '#1a1a1a' : '#525252');
  const letteringColor = revision.lettering_color ?? '#e2b13c';

  const handleApprove = async () => {
    await onApprove(approverName.trim());
  };

  const handleCommentSubmit = async () => {
    if (!comment.trim()) return;
    await onSubmitFeedback(comment.trim());
    setComment('');
    setFeedbackSent(true);
  };

  if (isApproved) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 mb-8 animate-in zoom-in-95">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">Design Approved</h1>
        <p className="text-slate-500 font-medium text-center max-w-md leading-relaxed mb-8">
          Thank you{revision.approved_by_name ? `, ${revision.approved_by_name}` : context?.customerName ? `, ${context.customerName}` : ''}.
          {context?.deceasedName ? ` Your design for ${context.deceasedName} has been sent to production.` : ' Your design has been sent to production.'}
          {' '}We will notify you as soon as the lettering is complete.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
              <Download className="w-5 h-5" />
            </div>
            <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Download Receipt</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
              <History className="w-5 h-5" />
            </div>
            <p className="text-xs font-black text-slate-900 uppercase tracking-widest">View Timeline</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row">
      {/* Left: Design Canvas */}
      <div className="flex-1 p-4 sm:p-8 flex flex-col items-center justify-center space-y-8">
        <div className="max-w-xl w-full">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Memorial Design Proof</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {context?.orderDisplayId ?? revision.id.slice(0, 8)} • Revision {revision.revision_number}.0
                </p>
              </div>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex justify-center bg-white p-6 sm:p-12 rounded-3xl sm:rounded-[3rem] shadow-2xl border border-slate-100 relative overflow-hidden">
            <VisualProof
              shape={shape}
              lines={revision.lines || []}
              width={280}
              height={360}
              materialColor={materialColor}
              letteringColor={letteringColor}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <InfoBox label="Material" value={context?.material ?? '—'} />
            <InfoBox label="Shape" value={shape.toUpperCase()} />
            <InfoBox label="Finish" value={context?.finish ?? 'Polished Face'} />
          </div>

          {isChangesRequested && (
            <div className="mt-8 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <Edit3 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-black text-amber-900 uppercase tracking-widest mb-1">
                  Changes Requested
                </p>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Your feedback has been sent to your mason. They will revise the design and send a new proof shortly.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions & Feedback */}
      <div className="w-full lg:w-[460px] bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-6 sm:p-8 md:p-12 flex flex-col space-y-8 lg:space-y-10">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Verify Details</span>
          </div>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Please carefully review the inscription for spelling, dates, and layout. This is your final chance to make adjustments before production begins.
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={approverName}
            onChange={(e) => setApproverName(e.target.value)}
            placeholder="Your full name"
            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all"
          />
          <button
            onClick={handleApprove}
            disabled={isApproving || !approverName.trim()}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isApproving ? 'Approving…' : 'Approve Design & Lettering'}
          </button>

          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-100" />
            <span className="relative z-10 px-4 bg-white text-[9px] font-black text-slate-300 uppercase tracking-widest mx-auto block w-fit">
              OR
            </span>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Request Edits</h4>
            <div className="relative">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Suggest layout changes or spellings..."
                className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 transition-all min-h-[160px] focus:bg-white outline-none"
              />
            </div>
            <button
              onClick={handleCommentSubmit}
              disabled={!comment.trim() || isSubmittingFeedback}
              className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-30"
            >
              <Send className="w-4 h-4" /> {isSubmittingFeedback ? 'Sending…' : 'Submit Feedback'}
            </button>
          </div>
        </div>

        {(context?.masonName || context?.masonInitials) && (
          <div className="mt-auto p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs">
              {context.masonInitials ?? context.masonName?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-900 uppercase">Your Mason</p>
              <p className="text-xs text-slate-500 font-medium tracking-tight">
                {context.masonName ?? 'is available to help.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InfoBox = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-[11px] font-black text-slate-900 truncate">{value}</p>
  </div>
);

export default PublicProofView;
