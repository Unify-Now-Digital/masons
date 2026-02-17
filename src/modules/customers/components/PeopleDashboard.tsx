
import React from 'react';
import { Users, Phone, Mail, MapPin, Building2, Search, Plus } from 'lucide-react';
import { DUMMY_PEOPLE } from '@/shared/lib/prototypeConstants';

const PeopleDashboard: React.FC = () => {
  return (
    <div className="p-4 lg:p-6 xl:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 xl:mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Directory</h2>
          <p className="text-slate-500">Manage customers, workers, and industry partners.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Person
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6">
        {DUMMY_PEOPLE.map((person) => (
          <div key={person.id} className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-lg">
                {person.name.charAt(0)}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                person.role === 'Worker' ? 'bg-orange-50 text-orange-600' : 
                person.role === 'Customer' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
              }`}>
                {person.role}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{person.name}</h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">{person.id}</p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{person.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{person.phone}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button className="flex-1 py-2 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors">
                View History
              </button>
              <button className="px-4 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                Contact
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PeopleDashboard;
