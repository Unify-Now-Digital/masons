
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Send, MessageCircle, Phone, Mail, Sparkles, CheckCheck, RefreshCw } from 'lucide-react';
import { DUMMY_MESSAGES, DUMMY_PEOPLE } from '@/shared/lib/prototypeConstants';

interface MessageSidePeekProps {
  resourceId: string;
  onClose: () => void;
}

const MessageSidePeek: React.FC<MessageSidePeekProps> = ({ resourceId, onClose }) => {
  const [replyText, setReplyText] = useState('');
  
  const person = useMemo(() => 
    DUMMY_PEOPLE.find(p => p.id === resourceId || p.name.includes(resourceId)), 
    [resourceId]
  );

  const messages = [
    { id: 1, sender: person?.name || 'Client', content: "Hi, I've just seen the proof for the Harkness memorial. Can we make the surname slightly larger?", timestamp: '10:45 AM', type: 'inbound' },
    { id: 2, sender: 'AI Agent', content: "I've acknowledged your request. A master mason is reviewing the typography adjustments now.", timestamp: '10:46 AM', type: 'ai' },
  ];

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  return (
    <div className="w-[450px] bg-white border-l h-screen fixed right-0 top-0 shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-6 bg-gardens-sidebar text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gardens-blu rounded-xl flex items-center justify-center font-black">
            {person?.name.charAt(0) || 'C'}
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight">{person?.name || 'Conversation'}</h3>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-gardens-grn" /> Active Channel
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-gardens-page/30 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.type === 'inbound' ? 'items-start' : 'items-end'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs font-medium leading-relaxed shadow-sm border ${
              msg.type === 'inbound' ? 'bg-white border-gardens-bdr text-gardens-tx rounded-tl-none' : 
              msg.type === 'ai' ? 'bg-gardens-blu border-gardens-blu text-white rounded-tr-none' :
              'bg-gardens-sidebar border-gardens-bdr2 text-white rounded-tr-none'
            }`}>
              {msg.type === 'ai' && (
                <div className="flex items-center gap-1 mb-1 text-[8px] font-black uppercase tracking-widest text-white/60">
                  <Sparkles className="w-2.5 h-2.5" /> AI Response
                </div>
              )}
              {msg.content}
            </div>
            <span className="text-[9px] font-black text-gardens-txs uppercase mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}
      </div>

      <div className="p-6 border-t bg-white">
        <div className="flex gap-2 p-1.5 bg-gardens-page rounded-2xl border border-gardens-bdr">
          <textarea 
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-3 min-h-[44px] max-h-32 resize-none"
          />
          <button className="bg-gardens-sidebar text-white p-3 rounded-xl hover:bg-gardens-sidebar transition-all shadow-lg shadow-slate-900/10">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageSidePeek;
