import React, { useState } from 'react';
import { ProductionOrder, InventoryItem, RawMaterial } from '../types';
import { Factory, Plus, Calendar, CheckCircle, AlertCircle, X, ChevronRight, PackageCheck, Droplets, Trash2, Play } from 'lucide-react';
import { addDocument, updateDocument } from '../services/firebase';

interface ProductionPlanProps {
  productionOrders: ProductionOrder[];
  setProductionOrders: React.Dispatch<React.SetStateAction<ProductionOrder[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  materials: RawMaterial[];
  setMaterials: React.Dispatch<React.SetStateAction<RawMaterial[]>>;
  notify: (type: 'success' | 'error' | 'info' | 'warning', message: string, subMessage?: string) => void;
  logAction: (module: string, action: string, details: string) => void;
}

const ProductionPlan: React.FC<ProductionPlanProps> = ({ 
    productionOrders, setProductionOrders, inventory, setInventory, materials, setMaterials, notify, logAction 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  
  // Creation Form
  const [newOrderProduct, setNewOrderProduct] = useState('');
  const [newOrderQty, setNewOrderQty] = useState(0);

  // Execution Form
  const [materialToAdd, setMaterialToAdd] = useState('');
  const [qtyToAdd, setQtyToAdd] = useState(0);

  const handleCreateOrder = () => {
      if (!newOrderProduct || newOrderQty <= 0) {
          notify('error', 'Datos inválidos', 'Seleccione un producto y cantidad válida.');
          return;
      }
      
      const product = inventory.find(i => i.id === newOrderProduct);
      if (!product) return;

      const newOrder: ProductionOrder = {
          id: `PO-${Date.now()}`,
          date: new Date().toISOString(),
          targetProductId: product.id,
          targetProductName: product.name,
          quantityTarget: newOrderQty,
          status: 'PLANNED',
          consumedMaterials: []
      };

      addDocument('production_orders', newOrder);
      logAction('PRODUCTION', 'CREATE', `Orden planificada: ${newOrderQty} ${product.name}`);
      notify('success', 'Plan Creado', `Orden de producción para ${newOrderQty} ${product.name}.`);
      setShowModal(false);
      setNewOrderProduct('');
      setNewOrderQty(0);
  };

  const handleAddMaterialToOrder = () => {
      if (!selectedOrder || !materialToAdd || qtyToAdd <= 0) return;
      
      const mat = materials.find(m => m.id === materialToAdd);
      if (!mat) return;

      const updatedOrder = {
          ...selectedOrder,
          consumedMaterials: [
              ...selectedOrder.consumedMaterials,
              { materialId: mat.id, materialName: mat.name, quantity: qtyToAdd }
          ]
      };

      updateDocument('production_orders', selectedOrder.id, updatedOrder);
      setSelectedOrder(updatedOrder);
      setMaterialToAdd('');
      setQtyToAdd(0);
  };

  const handleCompleteProduction = () => {
      if (!selectedOrder) return;

      // 1. Verify Raw Material Stock
      for (const consumed of selectedOrder.consumedMaterials) {
          const stockMat = materials.find(m => m.id === consumed.materialId);
          if (!stockMat || stockMat.quantity < consumed.quantity) {
              notify('error', 'Stock Insuficiente', `Falta materia prima: ${consumed.materialName}`);
              return;
          }
      }

      // 2. Deduct Raw Materials
      selectedOrder.consumedMaterials.forEach(consumed => {
          const stockMat = materials.find(m => m.id === consumed.materialId);
          if (stockMat) {
              updateDocument('raw_materials', stockMat.id, { quantity: stockMat.quantity - consumed.quantity });
          }
      });

      // 3. Add Finished Product
      const finishedProduct = inventory.find(i => i.id === selectedOrder.targetProductId);
      if (finishedProduct) {
          const newQty = finishedProduct.quantity + selectedOrder.quantityTarget;
          updateDocument('inventory', finishedProduct.id, { 
              quantity: newQty,
              status: newQty > 10 ? 'IN_STOCK' : 'LOW_STOCK'
          });
      }

      // 4. Update Order Status
      const completedOrder = { ...selectedOrder, status: 'COMPLETED' as const };
      updateDocument('production_orders', selectedOrder.id, { status: 'COMPLETED' });
      setSelectedOrder(null);
      logAction('PRODUCTION', 'COMPLETE', `Producción finalizada: ${selectedOrder.targetProductName} (${selectedOrder.quantityTarget})`);
      notify('success', 'Producción Finalizada', 'Inventarios actualizados correctamente.');
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'PLANNED': return 'bg-blue-50 text-blue-600 border-blue-200';
          case 'IN_PROGRESS': return 'bg-amber-50 text-amber-600 border-amber-200';
          case 'COMPLETED': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
          default: return 'bg-slate-50 text-slate-500';
      }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] space-y-6">
        {/* Header */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                    <Factory size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Plan de Producción</h3>
                    <p className="text-xs text-slate-500 font-medium">Fabricación y consumo de materia prima.</p>
                </div>
            </div>
            <button 
                onClick={() => setShowModal(true)}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-lg hover:bg-slate-800 transition-all"
            >
                <Plus size={16} /> Nueva Orden
            </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-white rounded-3xl shadow-sm border border-slate-100 p-4 custom-scrollbar">
            <div className="space-y-4">
                {productionOrders.map(order => (
                    <div key={order.id} className="border border-slate-100 rounded-2xl p-4 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                             <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-xl border ${getStatusColor(order.status)}`}>
                                     {order.status === 'COMPLETED' ? <CheckCircle size={20} /> : <Calendar size={20} />}
                                 </div>
                                 <div>
                                     <h4 className="font-bold text-slate-800">{order.targetProductName}</h4>
                                     <p className="text-xs text-slate-500">Cantidad: {order.quantityTarget} UNIDADES</p>
                                 </div>
                             </div>
                             <div className="flex items-center gap-2">
                                 <span className={`px-2 py-1 rounded text-[10px] font-bold ${getStatusColor(order.status)}`}>
                                     {order.status}
                                 </span>
                                 {order.status !== 'COMPLETED' && (
                                     <button 
                                        onClick={() => setSelectedOrder(order)}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                     >
                                         <ChevronRight size={16} />
                                     </button>
                                 )}
                             </div>
                        </div>
                    </div>
                ))}
                {productionOrders.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">No hay órdenes de producción activas.</div>
                )}
            </div>
        </div>

        {/* Create Modal */}
        {showModal && (
            <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-xl w-full max-w-md animate-fade-in border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">Planificar Producción</h3>
                        <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Producto Objetivo</label>
                            <select 
                                value={newOrderProduct}
                                onChange={(e) => setNewOrderProduct(e.target.value)}
                                className="w-full p-3 rounded-xl border border-slate-200 outline-none bg-white text-sm"
                            >
                                <option value="">Seleccionar...</option>
                                {inventory.map(i => (
                                    <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cantidad a Producir</label>
                            <input 
                                type="number" 
                                value={newOrderQty}
                                onChange={(e) => setNewOrderQty(Number(e.target.value))}
                                className="w-full p-3 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 font-bold text-xs rounded-lg hover:bg-slate-200">Cancelar</button>
                        <button onClick={handleCreateOrder} className="px-6 py-2 bg-purple-600 text-white font-bold text-xs rounded-lg hover:bg-purple-700 shadow-md">Crear Orden</button>
                    </div>
                </div>
            </div>
        )}

        {/* Execution Modal */}
        {selectedOrder && (
            <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg animate-fade-in border border-slate-100 overflow-hidden">
                     <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h3 className="font-bold text-slate-800">Ejecución de Orden</h3>
                            <p className="text-xs text-slate-500">{selectedOrder.targetProductName} ({selectedOrder.quantityTarget})</p>
                        </div>
                        <button onClick={() => setSelectedOrder(null)}><X size={20} className="text-slate-400" /></button>
                    </div>
                    
                    <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Materiales Consumidos</h4>
                            <div className="space-y-2 mb-4">
                                {selectedOrder.consumedMaterials.map((m, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                                        <span className="text-sm font-bold text-slate-700">{m.materialName}</span>
                                        <span className="text-xs font-mono text-slate-500">{m.quantity} Consumidos</span>
                                    </div>
                                ))}
                                {selectedOrder.consumedMaterials.length === 0 && <p className="text-xs text-slate-400 italic">No se han registrado materiales.</p>}
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <h4 className="text-xs font-bold text-blue-600 uppercase mb-2">Agregar Consumo</h4>
                                <div className="flex gap-2 mb-2">
                                    <select 
                                        value={materialToAdd}
                                        onChange={(e) => setMaterialToAdd(e.target.value)}
                                        className="flex-1 p-2 rounded-lg border border-blue-200 text-xs outline-none bg-white"
                                    >
                                        <option value="">Seleccionar Insumo...</option>
                                        {materials.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} ({m.quantity} {m.unit})</option>
                                        ))}
                                    </select>
                                    <input 
                                        type="number"
                                        placeholder="Cant."
                                        value={qtyToAdd || ''}
                                        onChange={(e) => setQtyToAdd(Number(e.target.value))}
                                        className="w-20 p-2 rounded-lg border border-blue-200 text-xs outline-none"
                                    />
                                </div>
                                <button 
                                    onClick={handleAddMaterialToOrder}
                                    className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700"
                                >
                                    Registrar Consumo
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                         <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 text-slate-500 font-bold text-xs rounded-lg hover:bg-slate-200">Cerrar</button>
                         <button 
                            onClick={handleCompleteProduction}
                            className="px-6 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 shadow-md flex items-center gap-2"
                         >
                            <PackageCheck size={16} /> Finalizar Producción
                         </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ProductionPlan;