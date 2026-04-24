
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Clock, AlertCircle, CheckCircle2, 
  Timer, Truck, FileCheck, Zap, Flag, 
  ArrowRight, PlayCircle, Lock, MessageSquare, AlertTriangle,
  Hammer, MousePointer2, Briefcase
} from 'lucide-react';
import { Order, MainStatus, StoneStatus, ProofStatus } from '@/shared/types/prototype.types';
import { DUMMY_ORDERS } from '@/shared/lib/prototypeConstants';
import OrderDetailsSidePanel from '@/modules/orders/components/OrderDetailsSidePanel';
import { formatGbpDecimal } from '@/shared/lib/formatters';

interface OrdersDashboardProps {
  navigatedOrderId?: string | null;
  onClearNavigation?: () => void;
}

const OrdersDashboard: React.FC<OrdersDashboardProps> = ({ navigatedOrderId, onClearNavigation }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'stalled' | 'client' | 'production' | 'install'>('all');

  useEffect(() => {
    if (navigatedOrderId) {
      const order = DUMMY_ORDERS.find(o => o.id === navigatedOrderId);
      if (order) setSelectedOrder(order);
      if (onClearNavigation) onClearNavigation();
    }
  }, [navigatedOrderId, onClearNavigation]);

  // Workflow Logic: Determine "Next Action" for each order
  const getNextAction = (order: Order) => {
    const total = order.baseValue + order.permitCost;
    const depositRequired = total * 0.5;

    if (order.paidAmount < depositRequired) return { label: "Request Deposit", icon: <Lock className="w-3 h-3" />, priority: 'high', type: 'finance' };
    if (order.proofStatus === ProofStatus.NOT_RECEIVED) return { label: "Send Inscription Form", icon: <MessageSquare className="w-3 h-3" />, priority: 'medium', type: 'client' };
    if (order.proofStatus === ProofStatus.IN_PROGRESS) return { label: "Finalize Proof", icon: <Zap className="w-3 h-3" />, priority: 'medium', type: 'design' };
    if (order.mainStatus === MainStatus.PENDING) return { label: "Chase Permit", icon: <FileCheck className="w-3 h-3" />, priority: 'high', type: 'admin' };
    if (order.stoneStatus !== StoneStatus.ONSITE) return { label: "Check Delivery", icon: <Truck className="w-3 h-3" />, priority: 'low', type: 'logistics' };
    if (order.mainStatus !== MainStatus.INSTALL) return { label: "Schedule Fixing", icon: <Hammer className="w-3 h-3" />, priority: 'high', type: 'install' };
    return { label: "Close Job", icon: <CheckCircle2 className="w-3 h-3" />, priority: 'low', type: 'done' };
  };

  const filteredOrders = useMemo(() => {
    let base = DUMMY_ORDERS.filter(o => 
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.deceasedName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (activeFilter === 'stalled') return base.filter(o => o.dueInDays < 15);
    if (activeFilter === 'client') return base.filter(o => o.proofStatus === ProofStatus.NOT_RECEIVED || o.paidAmount === 0);
    if (activeFilter === 'production') return base.filter(o => o.stoneStatus === StoneStatus.ONSITE && o.proofStatus === ProofStatus.LETTERED);
    if (activeFilter === 'install') return base.filter(o => o.mainStatus === MainStatus.INSTALL);
    
    return base;
  }, [searchQuery, activeFilter]);

  return (
    <div className="p-4 lg:p-6 xl:p-8 max-w-[1600px] mx-auto space-y-5 xl:space-y-8">
      {/* 1. NEXT ACTION BUCKETS (Dynamic Filtering) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 xl:gap-6">
        <ActionBucket 
          label="Bottlenecks" 
          count={DUMMY_ORDERS.filter(o => o.dueInDays < 15).length}
          sub="72h+ No Progress"
          color="red"
          isActive={activeFilter === 'stalled'}
          onClick={() => setActiveFilter(activeFilter === 'stalled' ? 'all' : 'stalled')}
          icon={<AlertTriangle />}
        />
        <ActionBucket 
          label="Awaiting Client" 
          count={DUMMY_ORDERS.filter(o => o.proofStatus === ProofStatus.NOT_RECEIVED || o.paidAmount === 0).length}
          sub="Proofs / Deposits"
          color="amber"
          isActive={activeFilter === 'client'}
          onClick={() => setActiveFilter(activeFilter === 'client' ? 'all' : 'client')}
          icon={<Clock />}
        />
        <ActionBucket 
          label="Production Ready" 
          count={DUMMY_ORDERS.filter(o => o.stoneStatus === StoneStatus.ONSITE && o.proofStatus === ProofStatus.LETTERED).length}
          sub="Stone Onsite & Lettered"
          color="blue"
          isActive={activeFilter === 'production'}
          onClick={() => setActiveFilter(activeFilter === 'production' ? 'all' : 'production')}
          icon={<Zap />}
        />
        <ActionBucket 
          label="Field Ready" 
          count={DUMMY_ORDERS.filter(o => o.mainStatus === MainStatus.INSTALL).length}
          sub="Scheduled Installs"
          color="green"
          isActive={activeFilter === 'install'}
          onClick={() => setActiveFilter(activeFilter === 'install' ? 'all' : 'install')}
          icon={<Truck />}
        />
      </div>

      {/* 2. SEARCH & TOOLS */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3 lg:p-4 rounded-2xl xl:rounded-[2rem] border border-gardens-bdr shadow-sm">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gardens-txs" />
          <input 
            type="text" 
            placeholder="Search pipeline..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gardens-page border-none rounded-2xl text-sm focus:ring-4 focus:ring-gardens-blu/10 transition-all outline-none"
          />
        </div>
        <div className="flex gap-3">
           <button className="px-6 py-3 bg-gardens-sidebar text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all">
             New Dossier +
           </button>
        </div>
      </div>

      {/* 3. ACTIVE WORKFLOW TABLE */}
      <div className="bg-white border border-gardens-bdr rounded-2xl xl:rounded-[2.5rem] overflow-hidden shadow-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="bg-gardens-page/50 border-b border-gardens-bdr">
            <tr className="text-[10px] font-black text-gardens-txs uppercase tracking-widest">
              <th className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6">Order Identity</th>
              <th className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6">Lifecycle Phase</th>
              <th className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6">Settlement</th>
              <th className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6 hidden lg:table-cell">Workflow Velocity</th>
              <th className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6 text-right">Smart Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredOrders.map((order) => {
              const nextAction = getNextAction(order);
              const total = order.baseValue + order.permitCost;
              const isLocked = order.paidAmount === 0;

              return (
                <tr 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)}
                  className={`group cursor-pointer transition-all ${selectedOrder?.id === order.id ? 'bg-gardens-blu-lt/50' : 'hover:bg-gardens-page/80'}`}
                >
                  <td className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 xl:w-12 xl:h-12 rounded-xl xl:rounded-2xl flex items-center justify-center border transition-all shrink-0 ${isLocked ? 'bg-gardens-page border-gardens-bdr grayscale' : 'bg-white border-gardens-bdr text-gardens-blu-dk shadow-sm'}`}>
                        {isLocked ? <Lock className="w-4 h-4 opacity-40" /> : <Briefcase className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-gardens-tx text-sm xl:text-base group-hover:text-gardens-blu-dk transition-colors truncate">{order.customerName}</p>
                        <p className="text-[10px] font-bold text-gardens-txs uppercase tracking-tighter mt-1">
                          {order.id} • <span className="text-gardens-txs">{order.deceasedName}</span>
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6">
                    <div className="flex items-center gap-1">
                      <WorkflowStep label="Admin" status={order.paidAmount > 0 ? 'done' : 'current'} />
                      <div className="w-4 h-px bg-gardens-bdr mx-1" />
                      <WorkflowStep label="Proof" status={order.proofStatus === ProofStatus.LETTERED ? 'done' : order.proofStatus === ProofStatus.NOT_RECEIVED ? 'todo' : 'current'} />
                      <div className="w-4 h-px bg-gardens-bdr mx-1" />
                      <WorkflowStep label="Stone" status={order.stoneStatus === StoneStatus.ONSITE ? 'done' : 'todo'} />
                      <div className="w-4 h-px bg-gardens-bdr mx-1" />
                      <WorkflowStep label="Site" status={order.mainStatus === MainStatus.INSTALL ? 'current' : 'todo'} />
                    </div>
                  </td>

                  <td className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6">
                    <div className="flex flex-col">
                      <p className="text-xs font-black text-gardens-tx leading-none">{formatGbpDecimal(total)}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-24 h-1.5 bg-gardens-page rounded-full overflow-hidden">
                           <div className="h-full bg-gardens-grn" style={{ width: `${(order.paidAmount/total) * 100}%` }} />
                        </div>
                        <span className="text-[9px] font-black text-gardens-txs uppercase">{Math.round((order.paidAmount/total)*100)}%</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6 hidden lg:table-cell">
                    <div className="flex items-center gap-3">
                       <div className={`flex items-center justify-center w-9 h-9 rounded-xl border-2 ${order.dueInDays < 15 ? 'bg-gardens-red-lt border-gardens-red-lt text-gardens-red-dk' : 'bg-gardens-page border-gardens-bdr text-gardens-txs'}`}>
                          <Timer className="w-4 h-4" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase text-gardens-tx leading-none">{order.dueInDays} Days Left</p>
                          <p className="text-[9px] font-bold text-gardens-txs mt-1 uppercase">8d in status</p>
                       </div>
                    </div>
                  </td>

                  <td className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6 text-right">
                    <button className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                      nextAction.priority === 'high' ? 'bg-gardens-blu text-white shadow-lg shadow-blue-500/20 hover:scale-105' : 'bg-gardens-page text-gardens-tx hover:bg-gardens-bdr'
                    }`}>
                      {nextAction.icon}
                      {nextAction.label}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <OrderDetailsSidePanel 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}
    </div>
  );
};

