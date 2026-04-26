
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Send, Hash, User, Paperclip, Smile, Image as ImageIcon, Search, Plus, 
  AtSign, ShoppingCart, MessageSquare, Info, History, Sparkles, 
  ChevronRight, ExternalLink, Box
} from 'lucide-react';
import { DUMMY_ORDERS, DUMMY_PEOPLE } from '@/shared/lib/prototypeConstants';

interface ChatMessage {
  id: string;
  user: string;
  role?: string;
  time: string;
  content: string;
  avatar: string;
  type?: 'user' | 'system' | 'ai';
  mentions?: string[];
}

const TeamChat: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState('production');
  const [message, setMessage] = useState('');
  const [mentionMenu, setMentionMenu] = useState<{ type: 'order' | 'person', search: string, isOpen: boolean }>({
    type: 'order',
    search: '',
    isOpen: false
  });
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const CHANNELS = [
    { id: 'announcements', name: 'Announcements', count: 0 },
    { id: 'production', name: 'Production Floor', count: 3 },
    { id: 'installs', name: 'Installation Crew', count: 1 },
    { id: 'permits', name: 'Permit Desk', count: 0 },
  ];

  const INITIAL_MESSAGES: ChatMessage[] = [
    { 
      id: '1', 
      user: 'Mark Mason', 
      time: '10:24 AM', 
      content: "Just finished the lettering on #ORD-101. Ready for pick up @Sarah Admin.", 
      avatar: 'MM' 
    },
    { 
      id: '2', 
      user: 'Sarah Admin', 
      time: '10:30 AM', 
      content: "Perfect, I've notified the family. @Alice Thompson is coming in tomorrow.", 
      avatar: 'SA' 
    },
    { 
      id: '3', 
      user: 'Pete Installer', 
      time: '11:15 AM', 
      content: "Ground conditions at Landican are a bit soft today. Might need extra cement for the foundation on #ORD-102.", 
      avatar: 'PI' 
    },
    {
      id: '4',
      user: 'AI Assistant',
      time: '11:20 AM',
      content: "Confirmed: Site conditions logged for #ORD-102. Inventory check: Cement stock is sufficient.",
      avatar: 'AI',
      type: 'ai'
    }
  ];

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, activeChannel]);

  // Handle Mentions Logic
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    const lastChar = val[val.length - 1];
    const words = val.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('#')) {
      setMentionMenu({ type: 'order', search: lastWord.slice(1), isOpen: true });
    } else if (lastWord.startsWith('@')) {
      setMentionMenu({ type: 'person', search: lastWord.slice(1), isOpen: true });
    } else {
      setMentionMenu({ ...mentionMenu, isOpen: false });
    }
  };

  const selectMention = (ref: string) => {
    const words = message.split(' ');
    words[words.length - 1] = ref;
    setMessage(words.join(' ') + ' ');
    setMentionMenu({ ...mentionMenu, isOpen: false });
    inputRef.current?.focus();
  };

  const filteredMentions = useMemo(() => {
    if (mentionMenu.type === 'order') {
      return DUMMY_ORDERS.filter(o => 
        o.id.toLowerCase().includes(mentionMenu.search.toLowerCase()) || 
        o.customerName.toLowerCase().includes(mentionMenu.search.toLowerCase())
      ).slice(0, 5);
    } else {
      return DUMMY_PEOPLE.filter(p => 
        p.name.toLowerCase().includes(mentionMenu.search.toLowerCase())
      ).slice(0, 5);
    }
  }, [mentionMenu]);

  const sendMessage = () => {
    if (!message.trim()) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      user: 'Adam Young',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: message,
      avatar: 'AY'
    };
    setChatHistory([...chatHistory, newMessage]);
    setMessage('');
  };

  // Parser to turn references into clickable elements
  const renderRichText = (text: string) => {
    const parts = text.split(/(\bORD-\d+|\@[A-Za-z\s]+(?=\s|$|\.|\,))/g);
    return parts.map((part, i) => {
      if (part.startsWith('ORD-') || part.startsWith('#ORD-')) {
        const cleanPart = part.replace('#', '');
        return (
          <button 
            key={i} 
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-gardens-sidebar text-white rounded text-[10px] font-black uppercase tracking-tighter hover:bg-gardens-blu transition-colors shadow-sm"
          >
            <ShoppingCart className="w-2.5 h-2.5" /> {cleanPart}
          </button>
        );
      }
      if (part.startsWith('@')) {
        return (
          <button 
            key={i} 
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-gardens-blu-lt text-gardens-blu-dk rounded text-[10px] font-black uppercase tracking-tighter hover:bg-gardens-blu-lt transition-colors"
          >
            <AtSign className="w-2.5 h-2.5" /> {part.slice(1)}
          </button>
        );
      }
      return part;
    });
  };

  return (
    <div className="h-full flex bg-white overflow-hidden">
      {/* Channels Sidebar */}
      <div className="w-56 xl:w-72 border-r flex flex-col bg-gardens-page shrink-0">
        <div className="p-4 xl:p-6 border-b flex justify-between items-center bg-white h-[65px] xl:h-[85px]">
          <h2 className="text-xl font-black text-gardens-tx tracking-tight">Team Chat</h2>
          <button className="p-2 hover:bg-gardens-page rounded-xl text-gardens-txs"><Search className="w-4 h-4" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
          <section>
            <div className="flex justify-between items-center px-3 mb-4">
              <p className="text-[10px] font-black text-gardens-txs uppercase tracking-widest">Active Channels</p>
              <button className="text-gardens-blu-dk"><Plus className="w-3.5 h-3.5" /></button>
            </div>
            <div className="space-y-1">
              {CHANNELS.map(ch => (
                <button 
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all group ${
                    activeChannel === ch.id 
                      ? 'bg-gardens-sidebar text-white shadow-xl shadow-slate-900/10' 
                      : 'text-gardens-txs hover:bg-white hover:text-gardens-tx'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Hash className={`w-4 h-4 ${activeChannel === ch.id ? 'text-white/50' : 'text-gardens-txm'}`} />
                    <span className="tracking-tight">{ch.name}</span>
                  </div>
                  {ch.count > 0 && (
                    <span className={`w-5 h-5 flex items-center justify-center rounded-lg text-[10px] font-black ${
                      activeChannel === ch.id ? 'bg-white/20 text-white' : 'bg-gardens-amb text-white'
                    }`}>
                      {ch.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center px-3 mb-4">
              <p className="text-[10px] font-black text-gardens-txs uppercase tracking-widest">Team Relay</p>
            </div>
            <div className="space-y-1">
              <DMItem name="Mark Mason" status="online" />
              <DMItem name="Sarah Admin" status="online" />
              <DMItem name="Pete Installer" status="away" />
              <DMItem name="Adam Young" status="online" isMe />
            </div>
          </section>
        </div>
      </div>

      {/* Chat Canvas */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <div className="px-4 xl:px-8 py-4 xl:py-5 border-b flex justify-between items-center bg-white h-[65px] xl:h-[85px] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gardens-page rounded-xl flex items-center justify-center text-gardens-txs">
               <Hash className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gardens-tx capitalize tracking-tight">{activeChannel}</h3>
              <p className="text-[10px] font-bold text-gardens-txs uppercase mt-0.5">Topic: Coordinating floor production and fixes</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex -space-x-3">
                <div className="w-9 h-9 rounded-full bg-gardens-blu-lt border-4 border-white flex items-center justify-center text-[10px] font-bold text-gardens-blu-dk">MM</div>
                <div className="w-9 h-9 rounded-full bg-gardens-grn-lt border-4 border-white flex items-center justify-center text-[10px] font-bold text-gardens-grn-dk">SA</div>
                <div className="w-9 h-9 rounded-full bg-gardens-page border-4 border-white flex items-center justify-center text-[10px] font-bold text-gardens-txs">+2</div>
             </div>
             <div className="h-6 w-px bg-gardens-bdr" />
             <button className="p-2 text-gardens-txs hover:text-gardens-tx transition-colors"><Info className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Message Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 xl:p-8 space-y-5 xl:space-y-8 bg-gardens-page/20 custom-scrollbar">
          {chatHistory.map((msg) => (
            <div key={msg.id} className="flex gap-5 group animate-in slide-in-from-bottom-2 duration-300">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm shadow-sm border transition-all ${
                 msg.type === 'ai' ? 'bg-gardens-blu text-white border-gardens-blu' : 'bg-white text-gardens-txs border-gardens-bdr group-hover:border-gardens-blu-lt'
               }`}>
                 {msg.avatar}
               </div>
               <div className="space-y-1.5 flex-1 min-w-0">
                 <div className="flex items-center gap-3">
                   <span className="text-sm font-black text-gardens-tx">{msg.user}</span>
                   {msg.type === 'ai' && (
                     <span className="bg-gardens-blu-lt text-gardens-blu-dk text-[8px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                       <Sparkles className="w-2.5 h-2.5" /> AI
                     </span>
                   )}
                   <span className="text-[10px] font-bold text-gardens-txm uppercase tracking-tighter">{msg.time}</span>
                 </div>
                 <div className={`px-5 py-4 rounded-3xl rounded-tl-none shadow-sm border text-[13px] leading-relaxed max-w-2xl font-medium ${
                   msg.type === 'ai' ? 'bg-gardens-blu-lt border-gardens-blu-lt text-gardens-blu-dk' : 'bg-white border-gardens-bdr text-gardens-tx'
                 }`}>
                   {renderRichText(msg.content)}
                 </div>
               </div>
            </div>
          ))}
        </div>

        {/* Mentions Dropdown */}
        {mentionMenu.isOpen && (
          <div className="absolute bottom-32 left-8 w-80 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gardens-bdr overflow-hidden z-[100] animate-in slide-in-from-bottom-4 duration-200">
            <div className="p-4 bg-gardens-page border-b flex items-center gap-2">
               {mentionMenu.type === 'order' ? <ShoppingCart className="w-3.5 h-3.5 text-gardens-blu" /> : <User className="w-3.5 h-3.5 text-gardens-blu" />}
               <p className="text-[10px] font-black uppercase tracking-widest text-gardens-txs">
                 Referencing {mentionMenu.type === 'order' ? 'Pipeline Order' : 'Team Member'}
               </p>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredMentions.length > 0 ? filteredMentions.map((item: any) => (
                <button 
                  key={item.id}
                  onClick={() => selectMention(mentionMenu.type === 'order' ? `#${item.id}` : `@${item.name}`)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gardens-page text-left transition-all border-b border-gardens-bdr last:border-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-gardens-page flex items-center justify-center text-[10px] font-black text-gardens-txs">
                    {mentionMenu.type === 'order' ? '#' : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-black text-gardens-tx">{mentionMenu.type === 'order' ? item.customerName : item.name}</p>
                    <p className="text-[10px] font-bold text-gardens-txs uppercase tracking-tighter">
                      {mentionMenu.type === 'order' ? `${item.id} • ${item.deceasedName}` : item.role}
                    </p>
                  </div>
                </button>
              )) : (
                <div className="p-6 text-center text-gardens-txs text-[10px] font-black uppercase">No matches found</div>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 xl:p-8 bg-white border-t shrink-0">
          <div className="bg-gardens-page rounded-[2rem] border border-gardens-bdr p-3 shadow-inner group focus-within:bg-white focus-within:ring-4 focus-within:ring-gardens-blu/5 transition-all">
             <textarea 
               ref={inputRef}
               value={message}
               onChange={handleInputChange}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   sendMessage();
                 }
               }}
               placeholder={`Message #${activeChannel}... (Use # for orders, @ for people)`}
               className="w-full bg-transparent border-none resize-none px-4 py-3 text-sm focus:ring-0 min-h-[56px] font-medium leading-relaxed"
             />
             <div className="flex justify-between items-center px-4 pb-2 pt-2 border-t border-gardens-bdr/50">
                <div className="flex gap-2">
                  <ChatTool icon={<Smile className="w-4 h-4" />} />
                  <ChatTool icon={<ImageIcon className="w-4 h-4" />} />
                  <ChatTool icon={<Paperclip className="w-4 h-4" />} />
                  <div className="w-px h-4 bg-gardens-bdr mx-2 self-center" />
                  <ChatTool icon={<AtSign className="w-4 h-4" />} onClick={() => setMentionMenu({ type: 'person', search: '', isOpen: true })} />
                  <ChatTool icon={<Hash className="w-4 h-4" />} onClick={() => setMentionMenu({ type: 'order', search: '', isOpen: true })} />
                </div>
                <button 
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                    message.trim() 
                      ? 'bg-gardens-sidebar text-white shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95' 
                      : 'bg-gardens-bdr text-gardens-txs'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    Send <Send className="w-3.5 h-3.5" />
                  </div>
                </button>
             </div>
          </div>
          <p className="text-[9px] font-bold text-gardens-txm uppercase tracking-widest mt-4 text-center">
            Shift + Enter for new line • Use mentions to link project dossiers
          </p>
        </div>
      </div>
    </div>
  );
};

const DMItem = ({ name, status, isMe }: { name: string, status: 'online' | 'away' | 'offline', isMe?: boolean }) => (
  <button className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold text-gardens-tx hover:bg-white transition-all group">
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-gardens-page flex items-center justify-center text-[11px] font-black text-gardens-txs group-hover:text-gardens-blu-dk transition-colors">
          {name.split(' ').map(n => n[0]).join('')}
        </div>
        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-4 border-gardens-bdr ${
          status === 'online' ? 'bg-gardens-grn' : status === 'away' ? 'bg-gardens-amb' : 'bg-gardens-bdr'
        }`} />
      </div>
      <div>
        <p className="tracking-tight text-gardens-tx">{name} {isMe && <span className="text-[10px] text-gardens-txs opacity-50 font-medium">(you)</span>}</p>
        <p className="text-[9px] font-black uppercase text-gardens-txs opacity-0 group-hover:opacity-100 transition-opacity tracking-tighter">View Profile</p>
      </div>
    </div>
    <ChevronRight className="w-3.5 h-3.5 text-gardens-txm opacity-0 group-hover:opacity-100 transition-all" />
  </button>
);

const ChatTool = ({ icon, onClick }: { icon: React.ReactNode, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="p-2.5 hover:bg-gardens-bdr rounded-xl text-gardens-txs hover:text-gardens-tx transition-all shadow-sm bg-white border border-gardens-bdr active:scale-90"
  >
    {icon}
  </button>
);

export default TeamChat;
