
import React from 'react';
import { AuditLog } from '../types';
import { ShieldAlert, Clock, User, Activity, Search } from 'lucide-react';

interface AuditLogProps {
  logs: AuditLog[];
}

const AuditLogView: React.FC<AuditLogProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredLogs = logs.filter(l => 
      l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] space-y-6">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
           <div className="flex items-center gap-4">
               <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
                   <ShieldAlert size={24} />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-slate-800">Bitácora de Seguridad</h3>
                   <p className="text-xs text-slate-500 font-medium">Auditoría de acciones y cambios en el sistema.</p>
               </div>
           </div>
           <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                    type="text" 
                    placeholder="Filtrar logs..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-slate-800 outline-none w-48 lg:w-64"
                />
           </div>
       </div>

       <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
           <div className="flex-1 overflow-auto custom-scrollbar">
               <table className="w-full text-left border-collapse">
                   <thead className="bg-slate-50 sticky top-0 z-10">
                       <tr>
                           <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Fecha / Hora</th>
                           <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Usuario</th>
                           <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Módulo</th>
                           <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Acción</th>
                           <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Detalles</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                       {filteredLogs.length === 0 ? (
                           <tr>
                               <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">No hay registros de auditoría.</td>
                           </tr>
                       ) : (
                           filteredLogs.map(log => (
                               <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                   <td className="px-6 py-3">
                                       <div className="flex items-center gap-2 text-slate-600 text-xs font-mono">
                                           <Clock size={12} className="text-slate-400" />
                                           {new Date(log.timestamp).toLocaleString('es-VE')}
                                       </div>
                                   </td>
                                   <td className="px-6 py-3">
                                       <div className="flex items-center gap-2">
                                           <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                               {log.user.charAt(0)}
                                           </div>
                                           <div>
                                               <p className="text-xs font-bold text-slate-700">{log.user}</p>
                                               <p className="text-[10px] text-slate-400">{log.role}</p>
                                           </div>
                                       </div>
                                   </td>
                                   <td className="px-6 py-3">
                                       <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                           {log.module}
                                       </span>
                                   </td>
                                   <td className="px-6 py-3">
                                       <span className={`text-xs font-bold ${
                                           log.action.includes('DELETE') || log.action.includes('CANCEL') ? 'text-rose-600' :
                                           log.action.includes('CREATE') ? 'text-emerald-600' :
                                           'text-blue-600'
                                       }`}>
                                           {log.action}
                                       </span>
                                   </td>
                                   <td className="px-6 py-3">
                                       <p className="text-xs text-slate-600 line-clamp-2" title={log.details}>{log.details}</p>
                                   </td>
                               </tr>
                           ))
                       )}
                   </tbody>
               </table>
           </div>
       </div>
    </div>
  );
};

export default AuditLogView;
