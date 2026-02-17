
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Mail, MessageCircle, Phone, Search, Link2, ExternalLink, 
  RefreshCw, Send, CheckCheck, Clock, User, Plus, 
  MoreVertical, Smartphone, Info, Calendar, Paperclip, Smile,
  ChevronDown, Filter, Trash2, Archive, PanelRight, MapPin,
  Calculator, Box, Sparkles, Wand2, Building, CheckCircle2,
  CalendarCheck, FileText, ArrowUpRight, History
} from 'lucide-react';
import { DUMMY_MESSAGES, DUMMY_ORDERS, DUMMY_PRODUCTS } from '@/shared/lib/prototypeConstants';
import { matchCemeteryEmailToOrderAI } from '@/shared/lib/geminiService';
import VisualProof from '@/modules/inscriptions/components/VisualProof';

interface ThreadMessage {
  id: string;
  channel: 'email' | 'whatsapp' | 'sms' | 'system' | 'event';
  direction: 'inbound' | 'outbound' | 'center';
  sender: string;
  content: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  subject?: string;
  attachments?: { name: string; size: string; type: string }[];
}

const UnifiedInbox: React.FC = () => {
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(DUMMY_MESSAGES[0]?.id || null);
  const [activeChannel, setActiveChannel] = useState<'all' | 'email' | 'whatsapp' | 'sms'>('all');
  const [replyText, setReplyText] = useState('');
  const [replyChannel, setReplyChannel] = useState<'email' | 'whatsapp' | 'sms'>('whatsapp');
  const [showDossier, setShowDossier] = useState(true); // Changed to true by default
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiMatch, setAiMatch] = useState<{orderId: string, reasoning: string} | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedMsg = useMemo(() => 
    DUMMY_MESSAGES.find(m => m.id === selectedMsgId), 
    [selectedMsgId]
  );

  const linkedOrder = useMemo(() => 
    DUMMY_ORDERS.find(o => o.id === (aiMatch?.orderId || selectedMsg?.linkedOrderId)),
    [selectedMsg, aiMatch]
  );

  const selectedProduct = useMemo(() => 
    linkedOrder ? DUMMY_PRODUCTS.find(p => p.sku === linkedOrder.sku) || DUMMY_PRODUCTS[0] : null,
    [linkedOrder]
  );

  useEffect(() => {
    const checkCemeteryMatch = async () => {
      if (!selectedMsg || selectedMsg.linkedOrderId || !selectedMsg.from.toLowerCase().includes('cemetery')) {
        setAiMatch(null);
        return;
      }
      
      setIsAiProcessing(true);
      const result = await matchCemeteryEmailToOrderAI(selectedMsg.preview, DUMMY_ORDERS);
      if (result?.matchFound && result.orderId) {
        setAiMatch({ orderId: result.orderId, reasoning: result.reasoning });
      }
      setIsAiProcessing(false);
    };

    checkCemeteryMatch();
  }, [selectedMsgId]);

  const threadMessages: ThreadMessage[] = useMemo(() => {
    if (!selectedMsg) return [];
    
    const history: ThreadMessage[] = [];

    history.push({
      id: 'evt-start',
      channel: 'event',
      direction: 'center',
      sender: 'System',
      content: linkedOrder ? `${linkedOrder.type} Dossier Created` : 'Lead Conversation Initiated',
      timestamp: 'Initial Contact'
    });

    const relatedMessages = DUMMY_MESSAGES.filter(m => m.from === selectedMsg.from).reverse();
    
    relatedMessages.forEach((m, idx) => {
      if (m.aiDetectedInscription) {
        history.push({
          id: `ai-parse-${idx}`,
          channel: 'event',
          direction: 'center',
          sender: 'AI Agent',
          content: 'AI recognized inscription details in this message.',
          timestamp: m.date
        });
      }

      history.push({
        id: m.id,
        channel: m.channel,
        direction: 'inbound',
        sender: m.from,
        subject: m.subject,
        content: m.preview,
        timestamp: m.date
      });
    });

    if (aiMatch) {
      history.push({
        id: 'ai-match-evt',
        channel: 'event',
        direction: 'center',
        sender: 'AI Agent',
        content: `AI detected a potential match with ORD-${aiMatch.orderId}. Confidence: 94%.`,
        timestamp: 'Just now'
      });
    }

    return history;
  }, [selectedMsg, aiMatch, linkedOrder]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [threadMessages, selectedMsgId]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Unified Inbox</h2>
          <div className="h-4 w-px bg-slate-200" />
          <p className="text-slate-400 font-bold text-xs flex items-center gap-2 uppercase tracking-widest">
            <RefreshCw className="w-3 h-3 text-blue-500" /> 
            Live Pipeline
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Inbox Sidebar */}
        <div className="w-[260px] xl:w-[320px] flex flex-col bg-white border-r border-slate-200 shrink-0">
          <div className="p-3 grid grid-cols-4 gap-1 bg-slate-50/50">
            {(['all', 'email', 'whatsapp', 'sms'] as const).map(c => (
              <button 
                key={c}
                onClick={() => setActiveChannel(c)}
                className={`py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  activeChannel === c 
                    ? 'text-blue-600 bg-white shadow-sm ring-1 ring-slate-200' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {DUMMY_MESSAGES.filter(m => activeChannel === 'all' || m.channel === activeChannel).map((msg) => {
              const isAuthority = msg.from.toLowerCase().includes('cemetery') || msg.from.toLowerCase().includes('council') || msg.from.toLowerCase().includes('office');
              return (
                <div 
                  key={msg.id} 
                  onClick={() => setSelectedMsgId(msg.id)} 
                  className={`px-5 py-4 cursor-pointer transition-all relative border-l-4 ${
                    selectedMsgId === msg.id 
                      ? 'bg-blue-50/50 border-blue-600' 
                      : 'hover:bg-slate-50 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <ChannelIcon channel={msg.channel} className="w-3 h-3" />
                      <span className="text-[8px] font-black uppercase tracking-tighter">
                        {msg.channel}
                      </span>
                    </div>
                    {isAuthority && (
                      <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                        <Building className="w-2.5 h-2.5" /> Authority
                      </span>
                    )}
                    {msg.aiDetectedInscription && (
                      <Sparkles className="w-3 h-3 text-blue-500" />
                    )}
                  </div>
                  <h4 className={`font-black text-sm truncate pr-4 ${selectedMsgId === msg.id ? 'text-blue-900' : 'text-slate-900'}`}>{msg.from}</h4>
                  <p className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
                    {msg.preview}
                  </p>
                  <p className="text-[9px] font-bold text-slate-300 uppercase mt-1.5">{msg.date}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedMsg ? (
              <>
                <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-md">
                      {selectedMsg.from.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-slate-900 leading-tight truncate">{selectedMsg.from}</h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate max-w-[200px]">{selectedMsg.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowDossier(!showDossier)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        showDossier ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <PanelRight className="w-3.5 h-3.5" />
                      {showDossier ? 'Close Dossier' : 'Open Dossier'}
                    </button>
                  </div>
                </div>

                {/* AI Match Suggestion Banner */}
                {aiMatch && (
                  <div className="mx-8 mt-6 p-4 bg-blue-600 rounded-2xl text-white shadow-xl animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                           <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">AI Intelligence</p>
                          <h4 className="text-sm font-black truncate">Link to Order {aiMatch.orderId}?</h4>
                          <p className="text-[10px] font-medium opacity-80 mt-1 truncate">{aiMatch.reasoning}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all shrink-0">
                           Link
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-6 bg-slate-50/20 custom-scrollbar">
                  {threadMessages.map((msg) => (
                    msg.direction === 'center' ? (
                      <div key={msg.id} className="flex flex-col items-center py-2">
                        <div className="px-4 py-1.5 bg-slate-200/50 rounded-full flex items-center gap-2 border border-slate-300/30">
                           {msg.sender === 'AI Agent' ? <Sparkles className="w-3 h-3 text-blue-600" /> : <Info className="w-3 h-3 text-slate-400" />}
                           <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                             {msg.content} • {msg.timestamp}
                           </span>
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex flex-col items-start animate-in slide-in-from-bottom-1 duration-200">
                        <div className="flex items-center gap-2 mb-1.5">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{msg.sender} • {msg.timestamp}</span>
                        </div>
                        <div className="flex gap-3 max-w-[85%] items-end">
                          <div className={`relative px-5 py-4 rounded-2xl border bg-white border-slate-200 text-slate-800 rounded-tl-none shadow-sm ${msg.sender === 'AI Agent' ? 'ring-2 ring-blue-500/20' : ''}`}>
                            <p className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>

                <div className="px-8 py-6 bg-white border-t border-slate-100 shrink-0">
                  <div className="flex gap-3 items-end bg-slate-50 border border-slate-200 rounded-[1.5rem] p-3 focus-within:bg-white transition-all group shadow-inner">
                    <div className="p-2">
                      <select 
                        value={replyChannel} 
                        onChange={(e) => setReplyChannel(e.target.value as any)}
                        className="bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase px-2 py-1 outline-none"
                      >
                         <option value="whatsapp">WhatsApp</option>
                         <option value="email">Email</option>
                         <option value="sms">SMS</option>
                      </select>
                    </div>
                    <textarea 
                      value={replyText} 
                      onChange={(e) => setReplyText(e.target.value)} 
                      placeholder={`Reply via ${replyChannel}...`} 
                      className="flex-1 px-2 py-2 bg-transparent border-none rounded-xl text-sm focus:ring-0 resize-none max-h-32 min-h-[40px] font-medium" 
                    />
                    <button disabled={!replyText.trim()} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-20 transition-all hover:bg-blue-600">Send</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/20 text-slate-300">
                 <History className="w-12 h-12 opacity-10 mb-6" />
                 <p className="font-black uppercase text-[10px] tracking-widest">Select Communication to start</p>
              </div>
            )}
          </div>

          {/* Dossier Sidebar */}
          <div className={`${showDossier && linkedOrder ? 'w-[300px] xl:w-[360px]' : 'w-0'} bg-white border-l border-slate-200 flex flex-col transition-all duration-300 overflow-hidden shrink-0`}>
            {linkedOrder && (
              <div className="w-[300px] xl:w-[360px] flex flex-col h-full">
                <div className="p-6 border-b bg-slate-900 text-white flex justify-between items-center">
                   <div className="min-w-0">
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 truncate">{linkedOrder.type}</p>
                     <h3 className="text-xl font-black tracking-tight truncate">{linkedOrder.deceasedName}</h3>
                   </div>
                   <div className="bg-blue-600 p-2 rounded-xl shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Active Design</h4>
                    </div>
                    <div className="scale-[0.8] origin-top flex justify-center">
                       {selectedProduct && (
                         <VisualProof 
                           shape={selectedProduct.shape} 
                           lines={linkedOrder.inscription?.lines || []}
                           width={280}
                           height={340}
                           materialColor={selectedProduct.material.includes('Black') ? '#1a1a1a' : selectedProduct.material.includes('Red') ? '#7f1d1d' : '#525252'}
                         />
                       )}
                    </div>
                  </section>
                  
                  <section className="pt-6 border-t">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Lifecycle Stats</h4>
                     <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <span className="text-[10px] font-black text-slate-400 uppercase">Cemetery</span>
                           <span className="text-xs font-bold text-slate-900 truncate ml-4 text-right">{linkedOrder.cemetery}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <span className="text-[10px] font-black text-slate-400 uppercase">Settlement</span>
                           <span className="text-xs font-bold text-green-600">£{linkedOrder.paidAmount.toLocaleString()}</span>
                        </div>
                     </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChannelIcon = ({ channel, className = "" }: { channel: string, className?: string }) => {
  switch (channel) {
    case 'email': return <Mail className={`text-red-500 ${className}`} />;
    case 'whatsapp': return <MessageCircle className={`text-green-500 ${className}`} />;
    case 'sms': return <Smartphone className={`text-indigo-500 ${className}`} />;
    case 'system': return <Info className={`text-amber-500 ${className}`} />;
    case 'event': return <RefreshCw className={`text-slate-400 ${className}`} />;
    default: return <User className={`text-slate-400 ${className}`} />;
  }
};

export default UnifiedInbox;
