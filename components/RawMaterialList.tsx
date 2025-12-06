
import React, { useState } from 'react';
import { RawMaterial } from '../types';
import { Search, FlaskConical, Plus, Minus, AlertTriangle, Trash2, Pencil, Save, X, Filter } from 'lucide-react';
import { addDocument, updateDocument, deleteDocument } from '../services/firebase';

interface RawMaterialListProps {
  materials: RawMaterial[];
  setMaterials: React.Dispatch<React.SetStateAction<RawMaterial[]>>;
  notify: (type: 'success' | 'error' | 'info' | 'warning', message: string, subMessage?: string) => void;
  logAction: (module: string, action: string, details: string) => void;
}

const RawMaterialList: React.FC<RawMaterialListProps> = ({ materials, setMaterials, notify, logAction }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Omit<RawMaterial, 'id'>>({
      name: '',
      code: '',
      unit: 'KG',
      quantity: 0,
      minLevel: 10,
      cost: 0
  });

  const handleSave = () => {
      if (!formData.name || !formData.code) {
          notify('error', 'Campos requeridos', 'Nombre y Código son obligatorios');
          return;
      }

      if (editingId) {
          updateDocument('raw_materials', editingId, formData);
          logAction('MATERIALS', 'UPDATE', `Actualizado insumo: ${formData.name}`);
          notify('success', 'Material Actualizado', 'Los cambios se han guardado.');
      } else {
          const newMaterial: RawMaterial = {
              ...formData,
              id: `rm-${Date.now()}`
          };
          addDocument('raw_materials', newMaterial);
          logAction('MATERIALS', 'CREATE', `Nuevo insumo: ${formData.name}`);
          notify('success', 'Material Creado', 'Nuevo insumo registrado.');
      }
      setShowModal(false);
      resetForm();
  };

  const resetForm = () => {
      setFormData({ name: '', code: '', unit: 'KG', quantity: 0, minLevel: 10, cost: 0 });
      setEditingId(null);
  };

  const openEdit = (material: RawMaterial) => {
      setFormData(material);
      setEditingId(material.id);
      setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
      if (window.confirm('¿Eliminar insumo?')) {
          deleteDocument('raw_materials', id);
          logAction('MATERIALS', 'DELETE', `Eliminado insumo: ${name}`);
          notify('info', 'Eliminado', 'Insumo removido del inventario.');
      }
  };

  const updateQuantity = (id: string, name: string, delta: number) => {
      const mat = materials.find(m => m.id === id);
      if(!mat) return;
      
      const newQty = Math.max(0, mat.quantity + delta);
      updateDocument('raw_materials', id, { quantity: newQty });
      logAction('MATERIALS', 'ADJUST', `Ajuste manual ${name}: ${delta > 0 ? '+' : ''}${delta}`);
  };

  const filteredMaterials = materials.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] space-y-6">
       {/* Header */}
       <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-4">
               <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                   <FlaskConical size={24} />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-slate-800">Materia Prima</h3>
                   <p className="text-xs text-slate-500 font-medium">Gestión de insumos y suministros base.</p>
               </div>
           </div>
           <div className="flex gap-2 w-full md:w-auto">
               <button 
                   onClick={() => { resetForm(); setShowModal(true); }}
                   className="flex-1 md:flex-none bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-lg hover:bg-slate-800 transition-all"
               >
                   <Plus size={16} /> Nuevo Insumo
               </button>
           </div>
       </div>

       {/* Filters */}
       <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar insumo por nombre o código..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-none bg-white text-slate-700 focus:ring-2 focus:ring-amber-100 outline-none text-sm shadow-sm transition-all"
            />
       </div>

       {/* List */}
       <div className="flex-1 overflow-y-auto bg-white rounded-3xl shadow-sm border border-slate-100 p-4 custom-scrollbar">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {filteredMaterials.map(item => (
                   <div key={item.id} className="p-4 rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all group relative">
                       <div className="flex justify-between items-start mb-2">
                           <div>
                               <h4 className="font-bold text-slate-700">{item.name}</h4>
                               <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.code}</span>
                           </div>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={14} /></button>
                               <button onClick={() => handleDelete(item.id, item.name)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                           </div>
                       </div>
                       
                       <div className="flex items-end justify-between mt-4">
                           <div className="flex flex-col">
                               <span className="text-[10px] uppercase font-bold text-slate-400">Existencia</span>
                               <div className="flex items-center gap-2">
                                   <span className={`text-2xl font-black ${item.quantity <= item.minLevel ? 'text-rose-500' : 'text-slate-800'}`}>
                                       {item.quantity}
                                   </span>
                                   <span className="text-xs font-bold text-slate-500">{item.unit}</span>
                               </div>
                           </div>
                           <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                               <button onClick={() => updateQuantity(item.id, item.name, -1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Minus size={14} /></button>
                               <button onClick={() => updateQuantity(item.id, item.name, 1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Plus size={14} /></button>
                           </div>
                       </div>

                       {item.quantity <= item.minLevel && (
                           <div className="absolute top-4 right-4 animate-pulse">
                               <AlertTriangle size={16} className="text-rose-500" />
                           </div>
                       )}
                   </div>
               ))}
           </div>
       </div>

       {/* Modal */}
       {showModal && (
           <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white rounded-3xl shadow-xl w-full max-w-md animate-fade-in border border-slate-100 overflow-hidden">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <h3 className="font-bold text-slate-800">{editingId ? 'Editar Materia Prima' : 'Nuevo Insumo'}</h3>
                       <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
                   </div>
                   <div className="p-6 space-y-4">
                       <div>
                           <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre</label>
                           <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-amber-400 text-sm" placeholder="Ej. Sulfato de Sodio" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Código</label>
                               <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-amber-400 text-sm font-mono" placeholder="MP-001" />
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Unidad</label>
                               <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value as any})} className="w-full p-3 rounded-xl border border-slate-200 outline-none bg-white text-sm">
                                   <option value="KG">Kilogramos (KG)</option>
                                   <option value="L">Litros (L)</option>
                                   <option value="UND">Unidades (UND)</option>
                                   <option value="SACO">Sacos</option>
                               </select>
                           </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Stock Inicial</label>
                               <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-amber-400 text-sm font-bold" />
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nivel Mínimo</label>
                               <input type="number" value={formData.minLevel} onChange={e => setFormData({...formData, minLevel: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-amber-400 text-sm" />
                           </div>
                       </div>
                   </div>
                   <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                       <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 font-bold text-xs rounded-lg hover:bg-slate-200">Cancelar</button>
                       <button onClick={handleSave} className="px-6 py-2 bg-amber-500 text-white font-bold text-xs rounded-lg hover:bg-amber-600 shadow-md">Guardar</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default RawMaterialList;
