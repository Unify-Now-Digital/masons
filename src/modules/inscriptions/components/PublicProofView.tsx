
import React, { useState } from 'react';
import { CheckCircle2, MessageSquare, Send, ArrowLeft, History, Wand2, ShieldCheck, Download, Edit3 } from 'lucide-react';
import { Order, StoneShape } from '@/shared/types/prototype.types';
import VisualProof from '@/modules/inscriptions/components/VisualProof';
import { DUMMY_PRODUCTS } from '@/shared/lib/prototypeConstants';

interface PublicProofViewProps {
  order: Order;
  onBack?: () => void;
}

const PublicProofView: React.FC<PublicProofViewProps> = ({ order, onBack }) => {
  const [comment, setComment] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [activeMode, setActiveMode] = useState<'view' | 'edit'>('view');
  
  const product = DUMMY_PRODUCTS.find(p => p.sku === order.sku) || DUMMY_PRODUCTS[0];

  const handleApprove = () => {
    setIsApproved(true);
    // In a real app, this would send an API request
  };

  const handleCommentSubmit = () => {
    if (!comment.trim()) return;
    setComment('');
    alert("Your feedback has been sent to our master mason. We will notify you when a new revision is available.");
  };

  if (isApproved) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-gardens-grn rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 mb-8 animate-in zoom-in-95">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-black text-gardens-tx tracking-tighter mb-4">Design Approved</h1>
        <p className="text-gardens-txs font-medium text-center max-w-md leading-relaxed mb-8">
          Thank you, {order.customerName}. Your design for {order.deceasedName} has been sent to production. We will notify you as soon as the lettering is complete.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
           <div className="p-4 bg-gardens-page rounded-2xl border border-gardens-bdr flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gardens-blu shadow-sm"><Download className="w-5 h-5" /></div>
              <p className="text-xs font-black text-gardens-tx uppercase tracking-widest">Download Receipt</p>
           </div>
           <div className="p-4 bg-gardens-page rounded-2xl border border-gardens-bdr flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gardens-blu shadow-sm"><History className="w-5 h-5" /></div>
              <p className="text-xs font-black text-gardens-tx uppercase tracking-widest">View Timeline</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gardens-page flex flex-col lg:flex-row">
      {/* Left: Design Canvas */}
      <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-8">
        <div className="max-w-xl w-full">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gardens-sidebar rounded-xl flex items-center justify-center text-white"><Wand2 className="w-5 h-5" /></div>
              <div>
                 <h2 className="text-xl font-black text-gardens-tx tracking-tight">Memorial Design Proof</h2>
                 <p className="text-[10px] font-black text-gardens-txs uppercase tracking-widest">{order.id} • Revision 1.0</p>
              </div>
            </div>
            {onBack && (
               <button onClick={onBack} className="text-xs font-black text-gardens-txs hover:text-gardens-tx uppercase tracking-widest">Mason Dashboard</button>
            )}
          </div>

          <div className="flex justify-center bg-white p-12 rounded-[3rem] shadow-2xl border border-gardens-bdr relative overflow-hidden group">
            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => setActiveMode(activeMode === 'view' ? 'edit' : 'view')} className="bg-gardens-sidebar text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 {activeMode === 'view' ? <Edit3 className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                 {activeMode === 'view' ? 'Request Changes' : 'Viewing Proof'}
               </button>
            </div>
            <VisualProof 
              shape={product.shape} 
              lines={order.inscription?.lines || []}
              width={320}
              height={400}
              materialColor={product.material.includes('Black') ? '#1a1a1a' : '#525252'}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <InfoBox label="Material" value={product.material} />
            <InfoBox label="Shape" value={product.shape.toUpperCase()} />
            <InfoBox label="Finish" value="Polished Face" />
          </div>
        </div>
      </div>

      {/* Right: Actions & Feedback */}
      <div className="w-full lg:w-[460px] bg-white border-l border-gardens-bdr p-8 md:p-12 flex flex-col space-y-10">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-gardens-blu" />
            <span className="text-[11px] font-black text-gardens-tx uppercase tracking-widest">Verify Details</span>
          </div>
          <p className="text-sm font-medium text-gardens-txs leading-relaxed">
            Please carefully review the inscription for spelling, dates, and layout. This is your final chance to make adjustments before production begins.
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleApprove}
            className="w-full bg-gardens-sidebar text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 hover:bg-gardens-sidebar transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            Approve Design & Lettering
          </button>
          
          <div className="relative">
             <div className="absolute inset-x-0 top-1/2 h-px bg-gardens-page" />
             <span className="relative z-10 px-4 bg-white text-[9px] font-black text-gardens-txm uppercase tracking-widest mx-auto block w-fit">OR</span>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-gardens-tx uppercase tracking-widest">Request Edits</h4>
            <div className="relative">
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Suggest layout changes or spellings..." 
                className="w-full p-6 bg-gardens-page border border-gardens-bdr rounded-3xl text-sm font-medium focus:ring-4 focus:ring-gardens-blu/10 transition-all min-h-[160px] focus:bg-white outline-none"
              />
            </div>
            <button 
              onClick={handleCommentSubmit}
              disabled={!comment.trim()}
              className="w-full py-4 bg-white border border-gardens-bdr text-gardens-tx rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gardens-page transition-all flex items-center justify-center gap-3 disabled:opacity-30"
            >
              <Send className="w-4 h-4" /> Submit Feedback
            </button>
          </div>
        </div>

        <div className="mt-auto p-6 bg-gardens-page rounded-[2rem] border border-gardens-bdr flex items-center gap-4">
           <div className="w-10 h-10 bg-gardens-sidebar rounded-xl flex items-center justify-center text-white font-black text-xs">AY</div>
           <div>
              <p className="text-[10px] font-black text-gardens-tx uppercase">Your Mason</p>
              <p className="text-xs text-gardens-txs font-medium tracking-tight">Adam is available to help.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const InfoBox = ({ label, value }: { label: string, value: string }) => (
  <div className="bg-gardens-page border border-gardens-bdr p-4 rounded-2xl text-center">
    <p className="text-[9px] font-black text-gardens-txs uppercase tracking-widest mb-1">{label}</p>
    <p className="text-[11px] font-black text-gardens-tx truncate">{value}</p>
  </div>
);

export default PublicProofView;