// UI Components
const ActionBucket = ({ label, count, sub, color, isActive, onClick, icon }: any) => {
  const themes: any = {
    red: 'border-gardens-red-lt text-gardens-red-dk bg-gardens-red-lt/50',
    amber: 'border-gardens-amb-lt text-gardens-amb-dk bg-gardens-amb-lt/50',
    blue: 'border-gardens-blu-lt text-gardens-blu-dk bg-gardens-blu-lt/50',
    green: 'border-gardens-grn-lt text-gardens-grn-dk bg-gardens-grn-lt/50',
  };
  const activeThemes: any = {
    red: 'bg-gardens-red text-white border-gardens-red shadow-xl shadow-red-500/20',
    amber: 'bg-gardens-amb text-white border-gardens-amb shadow-xl shadow-amber-500/20',
    blue: 'bg-gardens-blu text-white border-gardens-blu shadow-xl shadow-blue-500/20',
    green: 'bg-gardens-grn text-white border-gardens-grn shadow-xl shadow-green-500/20',
  };

  return (
    <button 
      onClick={onClick}
      className={`p-4 xl:p-6 rounded-2xl xl:rounded-[2.5rem] border-2 transition-all flex flex-col gap-3 xl:gap-4 group text-left ${isActive ? activeThemes[color] : themes[color] + ' hover:bg-white hover:border-gardens-bdr'}`}
    >
      <div className="flex justify-between items-start">
        <div className={`p-2 xl:p-3 rounded-xl xl:rounded-2xl ${isActive ? 'bg-white/20' : 'bg-white shadow-sm border border-gardens-bdr'}`}>
          {React.cloneElement(icon, { className: `w-4 h-4 xl:w-5 xl:h-5 ${isActive ? 'text-white' : ''}` })}
        </div>
        <span className="text-2xl xl:text-4xl font-black tracking-tighter">{count}</span>
      </div>
      <div>
        <p className={`text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-white/80' : 'text-gardens-txs'}`}>{label}</p>
        <p className={`text-[10px] font-bold ${isActive ? 'text-white/60' : 'text-gardens-txs'}`}>{sub}</p>
      </div>
    </button>
  );
};

const WorkflowStep = ({ label, status }: { label: string, status: 'todo' | 'current' | 'done' }) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-2.5 h-2.5 rounded-full transition-all border-2 ${
        status === 'done' ? 'bg-gardens-grn border-gardens-grn' :
        status === 'current' ? 'bg-gardens-blu border-gardens-blu animate-pulse scale-125' :
        'bg-gardens-page border-gardens-bdr'
      }`} />
      <span className={`text-[7px] font-black uppercase tracking-tighter ${status === 'todo' ? 'text-gardens-txm' : 'text-gardens-tx'}`}>{label}</span>
    </div>
  );
};

export default OrdersDashboard;
