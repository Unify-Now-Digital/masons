
import React, { useState } from 'react';
import { 
  X, Edit2, Phone, Mail, Box, DollarSign, Clock, 
  Type as InscriptionIcon, Hammer, CreditCard, 
  Calendar, MapPin, ChevronRight, Wand2, CheckCircle2,
  ExternalLink, ArrowRight, ImageIcon, Hash, History, Calculator
} from 'lucide-react';
import { Order, MainStatus, StoneStatus, ProofStatus, StoneShape } from '@/shared/types/prototype.types';
import VisualProof from '@/modules/inscriptions/components/VisualProof';
import { DUMMY_PRODUCTS } from '@/shared/lib/prototypeConstants';

interface OrderDetailsSidePanelProps {
  order: Order;
  onClose: () => void;
  isEmbedded?: boolean;
}

const OrderDetailsSidePanel: React.FC<OrderDetailsSidePanelProps> = ({ order, onClose, isEmbedded = false }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'inscription' | 'logistics' | 'finance'>('details');

  const selectedProduct = DUMMY_PRODUCTS.find(p => p.sku === order.sku) || DUMMY_PRODUCTS[0];
  const totalValue = order.baseValue + order.permitCost;
  const balance = totalValue - order.paidAmount;

  const tabs = [
    { id: 'details', label: 'Order', icon: Box },
    { id: 'inscription', label: 'Inscription', icon: InscriptionIcon },
    { id: 'logistics', label: 'Job/Site', icon: Hammer },
    { id: 'finance', label: 'Finance', icon: CreditCard },
  ];

  const billableCount = (text: string) => text.replace(/[^a-zA-Z0-9]/g, "").length;

  const containerClasses = isEmbedded
    ? "w-full bg-white h-full relative flex flex-col"
    : "w-[340px] xl:w-[420px] bg-white border-l h-screen fixed right-0 top-0 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300";

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className={`p-5 xl:p-8 bg-slate-900 text-white relative overflow-hidden shrink-0`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 blur-[60px] rounded-full -mr-10 -mt-10" />
        <div className="relative z-10 flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{order.id}</span>
              <span className="px-2 py-0.5 bg-blue-500 text-[9px] font-black uppercase rounded text-white">{order.mainStatus}</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight leading-tight">{order.customerName}</h2>
            <p className="text-sm text-white/60 font-medium flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {order.cemetery}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 relative z-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-slate-900 shadow-xl' 
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {isEmbedded ? '' : tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 xl:p-8 custom-scrollbar">
        {activeTab === 'details' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <section>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Core Contract</h3>
              <div className="grid grid-cols-2 gap-4">
                <DataField label="SKU / Item" value={order.sku} subValue={order.type} />
                <DataField label="Deceased" value={order.deceasedName} />
                <DataField label="Due In" value={`${order.dueInDays} Days`} highlight={order.dueInDays < 14} />
                <DataField label="Timeline" value={`${order.timelineWeeks} Weeks`} />
              </div>
            </section>
            
            <section>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Contact Profile</h3>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-slate-400 font-black">
                    {order.customerName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{order.customerName}</p>
                    <p className="text-xs text-slate-500 font-medium truncate">{order.customerEmail}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 shadow-sm">
                    <Phone className="w-3.5 h-3.5" /> Call
                  </button>
                  <button className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 shadow-sm">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'inscription' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <section className="flex flex-col items-center">
              {/* Reduced scaling for smaller side peek */}
              <div className="mb-6 scale-[0.8] origin-top">
                <VisualProof 
                  shape={selectedProduct.shape} 
                  lines={order.inscription?.lines || []}
                  width={300}
                  height={380}
                  materialColor={selectedProduct.material.includes('Black') ? '#1a1a1a' : '#525252'}
                />
              </div>
              
              <div className="w-full flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Active Draft</h3>
                  <span className="flex items-center gap-1 text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-tighter">
                    <History className="w-2.5 h-2.5" /> {order.inscription?.versions?.length || 0}
                  </span>
                </div>
                <button className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                  <Edit2 className="w-3 h-3" /> Edit Studio
                </button>
              </div>
              <div className="w-full p-6 bg-slate-900 rounded-3xl text-white shadow-xl shadow-slate-900/10 min-h-[140px] font-medium text-sm leading-relaxed italic border-8 border-slate-800">
                "{order.inscription?.rawText || 'No inscription text provided yet.'}"
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6 w-full">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-3 h-3 text-slate-300" />
                    <p className="text-[10px] font-black text-slate-400 uppercase">Chars</p>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{billableCount(order.inscription?.rawText || "")}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total</p>
                  <p className="text-2xl font-black text-slate-900">{order.inscription?.rawText?.length || 0}</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'logistics' && (
          <div className="space-y-8 animate-in fade-in duration-300">
             <section>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Job Scheduling</h3>
              <div className="space-y-4">
                <StatusRow label="Foundation Fix" value={order.job?.foundationDate || 'Not Scheduled'} icon={<Calendar className="w-4 h-4" />} />
                <StatusRow label="Final Headstone Fix" value={order.job?.fixDate || 'Not Scheduled'} icon={<Hammer className="w-4 h-4" />} />
                <StatusRow label="Cemetery Site" value={order.cemetery} icon={<MapPin className="w-4 h-4" />} subValue={`Grave: ${order.job?.graveNumber || 'TBD'}`} />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* FINANCIAL SUMMARY CARD */}
            <section className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
               <div className="flex items-center gap-2 mb-6">
                 <Calculator className="w-4 h-4 text-blue-400" />
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-white/50">Settlement Status</h3>
               </div>
               <div className="space-y-4">
                 <div className="flex justify-between items-baseline gap-2">
                   <p className="text-xs font-medium text-white/60">Total Contract</p>
                   <p className="text-xl font-black">£{totalValue.toLocaleString()}</p>
                 </div>
                 <div className="flex justify-between items-baseline gap-2">
                   <p className="text-xs font-medium text-green-400/80">Paid to Date</p>
                   <p className="text-xl font-black text-green-400">£{order.paidAmount.toLocaleString()}</p>
                 </div>
                 <div className="pt-4 border-t border-white/10 flex justify-between items-baseline gap-2">
                   <p className="text-xs font-black uppercase tracking-wider text-orange-400">Balance Due</p>
                   <p className="text-2xl font-black text-orange-400">£{balance.toLocaleString()}</p>
                 </div>
               </div>
            </section>

            <section>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Order Ledger</h3>
              <div className="space-y-3">
                <InvoiceItem type="Deposit" amount={order.baseValue * 0.5} status={order.paidAmount >= order.baseValue * 0.5 ? "Paid" : "Pending"} date="Jan 12, 2024" />
                <InvoiceItem type="Permit Fee" amount={order.permitCost} status={order.paidAmount >= (order.baseValue * 0.5 + order.permitCost) ? "Paid" : "Pending"} date="Jan 15, 2024" />
                <InvoiceItem type="Final Balance" amount={order.baseValue * 0.5} status={order.paidAmount >= totalValue ? "Paid" : "Draft"} />
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 xl:p-8 border-t bg-slate-50 flex gap-3">
        <button className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2">
          Update Status <ChevronRight className="w-4 h-4" />
        </button>
        <button className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all">
          <Edit2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

const DataField = ({ label, value, subValue, highlight }: { label: string, value: string, subValue?: string, highlight?: boolean }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
    <p className={`text-sm font-black truncate ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    {subValue && <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">{subValue}</p>}
  </div>
);

const StatusRow = ({ label, value, icon, subValue }: { label: string, value: string, icon: any, subValue?: string }) => (
  <div className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl">
    <div className="text-slate-300 shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
      <p className="text-sm font-black text-slate-900 truncate">{value}</p>
      {subValue && <p className="text-[10px] text-slate-400 font-bold truncate">{subValue}</p>}
    </div>
    <button className="p-2 hover:bg-slate-50 rounded-lg text-blue-600 transition-all shrink-0"><Edit2 className="w-3.5 h-3.5" /></button>
  </div>
);

const InvoiceItem = ({ type, amount, status, date }: { type: string, amount: number, status: string, date?: string }) => (
  <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all gap-2">
    <div className="min-w-0">
      <p className="text-xs font-black text-slate-900 truncate">{type}</p>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5 truncate">{date || 'Unsent'}</p>
    </div>
    <div className="flex items-center gap-4 shrink-0">
      <div className="text-right">
        <p className="text-sm font-black text-slate-900">£{amount.toLocaleString()}</p>
        <span className={`text-[9px] font-black uppercase tracking-widest ${status === 'Paid' ? 'text-green-600' : 'text-orange-500'}`}>{status}</span>
      </div>
      <button className="p-2 bg-slate-50 rounded-xl text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
        <ExternalLink className="w-4 h-4" />
      </button>
    </div>
  </div>
);

export default OrderDetailsSidePanel;
