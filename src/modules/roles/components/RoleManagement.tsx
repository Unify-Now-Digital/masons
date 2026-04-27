
import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, Eye, Edit3, UserPlus, 
  Trash2, History, ChevronRight, Info, AlertCircle,
  CheckCircle2, Building, Key, Users
} from 'lucide-react';
import { DUMMY_ROLES, MODULE_LIST, DUMMY_PEOPLE } from '@/shared/lib/prototypeConstants';
import { UserRole, PermissionLevel } from '@/shared/types/prototype.types';

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<UserRole[]>(DUMMY_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState(DUMMY_ROLES[0].id);
  const [isSaving, setIsSaving] = useState(false);

  const selectedRole = roles.find(r => r.id === selectedRoleId)!;

  const handleTogglePermission = (moduleId: string, currentLevel: PermissionLevel) => {
    const levels: PermissionLevel[] = ['NONE', 'READ', 'WRITE'];
    const nextLevel = levels[(levels.indexOf(currentLevel) + 1) % levels.length];
    
    setRoles(prev => prev.map(r => {
      if (r.id !== selectedRoleId) return r;
      return {
        ...r,
        permissions: r.permissions.map(p => 
          p.moduleId === moduleId ? { ...p, level: nextLevel } : p
        )
      };
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  const getLevelIcon = (level: PermissionLevel) => {
    switch (level) {
      case 'WRITE': return <Edit3 className="w-4 h-4 text-gardens-grn" />;
      case 'READ': return <Eye className="w-4 h-4 text-gardens-amb" />;
      default: return <Lock className="w-4 h-4 text-gardens-txm" />;
    }
  };

  const getLevelLabel = (level: PermissionLevel) => {
    switch (level) {
      case 'WRITE': return 'Full Access';
      case 'READ': return 'View Only';
      default: return 'No Access';
    }
  };

  const teamWithThisRole = DUMMY_PEOPLE.filter(p => p.roleId === selectedRoleId);

  return (
    <div className="p-4 lg:p-6 xl:p-8 max-w-[1400px] mx-auto space-y-5 xl:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h2 className="text-2xl xl:text-3xl font-black text-gardens-tx tracking-tighter">Identity & Access</h2>
          <p className="text-gardens-txs font-medium">Control module visibility and data security across the organization.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-3 bg-white border border-gardens-bdr text-gardens-tx rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-gardens-page">
            Audit Logs
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-gardens-sidebar text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all flex items-center gap-2"
          >
            {isSaving ? <History className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSaving ? 'Updating Policies...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 xl:gap-8">
        {/* Roles List */}
        <div className="space-y-4">
          <p className="px-2 text-[10px] font-black text-gardens-txs uppercase tracking-widest mb-4">Functional Roles</p>
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`w-full text-left p-4 xl:p-6 rounded-2xl xl:rounded-[2rem] border-2 transition-all group ${
                selectedRoleId === role.id 
                  ? 'bg-gardens-sidebar border-gardens-bdr2 text-white shadow-xl' 
                  : 'bg-white border-gardens-bdr hover:border-gardens-bdr'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-xl ${selectedRoleId === role.id ? 'bg-white/10' : 'bg-gardens-page'}`}>
                  <ShieldCheck className={`w-5 h-5 ${selectedRoleId === role.id ? 'text-gardens-blu' : 'text-gardens-txs'}`} />
                </div>
              </div>
              <h3 className="text-sm font-black mb-1">{role.name}</h3>
              <p className={`text-[11px] font-medium leading-relaxed ${selectedRoleId === role.id ? 'text-white/60' : 'text-gardens-txs'}`}>
                {role.description}
              </p>
            </button>
          ))}
          <button className="w-full p-4 border-2 border-dashed border-gardens-bdr rounded-[2rem] text-gardens-txs text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gardens-page transition-all">
             <UserPlus className="w-4 h-4" /> Create Custom Role
          </button>
        </div>

        {/* Permissions Grid */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white border border-gardens-bdr rounded-2xl xl:rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="px-4 lg:px-6 xl:px-8 py-4 xl:py-6 bg-gardens-page border-b border-gardens-bdr flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
               <h3 className="text-sm font-black text-gardens-tx uppercase tracking-widest">
                 {selectedRole.name} Permissions Matrix
               </h3>
               <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gardens-grn" />
                    <span className="text-[9px] font-black text-gardens-txs uppercase">Write</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gardens-amb" />
                    <span className="text-[9px] font-black text-gardens-txs uppercase">Read</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gardens-bdr" />
                    <span className="text-[9px] font-black text-gardens-txs uppercase">None</span>
                  </div>
               </div>
            </div>

            <div className="divide-y divide-slate-50">
               {MODULE_LIST.map((module) => {
                 const perm = selectedRole.permissions.find(p => p.moduleId === module.id)!;
                 return (
                   <div key={module.id} className="group flex items-center justify-between px-4 lg:px-6 xl:px-8 py-4 xl:py-6 hover:bg-gardens-page/50 transition-all">
                      <div className="flex items-center gap-3 xl:gap-5">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                           perm.level === 'WRITE' ? 'bg-gardens-grn-lt text-gardens-grn-dk' : 
                           perm.level === 'READ' ? 'bg-gardens-amb-lt text-gardens-amb-dk' : 'bg-gardens-page text-gardens-txs opacity-40'
                         }`}>
                           {perm.level === 'WRITE' ? <Edit3 className="w-5 h-5" /> : 
                            perm.level === 'READ' ? <Eye className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                         </div>
                         <div>
                            <p className="text-sm font-black text-gardens-tx tracking-tight">{module.name}</p>
                            <p className="text-[10px] font-bold text-gardens-txs uppercase tracking-tighter mt-0.5">Application Core Component</p>
                         </div>
                      </div>

                      <div className="flex items-center gap-8">
                         <div className="text-right">
                            <p className={`text-[10px] font-black uppercase tracking-widest ${
                              perm.level === 'WRITE' ? 'text-gardens-grn-dk' : 
                              perm.level === 'READ' ? 'text-gardens-amb-dk' : 'text-gardens-txs'
                            }`}>{getLevelLabel(perm.level)}</p>
                            <p className="text-[9px] font-bold text-gardens-txm mt-0.5">Effective across all devices</p>
                         </div>
                         <button 
                           onClick={() => handleTogglePermission(module.id, perm.level)}
                           className="p-3 bg-white border border-gardens-bdr rounded-xl text-gardens-txs hover:text-gardens-tx hover:border-gardens-bdr transition-all shadow-sm active:scale-90"
                         >
                            <ChevronRight className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                 );
               })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:gap-8">
             <div className="bg-gardens-page border border-gardens-bdr rounded-2xl xl:rounded-[2.5rem] p-5 xl:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Users className="w-5 h-5 text-gardens-txs" />
                  <h3 className="text-[11px] font-black text-gardens-tx uppercase tracking-widest">Assigned Team Members</h3>
                </div>
                <div className="space-y-4">
                   {teamWithThisRole.length > 0 ? teamWithThisRole.map(member => (
                     <div key={member.id} className="flex items-center justify-between p-4 bg-white border border-gardens-bdr rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gardens-sidebar flex items-center justify-center text-white text-[10px] font-black">
                            {member.name.charAt(0)}
                          </div>
                          <span className="text-xs font-black text-gardens-tx">{member.name}</span>
                        </div>
                        <button className="text-[10px] font-black text-gardens-txs hover:text-gardens-red uppercase tracking-widest transition-colors">Reassign</button>
                     </div>
                   )) : (
                     <div className="py-12 text-center text-gardens-txm">
                        <p className="text-[10px] font-black uppercase tracking-widest">No team members assigned</p>
                     </div>
                   )}
                   <button className="w-full py-4 border-2 border-dashed border-gardens-bdr rounded-2xl text-[10px] font-black text-gardens-txs uppercase tracking-widest hover:bg-white transition-all">
                      + Add Member to Role
                   </button>
                </div>
             </div>

             <div className="bg-gardens-blu rounded-2xl xl:rounded-[2.5rem] p-6 xl:p-10 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 blur-[100px] rounded-full -mr-20 -mt-20" />
                <div className="relative z-10">
                   <Key className="w-10 h-10 mb-6 text-gardens-blu-lt" />
                   <h4 className="text-2xl font-black tracking-tight mb-4">Security Lockdown</h4>
                   <p className="text-gardens-blu-lt text-sm font-medium leading-relaxed mb-8">
                     Instantly revoke all access for this role across every terminal and session. Use this in case of suspected breach.
                   </p>
                   <button className="px-8 py-4 bg-white text-gardens-blu-dk rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">
                     Emergency Access Cutoff
                   </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;
