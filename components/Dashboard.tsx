
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';
import { Activity, TrendingUp, Package, DollarSign, Zap, CheckCircle, AlertTriangle, ArrowRight, TrendingDown, ClipboardList, Plus, Trash2, Download, X, Users, Trophy, Coins, History, Clock } from 'lucide-react';
import { Order, OrderStatus, InventoryItem, Task, Client, AuditLog } from '../types';

interface DashboardProps {
  orders: Order[];
  inventory: InventoryItem[];
  exchangeRate: number;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  clients: Client[];
  auditLogs?: AuditLog[];
}

const Dashboard: React.FC<DashboardProps> = ({ orders, inventory, exchangeRate, tasks, setTasks, clients, auditLogs = [] }) => {
  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState<{ title: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }>({ title: '', priority: 'MEDIUM' });

  // OPTIMIZATION: Memoize heavy calculations
  const stats = useMemo(() => {
      const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== OrderStatus.CANCELED && o.status !== OrderStatus.FAILED ? o.total : 0), 0);
      const totalRevenueUSD = totalRevenue / exchangeRate;
      
      const activeOrders = orders.filter(o => o.status === OrderStatus.PROCESSING || o.status === OrderStatus.PENDING).length;
      
      const inventoryValue = inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const inventoryValueUSD = inventoryValue / exchangeRate;

      return { totalRevenue, totalRevenueUSD, activeOrders, inventoryValue, inventoryValueUSD };
  }, [orders, inventory, exchangeRate]);

  const topClients = useMemo(() => {
      const revenueByCustomer: Record<string, number> = {};
      orders.forEach(o => {
          if (o.status !== OrderStatus.CANCELED && o.status !== OrderStatus.FAILED) {
              const name = o.customer.split('(')[0].trim();
              revenueByCustomer[name] = (revenueByCustomer[name] || 0) + o.total;
          }
      });
      
      return Object.entries(revenueByCustomer)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, total]) => ({ name, total }));
  }, [orders]);

  const chartData = useMemo(() => {
      const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
      const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d;
      });

      return last7Days.map(date => {
          const dateStr = date.toISOString().split('T')[0];
          const dailyOrders = orders.filter(o => o.date.startsWith(dateStr) && o.status !== OrderStatus.CANCELED);
          const dailyRevenue = dailyOrders.reduce((acc, o) => acc + o.total, 0);
          
          return {
              name: days[date.getDay()],
              orders: dailyOrders.length,
              revenue: dailyRevenue,
              revenueUSD: dailyRevenue / exchangeRate
          };
      });
  }, [orders, exchangeRate]);

  // Activity Feed (Latest 5 logs)
  const recentActivity = useMemo(() => {
      return [...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
  }, [auditLogs]);

  const handleDownloadReport = () => {
    const element = document.getElementById('dashboard-content');
    if (!element) return;

    const html2pdf = (window as any).html2pdf;
    if (html2pdf) {
        const opt = {
          margin:       [5, 5],
          filename:     `Reporte_Gerencial_${new Date().toISOString().split('T')[0]}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    } else {
        alert("Módulo PDF cargando...");
    }
  };

  const handleAddTask = () => {
      if (!newTask.title.trim()) return;
      const task: Task = {
          id: `t-${Date.now()}`,
          title: newTask.title,
          priority: newTask.priority,
          completed: false,
          dueDate: new Date().toISOString()
      };
      setTasks(prev => [task, ...prev]);
      setNewTask({ title: '', priority: 'MEDIUM' });
      setShowTaskModal(false);
  };

  const toggleTaskCompletion = (id: string) => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
      if(window.confirm('¿Eliminar tarea?')) {
          setTasks(prev => prev.filter(t => t.id !== id));
      }
  };

  const getPriorityColor = (p: string) => {
      switch(p) {
          case 'HIGH': return 'text-rose-600 bg-rose-50 border-transparent';
          case 'MEDIUM': return 'text-amber-600 bg-amber-50 border-transparent';
          case 'LOW': return 'text-blue-600 bg-blue-50 border-transparent';
          default: return 'text-slate-600';
      }
  };

  const StatCard = ({ title, value, subValue, icon: Icon, colorClass, bgClass }: any) => (
      <div className="bg-white p-6 rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
          <div className="flex items-start justify-between relative z-10">
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
                  {subValue && <p className="text-xs text-slate-500 font-medium mt-1">{subValue}</p>}
              </div>
              <div className={`p-3 rounded-2xl ${bgClass} ${colorClass}`}>
                  <Icon size={24} />
              </div>
          </div>
          {/* Decorative Circle */}
          <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10 ${bgClass.replace('bg-', 'bg-')}`}></div>
      </div>
  );

  return (
    <div id="dashboard-content" className="h-full overflow-y-auto p-4 md:p-8 space-y-6 animation-fade-in custom-scrollbar">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Panel de Control</h1>
              <p className="text-slate-500 text-sm">Resumen de operaciones y rendimiento.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto" data-html2canvas-ignore="true">
              <button 
                onClick={handleDownloadReport}
                className="flex-1 md:flex-none px-4 py-2 bg-white text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                  <Download size={16} /> Exportar
              </button>
              <button 
                onClick={() => setShowTaskModal(true)}
                className="flex-1 md:flex-none px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                  <Plus size={16} /> Tarea
              </button>
          </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Ingresos Totales" 
            value={`$ ${stats.totalRevenueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subValue={`Bs. ${stats.totalRevenue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={DollarSign}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50"
        />
        <StatCard 
            title="Valor en Almacén" 
            value={`$ ${stats.inventoryValueUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            subValue="Costo de Inventario"
            icon={Coins}
            colorClass="text-blue-600"
            bgClass="bg-blue-50"
        />
        <StatCard 
            title="Pedidos Activos" 
            value={stats.activeOrders}
            subValue="En proceso o pendientes"
            icon={Activity}
            colorClass="text-amber-600"
            bgClass="bg-amber-50"
        />
        <StatCard 
            title="Clientes Totales" 
            value={clients.length}
            subValue="Base de datos CRM"
            icon={Users}
            colorClass="text-purple-600"
            bgClass="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section - Dual Axis */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-600" />
                    Rendimiento Semanal
                </h3>
                <p className="text-xs text-slate-400 font-medium">Volumen de ventas vs Cantidad de pedidos</p>
            </div>
          </div>
          <div className="h-72 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                  labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '5px' }}
                />
                <Bar yAxisId="right" dataKey="orders" name="Pedidos" fill="#eff6ff" radius={[4, 4, 0, 0]} barSize={30} />
                <Line yAxisId="left" type="monotone" dataKey="revenueUSD" name="Ingresos ($)" stroke="#2563eb" strokeWidth={3} dot={{r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff'}} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-50 bg-white flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <History className="text-slate-400" size={18} /> Últimos Movimientos
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar max-h-[350px]">
                {recentActivity.length > 0 ? recentActivity.map((log, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                        <div className="mt-1 min-w-[24px]">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                                ${log.action.includes('CREATE') ? 'bg-emerald-500' : 
                                  log.action.includes('DELETE') ? 'bg-rose-500' : 
                                  'bg-blue-500'}`
                            }>
                                {log.user.charAt(0)}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-800 font-medium leading-tight">
                                <span className="font-bold">{log.user}</span> {log.action.toLowerCase()} en {log.module}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{log.details}</p>
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <Clock size={10} /> {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                        </div>
                    </div>
                )) : (
                    <div className="text-center text-slate-400 text-xs py-10">
                        No hay actividad reciente.
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks Widget */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-50 bg-white flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                    <ClipboardList className="text-purple-500" size={18} /> Mis Tareas
                </h3>
                <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                    {tasks.filter(t => !t.completed).length} pendientes
                </span>
            </div>
            <div className="flex-1 p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-2">
                    {tasks.length > 0 ? tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl transition-colors group border border-transparent hover:border-slate-100">
                            <button 
                                onClick={() => toggleTaskCompletion(task.id)}
                                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                    task.completed 
                                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                                        : 'border-slate-300 hover:border-emerald-500 text-transparent bg-white'
                                } hover:scale-110 active:scale-95`}
                            >
                                <CheckCircle size={14} />
                            </button>
                            <div className="flex-1 min-w-0">
                                 <p className={`text-xs font-bold truncate ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                     {task.title}
                                 </p>
                                 <div className="flex items-center gap-2 mt-1">
                                     <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                                         {task.priority === 'HIGH' ? 'Alta' : task.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                                     </span>
                                 </div>
                            </div>
                            <button 
                                onClick={() => deleteTask(task.id)}
                                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-rose-50 rounded-lg active:scale-95"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )) : (
                        <div className="col-span-2 text-center text-slate-400 text-sm py-8">
                            ¡Todo al día! No hay tareas pendientes.
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Top Clients Widget */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 p-0 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-50 bg-white flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                    <Trophy className="text-yellow-500" size={18} /> Top Clientes
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-60 custom-scrollbar">
                {topClients.length > 0 ? topClients.map((client, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50/30 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-600'}`}>
                                 {idx + 1}
                             </div>
                             <span className="text-slate-700 font-bold text-xs truncate w-28 lg:w-32">{client.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                            ${(client.total / exchangeRate).toFixed(0)}
                        </span>
                    </div>
                )) : (
                    <div className="text-center text-slate-400 text-sm py-8">
                        Sin datos de ventas.
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Task Creation Modal */}
      {showTaskModal && (
          <div className="fixed inset-0 bg-slate-900/20 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-fade-in border border-slate-100">
                <div className="p-5 flex justify-between items-center">
                   <h3 className="font-bold text-slate-800">Nueva Tarea</h3>
                   <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                      <X size={20} />
                   </button>
                </div>
                <div className="p-6 pt-0 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Título</label>
                        <input 
                            type="text" 
                            value={newTask.title}
                            onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm text-slate-800"
                            placeholder="Ej. Llamar a proveedor..."
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Prioridad</label>
                        <div className="flex gap-2">
                            {(['LOW', 'MEDIUM', 'HIGH'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setNewTask({...newTask, priority: p})}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                        newTask.priority === p 
                                        ? 'bg-slate-800 text-white shadow-lg' 
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                    }`}
                                >
                                    {p === 'HIGH' ? 'Alta' : p === 'MEDIUM' ? 'Media' : 'Baja'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-4 flex justify-end gap-3 border-t border-slate-50">
                    <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-xs transition-colors">Cancelar</button>
                    <button onClick={handleAddTask} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 text-xs shadow-lg shadow-blue-200 transition-all active:scale-95">Crear</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
