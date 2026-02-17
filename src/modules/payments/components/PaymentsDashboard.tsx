
import React, { useState, useMemo } from 'react';
import { CreditCard, DollarSign, ArrowUpRight, CheckCircle2, Clock, Search, ShieldCheck, Zap, ArrowRight, Download, Plus, Settings, ExternalLink, Calculator, PieChart } from 'lucide-react';
import { DUMMY_PAYMENTS, DUMMY_ORDERS } from '@/shared/lib/prototypeConstants';

interface PaymentsDashboardProps {
  onViewOrder: (orderId: string) => void;
}

const PaymentsDashboard: React.FC<PaymentsDashboardProps> = ({ onViewOrder }) => {
  const [showStripeModal, setShowStripeModal] = useState(false);

  // Calculate global financial metrics from the live order data
  const { totalValue, totalPaid, totalBalance } = useMemo(() => {
    return DUMMY_ORDERS.reduce((acc, order) => {
      const total = order.baseValue + order.permitCost;
      const paid = order.paidAmount;
      return {
        totalValue: acc.totalValue + total,
        totalPaid: acc.totalPaid + paid,
        totalBalance: acc.totalBalance + (total - paid)
      };
    }, { totalValue: 0, totalPaid: 0, totalBalance: 0 });
  }, []);

  return (
    <div className="p-4 lg:p-6 xl:p-10 max-w-[1600px] mx-auto space-y-6 xl:space-y-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl xl:text-4xl font-black text-slate-900 tracking-tighter">Financial Ledger</h2>
            <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 flex items-center gap-1.5 shadow-sm">
              <Zap className="w-3.5 h-3.5 fill-indigo-600" /> Powered by Stripe
            </div>
          </div>
          <p className="text-slate-500 font-medium">Monitoring masonry receivables, merchant payouts, and digital invoicing.</p>
        </div>
        
        <div className="flex items-center gap-4 xl:gap-8 flex-wrap">
           <div className="flex flex-col items-end">
             <p className="text-[10px] xl:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Contract Value</p>
             <span className="text-xl xl:text-3xl font-black text-slate-900 tracking-tighter">£{totalValue.toLocaleString()}</span>
           </div>
           <div className="w-px h-10 bg-slate-200" />
           <div className="flex flex-col items-end">
             <p className="text-[10px] xl:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 text-green-600">Total Collected</p>
             <div className="flex items-center gap-2">
                <span className="text-xl xl:text-3xl font-black text-green-600 tracking-tighter">£{totalPaid.toLocaleString()}</span>
                <div className="p-1 bg-green-50 rounded-lg text-green-600"><ArrowUpRight className="w-3.5 h-3.5" /></div>
             </div>
           </div>
           <div className="w-px h-10 bg-slate-200" />
           <div className="flex flex-col items-end">
             <p className="text-[10px] xl:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 text-orange-500">Outstanding Balance</p>
             <span className="text-xl xl:text-3xl font-black text-orange-500 tracking-tighter">£{totalBalance.toLocaleString()}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 xl:gap-10">
         <div className="bg-slate-900 rounded-2xl xl:rounded-[3rem] p-6 xl:p-10 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/30 blur-[100px] rounded-full -mr-20 -mt-20 group-hover:opacity-100 transition-opacity opacity-50" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6 xl:mb-12">
                <div className="w-16 h-10 bg-white/10 backdrop-blur rounded-xl border border-white/20 flex items-center justify-center">
                  <div className="w-10 h-6 bg-indigo-500/50 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Verified Merchant</span>
                </div>
              </div>
              <p className="text-sm font-black text-white/50 uppercase tracking-widest mb-1">Available for Payout</p>
              <h4 className="text-3xl xl:text-5xl font-black tracking-tighter">£{(totalPaid * 0.9).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
              <p className="text-xs text-white/30 font-medium mt-4">Calculated from <span className="text-white/70">settled transactions</span> minus fees.</p>
            </div>
            <div className="relative z-10 mt-8 xl:mt-16 flex justify-between items-center">
               <button className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-xl">
                 Transfer to Bank
               </button>
               <span className="text-xs font-mono font-bold text-white/60">acct_1NZ4qW...</span>
            </div>
         </div>
         
         <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 xl:gap-8">
            <ActionCard icon={<Plus />} title="Create Payment Link" desc="Generate a secure Stripe Checkout link for deposit collections." color="blue" onClick={() => setShowStripeModal(true)} />
            <ActionCard icon={<DollarSign />} title="Virtual Terminal" desc="Securely process credit card payments over the phone." color="indigo" />
            <ActionCard icon={<CreditCard />} title="Invoicing Flow" desc="Send branded PDF invoices with one-click payment buttons." color="slate" />
            <ActionCard icon={<Calculator />} title="Financial Audit" desc="Export ledger data for HMRC and VAT reporting." color="slate" />
         </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl xl:rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="px-4 lg:px-6 xl:px-10 py-4 xl:py-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/30">
           <h3 className="text-lg xl:text-xl font-black text-slate-900 tracking-tight">Financial Stream</h3>
           <div className="flex gap-4">
             <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search tx_id, payer..." className="pl-12 pr-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium w-64 focus:ring-4 focus:ring-blue-500/5 transition-all" />
             </div>
             <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-all"><Download className="w-5 h-5" /></button>
           </div>
        </div>
        
        <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            <tr>
              <th className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6">Payer</th>
              <th className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6">Reference</th>
              <th className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6">Total / Paid</th>
              <th className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6">Balance</th>
              <th className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6 text-right">Settlement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {DUMMY_ORDERS.map((order) => {
              const total = order.baseValue + order.permitCost;
              const paid = order.paidAmount;
              const balance = total - paid;
              return (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-all group cursor-pointer" onClick={() => onViewOrder(order.id)}>
                  <td className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 xl:w-12 xl:h-12 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-600 text-sm shrink-0">{order.customerName.charAt(0)}</div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate">{order.customerName}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">{order.deceasedName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6">
                    <span className="font-mono text-[11px] font-bold text-indigo-500 bg-indigo-50/50 px-2 py-1 rounded-lg">{order.id}</span>
                  </td>
                  <td className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6">
                    <p className="text-xs font-black text-slate-900">£{total.toLocaleString()}</p>
                    <p className="text-[10px] text-green-600 font-bold uppercase mt-0.5">Paid: £{paid.toLocaleString()}</p>
                  </td>
                  <td className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6">
                    <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      balance === 0 ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-orange-50 text-orange-600 border border-orange-100'
                    }`}>
                      {balance === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Calculator className="w-3.5 h-3.5" />}
                      {balance === 0 ? 'Settled' : `£${balance.toLocaleString()}`}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 xl:px-10 py-4 xl:py-6 text-right">
                    <span className="text-base xl:text-lg font-black text-slate-900">£{paid.toLocaleString()}</span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Latest Capture</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {showStripeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-12 overflow-hidden relative">
              <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/30"><Zap className="w-10 h-10 text-white fill-white" /></div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 leading-tight">Create Stripe Checkout Link</h3>
              <p className="text-slate-500 font-medium mb-10 text-lg leading-relaxed">Unique session for ORD-000017. Customer pays via Card, Apple Pay, or Google Pay.</p>
              <div className="space-y-4">
                 <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Amount</p>
                    <p className="text-2xl font-black text-slate-900">£1,280.00</p>
                 </div>
                 <button onClick={() => setShowStripeModal(false)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">Create & Send <ArrowRight className="w-5 h-5" /></button>
                 <button onClick={() => setShowStripeModal(false)} className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest transition-all">Cancel</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const ActionCard = ({ icon, title, desc, color, onClick }: any) => {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-300',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300'
  };
  return (
    <button onClick={onClick} className={`flex flex-col items-start p-5 xl:p-10 rounded-2xl xl:rounded-[2.5rem] border-2 transition-all group text-left h-full ${colorMap[color]}`}>
      <div className="p-3 xl:p-4 rounded-xl xl:rounded-2xl bg-white shadow-xl mb-4 xl:mb-6 group-hover:scale-110 transition-transform duration-500">{React.cloneElement(icon as any, { className: 'w-6 h-6 xl:w-8 xl:h-8' })}</div>
      <h4 className="text-base xl:text-xl font-black text-slate-900 mb-1 xl:mb-2">{title}</h4>
      <p className="text-xs xl:text-sm font-medium text-slate-500 leading-relaxed">{desc}</p>
    </button>
  );
};

export default PaymentsDashboard;
