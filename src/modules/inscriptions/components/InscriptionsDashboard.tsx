
import React, { useState, useMemo } from 'react';
import { 
  PenTool, Wand2, CheckCircle2, 
  ImageIcon, Download, Share2, History, RotateCcw, 
  Clock, Hash, Layers, FileJson, Cpu, Maximize2, Sparkles, Send, TextQuote, ExternalLink, Globe, MessageSquare,
  RefreshCw, MapPin, Box, Type, Ruler
} from 'lucide-react';
import { DUMMY_ORDERS, DUMMY_PRODUCTS } from '@/shared/lib/prototypeConstants';
import { ProofStatus } from '@/shared/types/prototype.types';
import { parseInscriptionAI, generateVisualProofAI } from '@/shared/lib/geminiService';
import VisualProof from '@/modules/inscriptions/components/VisualProof';

const InscriptionsDashboard: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [proofLines, setProofLines] = useState<any[]>([]);
  const [currentTextPreview, setCurrentTextPreview] = useState<string>("");
  const [showShareSuccess, setShowShareSuccess] = useState(false);

  const selectedOrder = useMemo(() => DUMMY_ORDERS.find(o => o.id === selectedId), [selectedId]);
  const selectedProduct = useMemo(() => 
    selectedOrder ? DUMMY_PRODUCTS.find(p => p.sku === selectedOrder?.sku) || DUMMY_PRODUCTS[0] : DUMMY_PRODUCTS[0],
    [selectedOrder]
  );

  const handleAIParse = async () => {
    if (!selectedOrder) return;
    setIsParsing(true);
    const result = await parseInscriptionAI(currentTextPreview || selectedOrder.inscription?.rawText || "");
    setParsedData(result);
    setTimeout(() => setIsParsing(false), 800);
  };

  const handleGenerateProof = async () => {
    if (!selectedOrder) return;
    setIsGeneratingProof(true);
    const result = await generateVisualProofAI(
      currentTextPreview || selectedOrder.inscription?.rawText || "", 
      selectedProduct
    );
    if (result && result.lines) {
      setProofLines(result.lines);
    }
    setIsGeneratingProof(false);
  };

  const handlePublishProof = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setShowShareSuccess(true);
      if (selectedOrder) {
        selectedOrder.proofStatus = ProofStatus.AWAITING_CLIENT;
        if (selectedOrder.inscription) {
          selectedOrder.inscription.publicLink = `https://mason.ai/proof/${selectedOrder.id}`;
        }
      }
      setTimeout(() => setShowShareSuccess(false), 5000);
    }, 1500);
  };

  const calculateCharCount = (text: string) => {
    return text.replace(/[^a-zA-Z0-9]/g, "").length;
  };

  return (
    <div className="h-full flex flex-col bg-gardens-page">
      <div className="p-4 lg:p-6 border-b bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h2 className="text-xl xl:text-2xl font-black text-gardens-tx tracking-tighter">Stonecraft Studio</h2>
          <p className="text-xs text-gardens-txs font-medium tracking-tight">AI-Enhanced Inscription Design & Vector Generation</p>
        </div>
        {selectedId && (
          <div className="flex items-center gap-4">
             <div className="px-3 py-1 bg-gardens-grn-lt text-gardens-grn-dk text-[10px] font-black uppercase rounded-lg border border-gardens-grn-lt flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gardens-grn animate-pulse" />
                Active Session: {selectedId}
             </div>
             <button 
                onClick={handlePublishProof}
                className="flex items-center gap-2 bg-gardens-sidebar text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all"
             >
               {isPublishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-gardens-blu" />}
               Publish Proof to Client
             </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative">
        {showShareSuccess && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-gardens-grn text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-xs font-black uppercase tracking-widest">Proof Link Shared with {selectedOrder?.customerName}</p>
          </div>
        )}

        {/* Job List */}
        <div className="lg:col-span-2 border-r bg-white overflow-y-auto custom-scrollbar p-4 space-y-4">
          <h3 className="text-[10px] font-black text-gardens-txs uppercase tracking-widest px-2">Design Queue</h3>
          {DUMMY_ORDERS.map((order) => (
            <button
              key={order.id}
              onClick={() => {
                setSelectedId(order.id);
                setProofLines(order.inscription?.lines || []);
                setCurrentTextPreview(order.inscription?.rawText || "");
                setParsedData(null);
              }}
              className={`w-full text-left p-4 rounded-2xl transition-all border-2 ${
                selectedId === order.id 
                  ? 'bg-gardens-sidebar border-gardens-bdr2 text-white shadow-xl' 
                  : 'bg-white border-transparent hover:border-gardens-bdr'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black uppercase text-gardens-txs">{order.id}</span>
                {order.proofStatus === ProofStatus.AWAITING_CLIENT && <Globe className="w-3 h-3 text-gardens-blu" />}
              </div>
              <p className="text-xs font-black truncate">{order.customerName}</p>
            </button>
          ))}
        </div>

        {/* Design Canvas */}
        <div className="lg:col-span-6 overflow-y-auto custom-scrollbar p-4 xl:p-8 bg-gardens-page/50 flex flex-col items-center">
          {selectedId && selectedOrder ? (
            <div className="w-full max-w-2xl space-y-8 animate-in fade-in zoom-in-95 duration-500">
               {/* PERSISTENT ORDER DETAILS CARDS */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                 <div className="bg-white p-3.5 rounded-2xl border border-gardens-bdr shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Box className="w-3 h-3 text-gardens-txs" />
                      <p className="text-[9px] font-black text-gardens-txs uppercase tracking-widest">Deceased</p>
                    </div>
                    <p className="text-xs font-black text-gardens-tx truncate">{selectedOrder.deceasedName}</p>
                 </div>
                 <div className="bg-white p-3.5 rounded-2xl border border-gardens-bdr shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1.5">
                      <MapPin className="w-3 h-3 text-gardens-txs" />
                      <p className="text-[9px] font-black text-gardens-txs uppercase tracking-widest">Cemetery</p>
                    </div>
                    <p className="text-xs font-black text-gardens-tx truncate">{selectedOrder.cemetery}</p>
                 </div>
                 <div className="bg-white p-3.5 rounded-2xl border border-gardens-bdr shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Ruler className="w-3 h-3 text-gardens-txs" />
                      <p className="text-[9px] font-black text-gardens-txs uppercase tracking-widest">Stone Type</p>
                    </div>
                    <p className="text-xs font-black text-gardens-tx truncate">{selectedProduct.name}</p>
                 </div>
                 <div className="bg-white p-3.5 rounded-2xl border border-gardens-bdr shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Hash className="w-3 h-3 text-gardens-txs" />
                      <p className="text-[9px] font-black text-gardens-txs uppercase tracking-widest">Characters</p>
                    </div>
                    <p className="text-xs font-black text-gardens-blu-dk">{calculateCharCount(currentTextPreview)}</p>
                 </div>
               </div>

               <div className="flex flex-col items-center">
                  <VisualProof 
                    id="vector-proof-svg"
                    shape={selectedProduct.shape} 
                    lines={proofLines} 
                    materialColor={selectedProduct.material.includes('Black') ? '#1a1a1a' : '#525252'}
                    width={420}
                    height={520}
                  />

                  {selectedOrder?.inscription?.publicLink && (
                    <div className="w-full mt-6 p-4 bg-white border border-gardens-blu-lt rounded-3xl shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-gardens-blu-lt rounded-xl flex items-center justify-center text-gardens-blu-dk">
                           <Globe className="w-5 h-5" />
                         </div>
                         <div>
                           <p className="text-[10px] font-black text-gardens-txs uppercase tracking-widest">Client Access Link</p>
                           <p className="text-[11px] font-bold text-gardens-blu-dk truncate">{selectedOrder.inscription.publicLink}</p>
                         </div>
                       </div>
                       <button className="p-2.5 hover:bg-gardens-page rounded-xl text-gardens-txs transition-all">
                         <ExternalLink className="w-4 h-4" />
                       </button>
                    </div>
                  )}
               </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gardens-txm max-w-xs text-center">
               <PenTool className="w-12 h-12 opacity-10 mb-6" />
               <h3 className="text-lg font-black text-gardens-txs tracking-tight mb-2">Select a Job</h3>
               <p className="text-xs font-medium text-gardens-txs">Choose an order from the design queue to begin drafting.</p>
            </div>
          )}
        </div>

        {/* Editor & Comments */}
        <div className="lg:col-span-4 border-l bg-white overflow-y-auto custom-scrollbar flex flex-col">
          {selectedId ? (
            <div className="p-4 xl:p-8 space-y-6 xl:space-y-8">
               <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[11px] font-black text-gardens-tx uppercase tracking-[0.2em]">Live Editor</h3>
                    <div className="flex gap-2">
                       <button 
                         onClick={handleAIParse}
                         disabled={isParsing}
                         title="AI Parsing"
                         className={`p-2 rounded-lg border transition-all ${isParsing ? 'bg-gardens-blu-lt border-gardens-blu-lt' : 'bg-white border-gardens-bdr hover:bg-gardens-page'}`}
                       >
                         <Sparkles className={`w-4 h-4 ${isParsing ? 'text-gardens-blu animate-pulse' : 'text-gardens-txs'}`} />
                       </button>
                       <button 
                         onClick={handleGenerateProof}
                         disabled={isGeneratingProof}
                         className="bg-gardens-sidebar text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-gardens-sidebar transition-all shadow-lg"
                       >
                         {isGeneratingProof ? 'Drafting...' : 'Update Proof'}
                       </button>
                    </div>
                  </div>

                  <textarea
                    value={currentTextPreview}
                    onChange={(e) => setCurrentTextPreview(e.target.value)}
                    placeholder="Enter inscription text..."
                    className="w-full min-h-[180px] p-6 bg-gardens-sidebar rounded-2xl text-white text-sm font-medium leading-relaxed italic border-4 border-gardens-bdr2 shadow-xl focus:ring-4 focus:ring-gardens-blu/10 outline-none transition-all"
                  />
               </div>

               <div className="pt-8 border-t">
                  <div className="flex items-center gap-2 mb-6">
                    <MessageSquare className="w-4 h-4 text-gardens-blu" />
                    <h3 className="text-[11px] font-black text-gardens-tx uppercase tracking-[0.2em]">Client Feedback</h3>
                  </div>
                  
                  {selectedOrder?.inscription?.comments?.length ? (
                    <div className="space-y-4">
                       {selectedOrder.inscription.comments.map(c => (
                         <div key={c.id} className={`p-4 rounded-2xl border ${c.author === 'Customer' ? 'bg-gardens-blu-lt border-gardens-blu-lt' : 'bg-gardens-page border-gardens-bdr'}`}>
                           <p className="text-[9px] font-black text-gardens-txs uppercase tracking-widest mb-1">{c.author} • {c.timestamp}</p>
                           <p className="text-xs font-medium text-gardens-tx leading-relaxed">{c.text}</p>
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                       <p className="text-[10px] font-black text-gardens-txm uppercase tracking-widest">No Feedback Received Yet</p>
                    </div>
                  )}
               </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-center text-gardens-txm bg-gardens-page/10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] leading-loose">Panel Locked</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InscriptionsDashboard;
