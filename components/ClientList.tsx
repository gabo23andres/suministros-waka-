
import React, { useState } from 'react';
import { Client } from '../types';
import { Search, Users, Plus, Pencil, Trash2, X, MapPin, Phone, Mail, CreditCard, Building } from 'lucide-react';
import { addDocument, updateDocument, deleteDocument } from '../services/firebase';

interface ClientListProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  notify: (type: 'success' | 'error' | 'info' | 'warning', message: string, subMessage?: string) => void;
  logAction: (module: string, action: string, details: string) => void;
}

const ClientList: React.FC<ClientListProps> = ({ clients, setClients, notify, logAction }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Omit<Client, 'id'>>({
      name: '',
      rif: '',
      email: '',
      phone: '',
      address: '',
      creditLimit: 0,
      notes: ''
  });

  const handleSave = () => {
      if (!formData.name || !formData.rif) {
          notify('error', 'Datos requeridos', 'Razón Social y RIF son obligatorios');
          return;
      }

      if (editingId) {
          updateDocument('clients', editingId, formData);
          logAction('CRM', 'UPDATE', `Actualizado cliente: ${formData.name}`);
          notify('success', 'Cliente Actualizado', 'Cambios guardados correctamente.');
      } else {
          const newClient: Client = {
              ...formData,
              id: `cli-${Date.now()}`
          };
          addDocument('clients', newClient);
          logAction('CRM', 'CREATE', `Registrado cliente: ${formData.name}`);
          notify('success', 'Cliente Registrado', 'Añadido a la cartera de clientes.');
      }
      setShowModal(false);
      resetForm();
  };

  const resetForm = () => {
      setFormData({ name: '', rif: '', email: '', phone: '', address: '', creditLimit: 0, notes: '' });
      setEditingId(null);
  };

  const openEdit = (client: Client) => {
      setFormData(client);
      setEditingId(client.id);
      setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
      if (window.confirm('¿Eliminar cliente de la base de datos?')) {
          deleteDocument('clients', id);
          logAction('CRM', 'DELETE', `Eliminado cliente: ${name}`);
          notify('info', 'Cliente Eliminado', 'Registro borrado.');
      }
  };

  const filteredClients = clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.rif.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] space-y-6">
       {/* Header */}
       <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-4">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                   <Users size={24} />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-slate-800">Directorio de Clientes</h3>
                   <p className="text-xs text-slate-500 font-medium">Gestión de cartera y datos fiscales.</p>
               </div>
           </div>
           <button 
               onClick={() => { resetForm(); setShowModal(true); }}
               className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-lg hover:bg-slate-800 transition-all"
           >
               <Plus size={16} /> Nuevo Cliente
           </button>
       </div>

       {/* Filters */}
       <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar por Nombre o RIF..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-none bg-white text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none text-sm shadow-sm transition-all"
            />
       </div>

       {/* Grid List */}
       <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {filteredClients.map(client => (
                   <div key={client.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                       <div className="flex justify-between items-start mb-3">
                           <div>
                               <h4 className="font-bold text-slate-800 text-sm">{client.name}</h4>
                               <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{client.rif}</span>
                           </div>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => openEdit(client)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={14} /></button>
                               <button onClick={() => handleDelete(client.id, client.name)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                           </div>
                       </div>
                       
                       <div className="space-y-2">
                           <div className="flex items-center gap-2 text-xs text-slate-500">
                               <Mail size={12} className="text-slate-400" />
                               <span className="truncate">{client.email || 'Sin correo'}</span>
                           </div>
                           <div className="flex items-center gap-2 text-xs text-slate-500">
                               <Phone size={12} className="text-slate-400" />
                               <span>{client.phone || 'Sin teléfono'}</span>
                           </div>
                           <div className="flex items-start gap-2 text-xs text-slate-500">
                               <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                               <span className="line-clamp-1">{client.address || 'Sin dirección'}</span>
                           </div>
                       </div>

                       <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Crédito</span>
                           <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                               <CreditCard size={12} /> ${client.creditLimit.toFixed(2)}
                           </span>
                       </div>
                   </div>
               ))}
           </div>
       </div>

       {/* Modal */}
       {showModal && (
           <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-slate-100">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <h3 className="font-bold text-slate-800">{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                       <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                   </div>
                   <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                       <div>
                           <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Razón Social</label>
                           <div className="relative">
                               <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                               <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-sm font-bold text-slate-700" placeholder="Nombre de la empresa" />
                           </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">RIF / CI</label>
                               <input type="text" value={formData.rif} onChange={e => setFormData({...formData, rif: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-sm uppercase" placeholder="J-12345678-9" />
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Teléfono</label>
                               <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-sm" placeholder="0414-1234567" />
                           </div>
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Correo Electrónico</label>
                           <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-sm" placeholder="contacto@empresa.com" />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Dirección Fiscal</label>
                           <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-sm resize-none h-20" placeholder="Dirección completa..." />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Límite de Crédito ($)</label>
                               <input type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-sm font-bold" />
                           </div>
                       </div>
                   </div>
                   <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                       <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 font-bold text-xs rounded-lg hover:bg-slate-200">Cancelar</button>
                       <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 shadow-md">Guardar Datos</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default ClientList;
