
import React from 'react';
import { BarChart3, TrendingUp, DollarSign, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const ReportingDashboard: React.FC = () => {
  return (
    <div className="p-4 lg:p-6 xl:p-8">
      <div className="mb-6 xl:mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Business Intelligence</h2>
        <p className="text-slate-500">Performance metrics and financial forecasting.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 xl:gap-6 mb-6 xl:mb-8">
        <StatCard title="Monthly Revenue" value="£42,850" change="+12%" positive={true} />
        <StatCard title="Orders This Month" value="28" change="+5%" positive={true} />
        <StatCard title="Average Order Value" value="£1,530" change="-2%" positive={false} />
        <StatCard title="Pending Payments" value="£18,200" change="" positive={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-8">
        <div className="bg-white border rounded-2xl xl:rounded-3xl p-4 lg:p-6 xl:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" /> Revenue Forecast
          </h3>
          <div className="h-64 flex items-end gap-4 px-4">
            {[45, 60, 55, 80, 70, 95, 85].map((h, i) => (
              <div key={i} className="flex-1 bg-blue-50 rounded-t-xl relative group hover:bg-blue-600 transition-colors">
                <div className="bg-blue-500 rounded-t-xl absolute bottom-0 w-full transition-all group-hover:bg-blue-400" style={{ height: `${h}%` }}></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
          </div>
        </div>

        <div className="bg-white border rounded-2xl xl:rounded-3xl p-4 lg:p-6 xl:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
             <DollarSign className="w-5 h-5 text-green-500" /> Profitability by Category
          </h3>
          <div className="space-y-6">
            <ProgressBar label="New Memorials" value={75} color="bg-blue-500" amount="£32,100" />
            <ProgressBar label="Renovations" value={45} color="bg-orange-500" amount="£8,400" />
            <ProgressBar label="Inscriptions" value={30} color="bg-green-500" amount="£2,350" />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, change, positive }: { title: string, value: string, change: string, positive: boolean }) => (
  <div className="bg-white border rounded-xl xl:rounded-2xl p-4 xl:p-6 shadow-sm">
    <p className="text-[10px] xl:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
    <div className="flex items-baseline gap-2">
      <h4 className="text-lg xl:text-2xl font-bold text-slate-900">{value}</h4>
      {change && (
        <span className={`text-xs font-bold flex items-center ${positive ? 'text-green-600' : 'text-red-600'}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {change}
        </span>
      )}
    </div>
  </div>
);

const ProgressBar = ({ label, value, color, amount }: { label: string, value: number, color: string, amount: string }) => (
  <div>
    <div className="flex justify-between text-sm mb-2">
      <span className="font-bold text-slate-700">{label}</span>
      <span className="font-bold text-slate-900">{amount}</span>
    </div>
    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
    </div>
  </div>
);

export default ReportingDashboard;
