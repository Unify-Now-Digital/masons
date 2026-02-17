
import React, { useState, useMemo } from 'react';
import { 
  Bell, CheckCircle2, AlertCircle, Info, Clock, 
  Sparkles, User, ExternalLink, Filter, Trash2, 
  ArrowRight, AlertTriangle, MessageSquare, 
  CreditCard, ShoppingCart, PanelRight, MessageCircle,
  MapPin, Box, UserPlus
} from 'lucide-react';
import { DUMMY_NOTIFICATIONS } from '@/shared/lib/prototypeConstants';
import { AppNotification } from '@/shared/types/prototype.types';

interface NotificationsDashboardProps {
  onNavigateToTab: (tabId: string, resourceId?: string) => void;
  onOpenSidePeek: (tabId: string, resourceId: string) => void;
}

const NotificationsDashboard: React.FC<NotificationsDashboardProps> = ({ onNavigateToTab, onOpenSidePeek }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'alerts' | 'activity' | 'ai'>('all');

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return DUMMY_NOTIFICATIONS;
    return DUMMY_NOTIFICATIONS.filter(n => {
      if (activeFilter === 'alerts') return n.type === 'alert';
      if (activeFilter === 'activity') return n.type === 'activity';
      if (activeFilter === 'ai') return n.type === 'ai';
      return true;
    });
  }, [activeFilter]);

  return (
    <div className="p-4 lg:p-6 xl:p-10 max-w-5xl mx-auto space-y-6 xl:space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div>
          <h2 className="text-2xl xl:text-3xl font-black text-slate-900 tracking-tighter">Notification Center</h2>
          <p className="text-slate-500 font-medium">Monitoring order lifecycle events and internal team activity.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl shadow-inner">
          <FilterTab label="All" active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
          <FilterTab label="Order Alerts" active={activeFilter === 'alerts'} onClick={() => setActiveFilter('alerts')} />
          <FilterTab label="Internal Activity" active={activeFilter === 'activity'} onClick={() => setActiveFilter('activity')} />
          <FilterTab label="AI Agent" active={activeFilter === 'ai'} onClick={() => setActiveFilter('ai')} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl xl:rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((note) => (
              <NotificationRow 
                key={note.id} 
                note={note} 
                onNavigate={() => onNavigateToTab(note.linkedTabId || 'orders', note.linkedResourceId)}
                onOpenSidePeek={onOpenSidePeek}
              />
            ))
          ) : (
            <div className="p-32 text-center flex flex-col items-center justify-center text-slate-300">
               <Bell className="w-16 h-16 opacity-10 mb-6" />
               <p className="text-sm font-black uppercase tracking-widest">No active notifications</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NotificationRow: React.FC<{ 
  note: AppNotification, 
  onNavigate: () => void, 
  onOpenSidePeek: (tabId: string, resourceId: string) => void
}> = ({ note, onNavigate, onOpenSidePeek }) => {
  
  const getIcon = () => {
    if (note.type === 'ai') return <Sparkles className="w-5 h-5 text-blue-500" />;
    if (note.type === 'activity') return <User className="w-5 h-5 text-slate-400" />;
    
    switch (note.status) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getThemeClasses = () => {
    if (note.type === 'ai') return 'bg-blue-50/80 border-blue-100 shadow-blue-900/5';
    if (note.status === 'error') return 'bg-red-50/80 border-red-100 shadow-red-900/5';
    if (note.status === 'warning') return 'bg-orange-50/80 border-orange-100 shadow-orange-900/5';
    if (note.status === 'success') return 'bg-emerald-50/80 border-emerald-100 shadow-emerald-900/5';
    return 'bg-slate-50/80 border-slate-100 shadow-slate-900/5';
  };

  const getMaterialDotColor = (material?: string) => {
    if (!material) return 'bg-slate-200';
    if (material.includes('Black')) return 'bg-slate-900';
    if (material.includes('Light Grey')) return 'bg-slate-300';
    return 'bg-indigo-400';
  };

  // Helper to render text with highlighted entity badges
  const renderMessageWithLinks = (message: string) => {
    const parts = message.split(/(\bORD-\d+|\bP-\d+|\bPAY-\d+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('ORD-')) {
        return (
          <button 
            key={i} 
            onClick={() => onOpenSidePeek('orders', part)}
            className="mx-1 px-1.5 py-0.5 bg-slate-900 text-white rounded text-[9px] font-black uppercase tracking-tighter hover:bg-blue-600 transition-colors inline-flex items-center gap-1"
          >
            <ShoppingCart className="w-2.5 h-2.5" /> {part}
          </button>
        );
      }
      if (part.startsWith('P-')) {
        return (
          <button 
            key={i} 
            onClick={() => onOpenSidePeek('people', part)}
            className="mx-1 px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-black uppercase tracking-tighter hover:bg-indigo-700 transition-colors inline-flex items-center gap-1 shadow-sm"
          >
            <MessageCircle className="w-2.5 h-2.5" /> {part}
          </button>
        );
      }
      if (part.startsWith('PAY-')) {
        return (
          <button 
            key={i} 
            onClick={() => onOpenSidePeek('payments', part)}
            className="mx-1 px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-black uppercase tracking-tighter hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 shadow-sm"
          >
            <CreditCard className="w-2.5 h-2.5" /> {part}
          </button>
        );
      }
      return part;
    });
  };

  const primaryResourceId = note.linkedResourceId;

  return (
    <div className="group flex flex-col px-4 lg:px-6 xl:px-10 py-4 xl:py-8 hover:bg-slate-50/80 transition-all border-l-4 border-transparent hover:border-blue-600">
      <div className="flex items-start xl:items-center gap-4 xl:gap-8">
        <div className={`w-12 h-12 xl:w-16 xl:h-16 rounded-xl xl:rounded-[1.5rem] flex items-center justify-center shrink-0 border-2 ${getThemeClasses()} shadow-lg group-hover:scale-110 transition-transform duration-500`}>
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-sm xl:text-lg font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors truncate">{note.title}</h4>
            {note.author && (
              <span className="text-[9px] font-black uppercase tracking-widest bg-slate-200 text-slate-600 px-2 py-1 rounded-lg">
                  By {note.author}
              </span>
            )}
            <div className="h-1 w-1 rounded-full bg-slate-300 ml-auto" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{note.time}</span>
          </div>
          <div className="text-sm font-medium text-slate-500 leading-relaxed mb-4">
            {renderMessageWithLinks(note.message)}
          </div>

          {/* Context Ribbon: Native Details */}
          {(note.deceasedName || note.cemetery || note.material || note.contactId) && (
            <div className="flex flex-wrap gap-2 items-center mt-2">
              {note.deceasedName && (
                <div className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg flex items-center gap-2 border border-slate-200/50">
                   <UserPlus className="w-3 h-3 text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-tighter">{note.deceasedName}</span>
                </div>
              )}
              {note.cemetery && (
                <div className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg flex items-center gap-2 border border-slate-200/50">
                   <MapPin className="w-3 h-3 text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-tighter">{note.cemetery}</span>
                </div>
              )}
              {note.material && (
                <div className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg flex items-center gap-2 border border-slate-200/50">
                   <div className={`w-2 h-2 rounded-full ${getMaterialDotColor(note.material)}`} />
                   <span className="text-[10px] font-black uppercase tracking-tighter">{note.material}</span>
                </div>
              )}
              {note.contactId && (
                <button 
                  onClick={() => onOpenSidePeek('people', note.contactId!)}
                  className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg flex items-center gap-2 border border-blue-100 hover:bg-blue-100 transition-colors"
                >
                   <MessageCircle className="w-3 h-3" />
                   <span className="text-[10px] font-black uppercase tracking-tighter">Open Conversation</span>
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 shrink-0">
          {primaryResourceId && (
            <button 
              onClick={() => onOpenSidePeek(note.linkedTabId || 'orders', primaryResourceId)}
              title="Open in Side Panel"
              className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
            >
              <PanelRight className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={onNavigate}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-blue-600 transition-all"
          >
            View Dashboard <ArrowRight className="w-4 h-4" />
          </button>
          <button className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-red-500 hover:border-red-100 transition-all shadow-sm">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const FilterTab: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {label}
  </button>
);

export default NotificationsDashboard;
