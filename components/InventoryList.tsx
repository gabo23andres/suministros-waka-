
import React, { useState, useMemo } from 'react';
import { InventoryItem, SystemSettings } from '../types';
import { Search, Package, AlertTriangle, CheckCircle, XCircle, Plus, Trash2, X, Zap, Minus, Pencil, Clock, Filter, BarChart3, TrendingUp, FileText, Printer, FileDown, ArrowUpDown, ArrowUp, ArrowDown, Layers, Sparkles, DollarSign, Archive, MoreVertical } from 'lucide-react';
import { analyzeInventoryOptimization } from '../services/geminiService';
import { addDocument, updateDocument, deleteDocument } from '../services/firebase';

interface InventoryListProps {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  onAutomate?: (prompt: string) => void;
  exchangeRate: number;
  logAction: (module: string, action: string, details: string) => void;
  settings: SystemSettings;
  notify?: (type: 'success' | 'error' | 'info' | 'warning', message: string, subMessage?: string) => void;
}

const PACK_SIZES = [6, 12, 24, 60];

const InventoryList: React.FC<InventoryListProps> = ({ inventory, setInventory, onAutomate, exchangeRate, logAction, settings, notify }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [abcFilter, setAbcFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showPriceList, setShowPriceList] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Optimization Modal State
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [plSortKey, setPlSortKey] = useState<'name' | 'sku' | 'priceUSD' | 'priceBs'>('name');
  const [plSortDir, setPlSortDir] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState<{
      name: string;
      sku: string;
      category: string;
      quantity: number;
      priceUSD: number;
  }>({
    name: '',
    sku: '',
    category: '',
    quantity: 0,
    priceUSD: 0
  });

  const inventoryWithABC = useMemo(() => {
      const itemsWithValue = inventory.map(item => ({
          ...item,
          totalValue: (item.price / exchangeRate) * item.quantity
      })).sort((a, b) => b.totalValue - a.totalValue);

      const grandTotal = itemsWithValue.reduce((sum, item) => sum + item.totalValue, 0);

      let accumulatedValue = 0;
      return itemsWithValue.map(item => {
          accumulatedValue += item.totalValue;
          const percentage = (accumulatedValue / grandTotal) * 100;
          
          let abcClass: 'A' | 'B' | 'C' = 'C';
          if (percentage <= 80) abcClass = 'A';
          else if (percentage <= 95) abcClass = 'B';
          if (grandTotal === 0) abcClass = 'C';

          return { ...item, abcClass };
      });
  }, [inventory, exchangeRate]);

  // KPI Calculations
  const stats = useMemo(() => {
      const totalItems = inventory.length;
      const lowStockItems = inventory.filter(i => i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK').length;
      const totalValueUSD = inventoryWithABC.reduce((acc, item) => acc + item.totalValue, 0);
      const categoriesCount = new Set(inventory.map(i => i.category)).size;
      return { totalItems, lowStockItems, totalValueUSD, categoriesCount };
  }, [inventory, inventoryWithABC]);

  const uniqueCategories = Array.from(new Set(inventory.map(item => item.category))).sort();
  
  const filteredInventory = inventoryWithABC.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesABC = abcFilter === 'ALL' || item.abcClass === abcFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesABC;
  });

  const inventoryByCategory = useMemo(() => {
      const grouped: Record<string, InventoryItem[]> = {};
      
      inventory.forEach(item => {
          const cat = item.category || 'General';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
      });

      Object.keys(grouped).forEach(cat => {
          grouped[cat].sort((a, b) => {
              let valA: any = a[plSortKey === 'priceUSD' || plSortKey === 'priceBs' ? 'price' : plSortKey as keyof InventoryItem];
              let valB: any = b[plSortKey === 'priceUSD' || plSortKey === 'priceBs' ? 'price' : plSortKey as keyof InventoryItem];

              if (typeof valA === 'string') {
                  valA = valA.toLowerCase();
                  valB = valB.toLowerCase();
              }

              if (valA < valB) return plSortDir === 'asc' ? -1 : 1;
              if (valA > valB) return plSortDir === 'asc' ? 1 : -1;
              return 0;
          });
      });

      return grouped;
  }, [inventory, plSortKey, plSortDir]);

  const handleDelete = (id: string) => {
    if(window.confirm('¿Estás seguro de eliminar este producto?')) {
        deleteDocument('inventory', id);
        logAction('INVENTORY', 'DELETE', `Producto eliminado ID: ${id}`);
    }
  };

  const calculateStatus = (qty: number): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' => {
      if (qty <= 0) return 'OUT_OF_STOCK';
      if (qty < 10) return 'LOW_STOCK';
      return 'IN_STOCK';
  };

  const handleQuickUpdate = (id: string, change: number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newQty = item.quantity + change;
    updateDocument('inventory', id, {
        quantity: newQty,
        status: calculateStatus(newQty)
    });
  };

  const openEditModal = (item: InventoryItem) => {
      setFormData({
          name: item.name,
          sku: item.sku,
          category: item.category,
          quantity: item.quantity,
          priceUSD: Number((item.price / exchangeRate).toFixed(2))
      });
      setEditingId(item.id);
      setShowModal(true);
  };

  const openCreateModal = () => {
      setFormData({ name: '', sku: '', category: '', quantity: 0, priceUSD: 0 });
      setEditingId(null);
      setShowModal(true);
  };

  const handleSaveItem = () => {
    if (!formData.name || !formData.sku || formData.priceUSD === undefined) return;

    const quantity = formData.quantity;
    const status = calculateStatus(quantity);
    const priceInBs = formData.priceUSD * exchangeRate;

    if (editingId) {
        updateDocument('inventory', editingId, {
            name: formData.name,
            sku: formData.sku,
            category: formData.category || 'General',
            price: priceInBs,
            quantity,
            status
        });
        logAction('INVENTORY', 'UPDATE', `Producto actualizado: ${formData.name} (${quantity})`);
    } else {
        const newItem: InventoryItem = {
            id: `inv-${Date.now()}`,
            name: formData.name,
            sku: formData.sku,
            category: formData.category || 'General',
            quantity: quantity,
            price: priceInBs,
            status: status
        };
        addDocument('inventory', newItem);
        logAction('INVENTORY', 'CREATE', `Nuevo producto: ${formData.name}`);
    }

    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', sku: '', category: '', quantity: 0, priceUSD: 0 });
  };

  const triggerAutomation = () => {
      if(onAutomate) {
          onAutomate("Crear un flujo automatizado para monitorear el inventario: Cuando el stock de un producto Clase A baje de 20 unidades, enviar una alerta prioritaria por Email al gerente.");
      }
  }

  const handleOptimize = async () => {
      setIsOptimizing(true);
      setShowOptimizationModal(true);
      setOptimizationResult(null);

      const summary = `
          Total Productos: ${inventory.length}
          Valor Total Inventario: $${inventoryWithABC.reduce((acc, i) => acc + i.totalValue, 0).toFixed(2)}
          Productos Agotados: ${inventory.filter(i => i.status === 'OUT_OF_STOCK').map(i => i.name).join(', ')}
          Stock Bajo: ${inventory.filter(i => i.status === 'LOW_STOCK').length} productos.
          Distribución ABC: Clase A (${inventoryWithABC.filter(i => i.abcClass === 'A').length}), Clase B (${inventoryWithABC.filter(i => i.abcClass === 'B').length}), Clase C (${inventoryWithABC.filter(i => i.abcClass === 'C').length}).
      `;

      const { data, isFallback } = await analyzeInventoryOptimization(summary);
      setOptimizationResult(data);
      setIsOptimizing(false);

      if (isFallback && notify) {
          notify('warning', 'Análisis Offline', 'Servicio de IA no disponible. Mostrando recomendaciones estándar.');
      }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('price-list-content');
    if (!element) return;

    const html2pdf = (window as any).html2pdf;
    if (html2pdf) {
        const opt = {
          margin:       [10, 10],
          filename:     `Lista_Precios_${new Date().toISOString().split('T')[0]}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    } else {
        alert("La librería de PDF no está cargada. Por favor intente nuevamente.");
    }
  };

  const handlePriceListSort = (key: 'name' | 'sku' | 'priceUSD' | 'priceBs') => {
      if (plSortKey === key) {
          setPlSortDir(plSortDir === 'asc' ? 'desc' : 'asc');
      } else {
          setPlSortKey(key);
          setPlSortDir('asc');
      }
  };

  const renderPlSortIcon = (key: string) => {
      if (plSortKey !== key) return <ArrowUpDown size={12} className="ml-1 text-slate-300 opacity-50 group-hover:opacity-100" />;
      return plSortDir === 'asc' 
          ? <ArrowUp size={12} className="ml-1 text-blue-600" />
          : <ArrowDown size={12} className="ml-1 text-blue-600" />;
  };

  const getStatusBadge = (status: string, qty: number) => {
    if (qty < 0) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-600">
                <Clock size={12} /> DEBE: {Math.abs(qty)}
            </span>
        );
    }
    switch (status) {
      case 'IN_STOCK': return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600">
            <CheckCircle size={12} /> OK
        </span>
      );
      case 'LOW_STOCK': return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-600">
            <AlertTriangle size={12} /> BAJO
        </span>
      );
      case 'OUT_OF_STOCK': return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-600">
            <XCircle size={12} /> AGOTADO
        </span>
      );
      default: return null;
    }
  };

  const getAbcBadge = (abc: 'A' | 'B' | 'C') => {
      switch(abc) {
          case 'A': return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-yellow-100 text-yellow-800 border border-yellow-200" title="Alta Importancia (80% Valor)">A</span>;
          case 'B': return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200" title="Media Importancia (15% Valor)">B</span>;
          case 'C': return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200" title="Baja Importancia (5% Valor)">C</span>;
      }
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-6">
      
      {/* Stats KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Package size={24} />
              </div>
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Productos</p>
                  <h4 className="text-xl font-black text-slate-800">{stats.totalItems}</h4>
              </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign size={24} />
              </div>
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor Total</p>
                  <h4 className="text-xl font-black text-slate-800">${stats.totalValueUSD.toLocaleString('en-US', { notation: 'compact' })}</h4>
              </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle size={24} />
              </div>
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock Bajo</p>
                  <h4 className="text-xl font-black text-slate-800">{stats.lowStockItems}</h4>
              </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                  <Layers size={24} />
              </div>
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categorías</p>
                  <h4 className="text-xl font-black text-slate-800">{stats.categoriesCount}</h4>
              </div>
          </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center shrink-0">
          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
              <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar SKU o Nombre..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none text-sm shadow-sm"
                    />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                 <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer hover:bg-slate-50"
                 >
                     <option value="ALL">Todas las Categorías</option>
                     {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                 </select>
                 <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer hover:bg-slate-50"
                 >
                     <option value="ALL">Todos los Estados</option>
                     <option value="IN_STOCK">En Stock</option>
                     <option value="LOW_STOCK">Stock Bajo</option>
                     <option value="OUT_OF_STOCK">Agotado</option>
                 </select>
                 <select 
                    value={abcFilter}
                    onChange={(e) => setAbcFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer hover:bg-slate-50"
                 >
                     <option value="ALL">Clasificación ABC</option>
                     <option value="A">Clase A</option>
                     <option value="B">Clase B</option>
                     <option value="C">Clase C</option>
                 </select>
              </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
                <button 
                    onClick={() => setShowPriceList(true)}
                    className="flex-shrink-0 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-slate-200 text-xs shadow-sm transition-all active:scale-95"
                >
                    <FileText size={16} /> Precios
                </button>
                <button 
                    onClick={handleOptimize}
                    className="flex-shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-xs border border-indigo-100 transition-all active:scale-95"
                >
                    <Sparkles size={16} /> Optimizar
                </button>
                <button 
                    onClick={triggerAutomation}
                    className="flex-shrink-0 bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-xs border border-purple-100 transition-all active:scale-95"
                >
                    <Zap size={16} /> IA
                </button>
                <button 
                    onClick={openCreateModal}
                    className="flex-shrink-0 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-xs shadow-md shadow-slate-200 transition-all active:scale-95"
                >
                    <Plus size={16} /> Nuevo
                </button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
        
        {/* Mobile Cards View */}
        <div className="md:hidden overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {filteredInventory.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                        item.status === 'OUT_OF_STOCK' ? 'bg-rose-500' : 
                        item.status === 'LOW_STOCK' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}></div>
                    
                    <div className="pl-3 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.category}</span>
                                {getAbcBadge(item.abcClass)}
                            </div>
                            <h3 className="font-bold text-slate-800 text-base leading-tight">{item.name}</h3>
                            <p className="text-xs font-mono text-slate-400 mt-1">{item.sku}</p>
                        </div>
                        <button onClick={() => openEditModal(item)} className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                            <MoreVertical size={18} />
                        </button>
                    </div>
                    
                    <div className="pl-3 flex items-center justify-between mt-2 pt-3 border-t border-slate-50">
                         <div className="flex items-center gap-3">
                            <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                                <button onClick={() => handleQuickUpdate(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 active:scale-90 transition-transform"><Minus size={14}/></button>
                                <span className={`w-10 text-center font-black text-sm ${item.quantity <= 0 ? 'text-rose-600' : 'text-slate-800'}`}>{item.quantity}</span>
                                <button onClick={() => handleQuickUpdate(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 active:scale-90 transition-transform"><Plus size={14}/></button>
                            </div>
                         </div>
                         <div className="text-right">
                             <p className="text-emerald-700 font-black text-lg">${(item.price/exchangeRate).toFixed(2)}</p>
                             <p className="text-[10px] text-slate-400 font-bold">Bs. {item.price.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</p>
                         </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 w-1/3">Producto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center">Clasif.</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center">Existencia</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Precio Unitario</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-center">Estado</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInventory.map((item) => (
                <tr 
                    key={item.id} 
                    className="group hover:bg-slate-50/80 transition-colors duration-200"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Package size={20} />
                        </div>
                        <div>
                            <span className="font-bold text-slate-800 block text-sm">{item.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 rounded">{item.sku}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{item.category}</span>
                            </div>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                      {getAbcBadge(item.abcClass)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center">
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm group-hover:border-slate-300 transition-colors">
                            <button 
                                onClick={() => handleQuickUpdate(item.id, -1)}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors active:scale-90"
                            >
                                <Minus size={12} />
                            </button>
                            <span className={`text-sm font-bold min-w-[3ch] text-center px-2 ${
                                item.quantity < 0 ? 'text-purple-600' :
                                item.status === 'IN_STOCK' ? 'text-slate-700' :
                                item.status === 'LOW_STOCK' ? 'text-amber-600' : 'text-rose-600'
                            }`}>
                                {item.quantity}
                            </span>
                            <button 
                                onClick={() => handleQuickUpdate(item.id, 1)}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors active:scale-90"
                            >
                                <Plus size={12} />
                            </button>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-slate-800 font-black text-sm">${(item.price/exchangeRate).toFixed(2)}</div>
                    <div className="text-[11px] text-slate-400 font-medium">Bs. {item.price.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(item.status, item.quantity)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <button 
                            onClick={() => openEditModal(item)}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors hover:bg-blue-50 active:scale-95"
                            title="Editar"
                        >
                            <Pencil size={16} />
                        </button>
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors hover:bg-rose-50 active:scale-95"
                            title="Eliminar"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

       {/* Edit/Create Modal */}
       {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-slate-100 transform transition-all scale-100">
            <div className="p-6 flex justify-between items-center bg-white border-b border-slate-50">
              <div>
                  <h3 className="font-bold text-lg text-slate-800">
                      {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                  </h3>
                  <p className="text-xs text-slate-500">Gestión de catálogo</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre del Producto</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-slate-700 font-medium transition-all text-sm bg-slate-50 focus:bg-white"
                  placeholder="Ej. Router Wi-Fi 6"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">SKU</label>
                    <input 
                        type="text" 
                        value={formData.sku}
                        onChange={(e) => setFormData({...formData, sku: e.target.value})}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none font-mono text-sm bg-slate-50 focus:bg-white"
                        placeholder="WIFI-001"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Categoría</label>
                    <input 
                        type="text" 
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm bg-slate-50 focus:bg-white"
                        placeholder="Redes"
                    />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stock Actual</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            value={formData.quantity}
                            onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-slate-800 text-center"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2 justify-center">
                        {[6, 12, 24].map(size => (
                            <button
                                key={`plus-${size}`}
                                onClick={() => setFormData({...formData, quantity: (formData.quantity || 0) + size})}
                                className="px-2 py-1 bg-white text-emerald-600 rounded-md text-[10px] font-bold hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 active:scale-95 transition-all shadow-sm"
                            >
                                +{size}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Precio ($)</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">$</span>
                        <input 
                        type="number" 
                        min="0"
                        value={formData.priceUSD}
                        onChange={(e) => setFormData({...formData, priceUSD: parseFloat(e.target.value) || 0})}
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-200 outline-none font-bold text-emerald-700 bg-white"
                        placeholder="0.00"
                        />
                    </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-slate-500 font-bold text-xs hover:bg-slate-200 rounded-xl transition-colors active:scale-95"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveItem}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all active:scale-95 flex items-center gap-2"
              >
                <CheckCircle size={14} />
                {editingId ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Optimization Modal */}
      {showOptimizationModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in border border-slate-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white">
                      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                          <Sparkles className="text-indigo-600" size={20} /> Optimización de Inventario
                      </h3>
                      <button onClick={() => setShowOptimizationModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-8 max-h-[60vh] overflow-y-auto bg-slate-50/50">
                      {isOptimizing ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-4">
                              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                              <p className="text-sm font-medium text-slate-500 animate-pulse">Analizando rotación y costos...</p>
                          </div>
                      ) : (
                          <div className="prose prose-sm prose-slate max-w-none">
                              {optimizationResult ? (
                                  optimizationResult.split('\n').map((line, i) => (
                                      <p key={i} className="mb-3 text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                          {line.trim().startsWith('-') || line.trim().startsWith('*') ? (
                                               <span className="font-bold text-indigo-600 mr-2 text-lg">•</span>
                                          ) : null}
                                          {line.replace(/^[-*#]/, '').trim()}
                                      </p>
                                  ))
                              ) : (
                                  <p className="text-slate-400 italic text-center">No se pudo generar el análisis.</p>
                              )}
                          </div>
                      )}
                  </div>
                  <div className="p-6 bg-white border-t border-slate-100 flex justify-end">
                      <button 
                          onClick={() => setShowOptimizationModal(false)}
                          className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 shadow-md transition-all active:scale-95"
                      >
                          Cerrar Reporte
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showPriceList && (
          <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white">
             <div className="bg-white w-full max-w-4xl h-[85vh] overflow-y-auto shadow-2xl relative animate-fade-in print:w-full print:h-screen print:max-w-none print:shadow-none print:rounded-none rounded-none">
                 
                 <div className="sticky top-0 left-0 right-0 bg-slate-800 text-white p-4 flex justify-between items-center print:hidden shadow-lg z-50">
                    <h3 className="font-bold flex items-center gap-2 text-sm"><FileText size={18} /> Lista de Precios al Público</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleDownloadPDF}
                            className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors active:scale-95"
                        >
                            <FileDown size={14} /> PDF
                        </button>
                        <button 
                            onClick={() => window.print()}
                            className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/50 active:scale-95"
                        >
                            <Printer size={14} /> Imprimir
                        </button>
                        <button 
                            onClick={() => setShowPriceList(false)}
                            className="bg-slate-700 hover:bg-slate-600 p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors ml-2 active:scale-95"
                        >
                            <X size={16} />
                        </button>
                    </div>
                 </div>

                 <div id="price-list-content" className="p-16 min-h-full flex flex-col bg-white text-slate-900">
                     <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
                         <div>
                             <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">{settings.companyName}</h1>
                             <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Suministros C.A.</p>
                         </div>
                         <div className="text-right">
                             <h2 className="text-2xl font-bold text-slate-900 uppercase">Lista de Precios</h2>
                             <p className="text-slate-500 text-sm mt-1">Actualizado: {new Date().toLocaleDateString('es-VE')}</p>
                             <p className="text-xs text-slate-400">Tasa de cambio: Bs. {exchangeRate.toFixed(2)}</p>
                         </div>
                     </div>

                     <div className="space-y-8">
                        {Object.keys(inventoryByCategory).sort().map(category => (
                            <div key={category} className="break-inside-avoid">
                                <h3 className="text-lg font-black text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-100 pb-2">{category}</h3>
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th 
                                                onClick={() => handlePriceListSort('sku')}
                                                className="py-2 text-xs font-bold text-slate-400 uppercase tracking-wider w-24 cursor-pointer hover:text-slate-600 group select-none transition-colors"
                                            >
                                                <div className="flex items-center gap-1">SKU {renderPlSortIcon('sku')}</div>
                                            </th>
                                            <th 
                                                onClick={() => handlePriceListSort('name')}
                                                className="py-2 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 group select-none transition-colors"
                                            >
                                                <div className="flex items-center gap-1">Producto {renderPlSortIcon('name')}</div>
                                            </th>
                                            <th 
                                                onClick={() => handlePriceListSort('priceUSD')}
                                                className="py-2 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-32 cursor-pointer hover:text-slate-600 group select-none transition-colors"
                                            >
                                                <div className="flex items-center justify-end gap-1">Precio USD {renderPlSortIcon('priceUSD')}</div>
                                            </th>
                                            <th 
                                                onClick={() => handlePriceListSort('priceBs')}
                                                className="py-2 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-32 cursor-pointer hover:text-slate-600 group select-none transition-colors"
                                            >
                                                <div className="flex items-center justify-end gap-1">Precio Bs. {renderPlSortIcon('priceBs')}</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {inventoryByCategory[category].map((item, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/50 hover:scale-[1.01] transition-all duration-200 cursor-default">
                                                <td className="py-3 text-xs font-mono text-slate-500">{item.sku}</td>
                                                <td className="py-3 text-sm font-bold text-slate-800">{item.name}</td>
                                                <td className="py-3 text-right text-sm font-black text-slate-900">${(item.price/exchangeRate).toFixed(2)}</td>
                                                <td className="py-3 text-right text-sm font-medium text-slate-600">{item.price.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                     </div>

                     <div className="mt-auto pt-10 text-center text-xs text-slate-400 font-medium">
                         <p>Precios sujetos a cambio sin previo aviso. Válido salvo error u omisión.</p>
                         <p>{settings.companyName} - RIF: {settings.rif}</p>
                     </div>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default InventoryList;
