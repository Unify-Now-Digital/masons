
import React from 'react';
import { 
  Inbox, 
  Map as MapIcon, 
  Hammer, 
  ShoppingCart, 
  Users, 
  Package, 
  PenTool, 
  CreditCard, 
  BarChart3, 
  Bell, 
  MessageSquare,
  Zap,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  Settings,
  FileCheck,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isCollapsed, setIsCollapsed }) => {
  const groups = [
    {
      title: "Operations",
      items: [
        { id: 'orders', label: 'Order Pipeline', icon: ShoppingCart },
        { id: 'permits', label: 'Permits', icon: FileCheck },
        { id: 'map', label: 'Field Logistics', icon: MapIcon },
        { id: 'jobs', label: 'Work Orders', icon: Hammer },
        { id: 'inscriptions', label: 'Lettering/AI', icon: PenTool },
      ]
    },
    {
      title: "Communications",
      items: [
        { id: 'inbox', label: 'Unified Inbox', icon: Inbox },
        { id: 'chat', label: 'Team Chat', icon: MessageSquare },
        { id: 'notifications', label: 'Notifications', icon: Bell },
      ]
    },
    {
      title: "Organization",
      items: [
        { id: 'people', label: 'Client Directory', icon: Users },
        { id: 'products', label: 'Stone Inventory', icon: Package },
      ]
    },
    {
      title: "Commercial",
      items: [
        { id: 'payments', label: 'Financials', icon: CreditCard },
        { id: 'reporting', label: 'BI Analytics', icon: BarChart3 },
      ]
    },
    {
      title: "System Admin",
      items: [
        { id: 'roles', label: 'Role Management', icon: ShieldCheck },
        { id: 'settings', label: 'Business Settings', icon: Settings },
      ]
    }
  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-56 xl:w-72'} bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col shadow-2xl z-50 transition-all duration-300 ease-in-out`}>
      <div className={`p-4 xl:p-6 border-b border-slate-100 flex items-center justify-between group h-[65px] xl:h-[85px]`}>
        {!isCollapsed && (
          <div className="animate-in fade-in duration-300">
            <h1 className="text-xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                <Zap className="w-5 h-5 fill-white" />
              </div>
              Mason.ai
            </h1>
          </div>
        )}
        {isCollapsed && (
          <div className="w-full flex justify-center animate-in fade-in duration-300">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl">
              <Zap className="w-6 h-6 fill-white" />
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6 custom-scrollbar space-y-6">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {!isCollapsed && (
              <p className="px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 animate-in fade-in duration-500">{group.title}</p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={isCollapsed ? item.label : ""}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-3 text-sm font-bold rounded-xl transition-all group ${
                    activeTab === item.id 
                      ? 'text-white bg-slate-900 shadow-xl shadow-slate-900/20' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <item.icon className={`w-4 h-4 transition-colors ${activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
                    {!isCollapsed && <span className="animate-in slide-in-from-left-2 duration-300">{item.label}</span>}
                  </div>
                  {!isCollapsed && activeTab === item.id && <ChevronRight className="w-3 h-3 text-white/50" />}
                </button>
              ))}
            </div>
            {!isCollapsed && idx < groups.length - 1 && <div className="h-px bg-slate-50 mx-4 my-4" />}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-4">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-all"
        >
          {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
        
        {!isCollapsed && (
          <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-[10px] text-white">AY</div>
            <div className="overflow-hidden">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest truncate">Administrator</p>
              <p className="text-[10px] font-black text-white truncate">Adam Young</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
