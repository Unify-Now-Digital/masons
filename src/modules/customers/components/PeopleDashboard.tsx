
import React from 'react';
import { Users, Phone, Mail, MapPin, Building2, Search, Plus } from 'lucide-react';
import { DUMMY_PEOPLE } from '@/shared/lib/prototypeConstants';

const PeopleDashboard: React.FC = () => {
  return (
    <div className="p-4 lg:p-6 xl:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 xl:mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gardens-tx">Directory</h2>
          <p className="text-gardens-txs">Manage customers, workers, and industry partners.</p>
        </div>
        <button className="flex items-center gap-2 bg-gardens-blu text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-gardens-blu-dk transition-colors">
          <Plus className="w-4 h-4" /> Add Person
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6">
        {DUMMY_PEOPLE.map((person) => (
          <div key={person.id} className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-gardens-page rounded-full flex items-center justify-center text-gardens-tx font-bold text-lg">
                {person.name.charAt(0)}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                person.role === 'Worker' ? 'bg-gardens-amb-lt text-gardens-amb-dk' : 
                person.role === 'Customer' ? 'bg-gardens-blu-lt text-gardens-blu-dk' : 'bg-gardens-page text-gardens-tx'
              }`}>
                {person.role}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gardens-tx mb-1">{person.name}</h3>
            <p className="text-xs text-gardens-txs mb-4 font-mono">{person.id}</p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gardens-tx">
                <Mail className="w-4 h-4 text-gardens-txs" />
                <span>{person.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gardens-tx">
                <Phone className="w-4 h-4 text-gardens-txs" />
                <span>{person.phone}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button className="flex-1 py-2 bg-gardens-page text-gardens-tx text-xs font-bold rounded-lg hover:bg-gardens-page transition-colors">
                View History
              </button>
              <button className="px-4 py-2 bg-gardens-blu-lt text-gardens-blu-dk text-xs font-bold rounded-lg hover:bg-gardens-blu-lt transition-colors">
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
