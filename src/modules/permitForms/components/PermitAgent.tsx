
import React, { useState, useMemo } from 'react';
import { 
  FileCheck, Sparkles, Search, Globe, Cloud, 
  ArrowRight, CheckCircle2, AlertCircle, Clock, 
  History, Download, Send, Filter, MoreVertical,
  ChevronRight, Building, ExternalLink, HardHat,
  Database, Link, FileText, Bot, RefreshCw
} from 'lucide-react';
import { DUMMY_ORDERS, DUMMY_PERMIT_FORMS, DUMMY_PRODUCTS } from '@/shared/lib/prototypeConstants';
import { Order, PermitPhase, PermitForm } from '@/shared/types/prototype.types';
import { findPermitFormsAI, prefillPermitDataAI } from '@/shared/lib/geminiService';

const PermitAgent: React.FC = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<PermitPhase | 'all'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<any>(null);
  const [prefilledData, setPrefilledData] = useState<any>(null);

  const ordersNeedingPermits = useMemo(() => {
    return DUMMY_ORDERS.filter(o => 
      activeFilter === 'all' || o.permitStatus?.phase === activeFilter
    ).sort((a, b) => (b.permitStatus?.readinessScore || 0) - (a.permitStatus?.readinessScore || 0));
  }, [activeFilter]);

  const selectedOrder = useMemo(() => 
    DUMMY_ORDERS.find(o => o.id === selectedOrderId), 
    [selectedOrderId]
  );

  const handleAiSearch = async () => {
    if (!selectedOrder) return;
    setIsSearching(true);
    const results = await findPermitFormsAI(selectedOrder.cemetery);
    setAiSearchResults(results);
    setIsSearching(false);
  };

  const handlePrefill = async () => {
    if (!selectedOrder) return;
    const product = DUMMY_PRODUCTS.find(p => p.sku === selectedOrder.sku) || DUMMY_PRODUCTS[0];
    const data = await prefillPermitDataAI(selectedOrder, product);
    setPrefilledData(data);
  };

  return (
    <div className="h-full flex flex-col bg-gardens-page animate-in fade-in duration-500">
      {/* Header */}
      <div className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6 bg-white border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 xl:w-12 xl:h-12 bg-slate-900 rounded-xl xl:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-900/10 shrink-0">
            <FileCheck className="w-5 h-5 xl:w-6 xl:h-6" />
          </div>
          <div>
            <h2 className="text-xl xl:text-2xl font-black text-slate-900 tracking-tighter">Permit Copilot</h2>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-600 tracking-widest bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                 <Bot className="w-3 h-3" /> Autonomous Agent Active
               </span>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• 4 Applications pending council review</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
            {(['all', PermitPhase.SEARCHING, PermitPhase.PREFILLED, PermitPhase.SUBMITTED_TO_COUNCIL] as const).map(f => (
              <button 
                key={f} 
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  activeFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {f === 'all' ? 'All' : f.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Priority Sidebar */}
        <div className="w-72 xl:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0">
           <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urgent Permissions</h3>
              <Filter className="w-3.5 h-3.5 text-slate-300" />
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {ordersNeedingPermits.map(order => (
                <button 
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setAiSearchResults(null);
                    setPrefilledData(null);
                  }}
                  className={`w-full text-left p-4 rounded-2xl transition-all border-2 group ${
                    selectedOrderId === order.id 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xl' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded ${
                      selectedOrderId === order.id ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {order.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                       <span className={`text-[9px] font-black uppercase ${
                         order.permitStatus?.phase === PermitPhase.APPROVED ? 'text-emerald-500' :
                         order.permitStatus?.phase === PermitPhase.SEARCHING ? 'text-blue-400' : 'text-orange-400'
                       }`}>
                         {order.permitStatus?.phase}
                       </span>
                    </div>
                  </div>
                  <p className="text-sm font-black tracking-tight mb-1">{order.customerName}</p>
                  <p className={`text-[10px] font-bold truncate ${selectedOrderId === order.id ? 'text-white/60' : 'text-slate-400'}`}>
                    {order.cemetery}
                  </p>
                  
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500" style={{ width: `${order.permitStatus?.readinessScore}%` }} />
                        </div>
                        <span className="text-[9px] font-black opacity-60">{order.permitStatus?.readinessScore}% Ready</span>
                     </div>
                     <ChevronRight className={`w-4 h-4 transition-transform ${selectedOrderId === order.id ? 'translate-x-1' : 'opacity-0'}`} />
                  </div>
                </button>
              ))}
           </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {selectedOrder ? (
            <div className="flex-1 flex overflow-hidden">
               {/* Main Agent Column */}
               <div className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-10 space-y-6 xl:space-y-10 custom-scrollbar">
                  {/* Readiness Summary */}
                  <div className="bg-white rounded-2xl xl:rounded-[2.5rem] border border-slate-200 p-5 xl:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-6 xl:gap-10">
                     <div className="relative w-24 h-24 shrink-0">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                          <path className="text-slate-100 stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path className="text-blue-600 stroke-current animate-dash" strokeWidth="3" strokeDasharray={`${selectedOrder.permitStatus?.readinessScore}, 100`} strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                           <span className="text-xl font-black text-slate-900 leading-none">{selectedOrder.permitStatus?.readinessScore}%</span>
                        </div>
                     </div>
                     <div className="flex-1">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">Pre-Submission Readiness</h3>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed mb-4">
                          Agent has scanned the dossier. Inscription details are finalized. Missing: Owner Signature on Form 12A.
                        </p>
                        <div className="flex gap-2">
                           <Badge icon={<CheckCircle2 />} label="Inscription Verified" />
                           <Badge icon={<CheckCircle2 />} label="Dimensions Valid" />
                           <Badge icon={<AlertCircle className="text-orange-500" />} label="Needs Signature" />
                        </div>
                     </div>
                  </div>

                  {/* AI Form Discovery */}
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                       <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">AI Discovery: {selectedOrder.cemetery}</h3>
                       {!aiSearchResults && (
                         <button 
                           onClick={handleAiSearch}
                           disabled={isSearching}
                           className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:scale-105 active:scale-95 transition-all"
                         >
                           {/* Added missing RefreshCw component */}
                           {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-blue-400" />}
                           Scan for Authority Forms
                         </button>
                       )}
                    </div>

                    {aiSearchResults ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                         {DUMMY_PERMIT_FORMS.filter(f => f.authorityName.includes('Landican') || f.authorityName.includes('Council')).map(form => (
                           <div key={form.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 hover:border-blue-600/20 transition-all shadow-sm group">
                              <div className="flex justify-between items-start mb-6">
                                 <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
                                    <FileText className="w-6 h-6" />
                                 </div>
                                 <div className="flex gap-2">
                                    <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-slate-900"><Download className="w-4 h-4" /></button>
                                    <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-blue-600"><ExternalLink className="w-4 h-4" /></button>
                                 </div>
                              </div>
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{form.authorityName}</p>
                              <h4 className="text-base font-black text-slate-900 tracking-tight leading-snug mb-4">{form.formName}</h4>
                              <button 
                                onClick={handlePrefill}
                                className="w-full py-3 bg-slate-50 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-900 hover:text-white transition-all"
                              >
                                Match & Prefill with AI
                              </button>
                           </div>
                         ))}
                      </div>
                    ) : (
                      <div className="py-20 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center text-center px-10">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                          <Globe className="w-8 h-8" />
                        </div>
                        <h4 className="text-base font-black text-slate-900 tracking-tight mb-2">No Verified Forms Linked</h4>
                        <p className="text-sm font-medium text-slate-400 max-w-sm">
                          Authorize the agent to search the web for {selectedOrder.cemetery}'s memorial permit requirements.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Prefill Preview */}
                  {prefilledData && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4">
                       <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
                          <div className="flex items-center gap-3">
                             <Sparkles className="w-5 h-5 text-blue-400" />
                             <h4 className="text-sm font-black uppercase tracking-widest">AI Prefill Payload</h4>
                          </div>
                          <span className="text-[10px] font-black text-white/40">JSON VECTOR READY</span>
                       </div>
                       <div className="p-8 grid grid-cols-2 gap-6 bg-slate-50/30">
                          {Object.entries(prefilledData).map(([key, val]: any) => (
                            <div key={key}>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{key.replace('_', ' ')}</p>
                               <div className="p-3 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-900 shadow-sm">{val}</div>
                            </div>
                          ))}
                       </div>
                       <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-3">
                          <button className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">Download PDF</button>
                          <button className="px-8 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                             Send to Customer for Signature <Send className="w-3.5 h-3.5" />
                          </button>
                       </div>
                    </div>
                  )}
               </div>

               {/* Activity Sidebar */}
               <div className="w-64 xl:w-80 border-l border-slate-200 bg-white p-4 xl:p-8 overflow-y-auto custom-scrollbar flex flex-col shrink-0">
                  <div className="flex items-center gap-2 mb-8">
                     <History className="w-4 h-4 text-slate-400" />
                     <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Permit Timeline</h3>
                  </div>
                  <div className="space-y-8 relative">
                    <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-100" />
                    <TimelineStep label="Discovery Started" time="2h ago" active={true} />
                    <TimelineStep label="Form 12A Found" time="1h ago" active={true} />
                    <TimelineStep label="AI Field Mapping" time="Just Now" current={true} />
                    <TimelineStep label="Council Submission" time="Pending" />
                  </div>

                  <div className="mt-auto pt-8 border-t border-slate-100">
                    <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/20 blur-3xl rounded-full" />
                       <h5 className="text-xs font-black uppercase tracking-widest mb-4">Council Contact</h5>
                       <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black">L</div>
                          <div>
                             <p className="text-[11px] font-black">Landican Office</p>
                             <p className="text-[10px] font-medium opacity-50">0151 555 0199</p>
                          </div>
                       </div>
                       <button className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                         Dial via Relay
                       </button>
                    </div>
                  </div>
               </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/20 text-slate-300 p-20 text-center">
               <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-slate-100 mb-8 shadow-inner ring-1 ring-slate-100">
                  <FileCheck className="w-12 h-12" />
               </div>
               <h3 className="text-2xl font-black text-slate-400 tracking-tight mb-2">Permit Intelligence Standby</h3>
               <p className="text-sm font-medium text-slate-400 max-w-sm leading-relaxed">
                 Select an order from the pipeline to launch the AI Permit Agent. It will search for council forms and automate the submission workflow.
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TimelineStep = ({ label, time, active, current }: { label: string, time: string, active?: boolean, current?: boolean }) => (
  <div className="relative pl-10">
    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10 ${
      current ? 'bg-blue-600 animate-pulse' : active ? 'bg-slate-900' : 'bg-slate-100'
    }`}>
      {active && <CheckCircle2 className="w-3 h-3 text-white" />}
    </div>
    <p className={`text-xs font-black ${current ? 'text-blue-600' : active ? 'text-slate-900' : 'text-slate-300'}`}>{label}</p>
    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{time}</p>
  </div>
);

const Badge = ({ icon, label }: { icon: any, label: string }) => (
  <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
    {React.cloneElement(icon, { className: 'w-3 h-3' })}
    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-600">{label}</span>
  </div>
);

export default PermitAgent;
