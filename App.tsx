
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import OrderList from './components/OrderList';
import WorkflowBuilder from './components/WorkflowBuilder';
import AIAdvisor from './components/AIAdvisor';
import InventoryList from './components/InventoryList';
import Settings from './components/Settings';
import Login from './components/Login';
import RawMaterialList from './components/RawMaterialList';
import ProductionPlan from './components/ProductionPlan';
import ClientList from './components/ClientList';
import AuditLogView from './components/AuditLog';
import { Order, Workflow, StepType, InventoryItem, User, Notification, Task, NotificationHistoryItem, RawMaterial, ProductionOrder, Client, AuditLog, SystemSettings } from './types';
import { LayoutDashboard, List, GitMerge, BrainCircuit, Settings as SettingsIcon, LogOut, Bell, Menu, X, Package, Building2, CheckCircle, AlertCircle, Info, AlertTriangle, Wifi, WifiOff, FlaskConical, Factory, Users, ShieldAlert, MessageSquareText, Send, Check, Trash2, Clock } from 'lucide-react';
import { fetchExchangeRate } from './services/exchangeRateService';
import { subscribeToCollection, addDocument, setDocument, updateDocument, deleteDocument, isCollectionEmpty } from './services/firebase';

// --- MOCK DATA FOR SEEDING (Only used if DB is empty) ---
const initialInventoryMock: InventoryItem[] = [
  { id: 'inv-1', name: 'Cloro Doméstico Galón', sku: 'CL-001', quantity: 45, price: 120.00, category: 'Limpieza', status: 'IN_STOCK' },
  { id: 'inv-2', name: 'Desinfectante Lavanda 1L', sku: 'DES-LAV', quantity: 5, price: 45.50, category: 'Limpieza', status: 'LOW_STOCK' },
  { id: 'inv-3', name: 'Cera Autobrillante 1L', sku: 'CER-001', quantity: 200, price: 80.00, category: 'Pisos', status: 'IN_STOCK' },
  { id: 'inv-4', name: 'Jabón Líquido Multiuso', sku: 'JAB-MUL', quantity: 0, price: 65.00, category: 'Limpieza', status: 'OUT_OF_STOCK' },
  { id: 'inv-5', name: 'Esponja Doble Uso (Paq 12)', sku: 'ESP-12', quantity: 12, price: 150.00, category: 'Accesorios', status: 'IN_STOCK' },
  { id: 'inv-6', name: 'Escoba Tipo Cepillo', sku: 'ESC-CEP', quantity: 8, price: 95.00, category: 'Accesorios', status: 'LOW_STOCK' },
  { id: 'inv-7', name: 'Bolsas de Basura 30kg (Paq 10)', sku: 'BOL-30', quantity: 50, price: 45.00, category: 'Accesorios', status: 'IN_STOCK' },
];

const initialRawMaterialsMock: RawMaterial[] = [
    { id: 'rm-1', name: 'Hipoclorito de Sodio', code: 'QUIM-01', unit: 'L', quantity: 1000, minLevel: 200, cost: 15 },
    { id: 'rm-2', name: 'Fragancia Lavanda Conc.', code: 'FRA-LAV', unit: 'L', quantity: 50, minLevel: 10, cost: 120 },
    { id: 'rm-3', name: 'Envase Plástico Galón', code: 'ENV-GAL', unit: 'UND', quantity: 500, minLevel: 100, cost: 5 },
    { id: 'rm-4', name: 'Etiquetas Waka Cloro', code: 'ETI-CLO', unit: 'UND', quantity: 2000, minLevel: 500, cost: 0.5 },
];

const initialClientsMock: Client[] = [
    { id: 'cli-1', name: 'Inversiones Waka C.A.', rif: 'J-50293847-1', email: 'contacto@waka.ve', phone: '0414-1234567', address: 'Zona Industrial Guacara', creditLimit: 1000 },
    { id: 'cli-2', name: 'Distribuidora Los Andes', rif: 'J-30495822-0', email: 'compras@losandes.com', phone: '0412-9876543', address: 'Av. Bolívar, Valencia', creditLimit: 500 },
];

const initialWorkflowsMock: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Alerta de Nuevo Pedido',
    description: 'Notifica a ventas y almacén cuando se crea una orden.',
    active: true,
    steps: [
      { id: 's1', name: 'Trigger: New Order Created', type: StepType.TRIGGER, description: 'Se activa al guardar una nueva orden.' },
      { id: 's2', name: 'Email: Ventas', type: StepType.NOTIFICATION, description: 'Envía detalles a ventas@waka.ve' },
      { id: 's3', name: 'Email: Almacén', type: StepType.NOTIFICATION, description: 'Envía alerta de preparación a almacen@waka.ve' },
      { id: 's4', name: 'Slack: General Channel', type: StepType.NOTIFICATION, description: 'Postea en el canal #pedidos-nuevos' }
    ]
  },
  {
    id: 'wf-2',
    name: 'Control de Stock Crítico',
    description: 'Monitoreo de inventario bajo y reabastecimiento.',
    active: true,
    steps: [
      { id: 's2-1', name: 'Trigger: Stock Update', type: StepType.TRIGGER, description: 'Se ejecuta cada vez que cambia el inventario.' },
      { id: 's2-2', name: 'IF: Stock < 10', type: StepType.CONDITION, description: 'Filtra productos con existencia crítica.' },
      { id: 's2-3', name: 'Gmail: Alerta Gerente', type: StepType.NOTIFICATION, description: 'Envía correo urgente a compras@waka.ve' },
      { id: 's2-4', name: 'Google Sheets: Log', type: StepType.ACTION, description: 'Agrega fila en "Reabastecimiento Pendiente".' }
    ]
  },
  {
    id: 'wf-4',
    name: 'Confirmación de Envío',
    description: 'Genera guía de despacho y notifica al cliente.',
    active: true,
    steps: [
      { id: 's4-1', name: 'Trigger: Order Completed', type: StepType.TRIGGER, description: 'Estado cambia a COMPLETED' },
      { id: 's4-2', name: 'API: Generar Guía', type: StepType.ACTION, description: 'Conecta con API de Tealca/Zoom' },
      { id: 's4-3', name: 'Email: Tracking Info', type: StepType.NOTIFICATION, description: 'Envía número de guía al cliente' }
    ]
  }
];

const initialUsersMock: User[] = [
  { id: 'u1', name: 'Admin Waka', email: 'admin@waka.ve', role: 'ADMIN', status: 'ACTIVE', lastActive: new Date().toISOString(), password: '123456' },
  { id: 'u2', name: 'Carlos Gerente', email: 'carlos@waka.ve', role: 'MANAGER', status: 'ACTIVE', lastActive: new Date(Date.now() - 3600000).toISOString(), password: '123456' },
  { id: 'u3', name: 'Ana Ventas', email: 'ana@waka.ve', role: 'OPERATOR', status: 'ACTIVE', lastActive: new Date(Date.now() - 7200000).toISOString(), password: '123456' },
  { id: 'u4', name: 'Luis Almacén', email: 'luis@waka.ve', role: 'WAREHOUSE', status: 'ACTIVE', lastActive: new Date(Date.now() - 3600000).toISOString(), password: '123456' },
  { id: 'u5', name: 'Pedro Contador', email: 'pedro@waka.ve', role: 'ACCOUNTANT', status: 'ACTIVE', lastActive: new Date(Date.now() - 1200000).toISOString(), password: '123456' },
];

const initialTasksMock: Task[] = [
    { id: 't1', title: 'Revisar discrepancias en inventario Químicos', priority: 'HIGH', completed: false, dueDate: new Date().toISOString() },
    { id: 't2', title: 'Aprobar compra de envases plásticos', priority: 'MEDIUM', completed: false, dueDate: new Date(Date.now() + 86400000).toISOString() },
];

const initialSettings: SystemSettings = {
  companyName: 'Suministros Waka C.A.',
  rif: 'J-50293847-1',
  address: 'Zona Industrial Guacara, Galpón 4-B, Carabobo',
  currency: 'VES',
  timezone: 'UTC-04:00',
  emailNotifications: true,
  twoFactorAuth: false
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State - Now Synced with Firebase (Mock or Real)
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryItem[]>([]);
  
  const [exchangeRate, setExchangeRate] = useState<number>(55.45);
  const [lastRateUpdate, setLastRateUpdate] = useState<Date | null>(null);
  
  // Connectivity State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [workflowPrompt, setWorkflowPrompt] = useState<string>('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  
  // WakaBot Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: 'bot'|'user', text: string}[]>([{sender: 'bot', text: '¡Hola! Soy WakaBot. Pregúntame sobre ventas, stock o pedidos.'}]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const notificationPanelRef = useRef<HTMLDivElement>(null);

  // Initialize Firebase Listeners
  useEffect(() => {
    // Seeding Logic: Check if Users collection is empty, if so, seed everything
    const checkAndSeed = async () => {
        try {
            // Safety check: Only seed if users are empty to avoid overwriting production data
            if (await isCollectionEmpty('users')) {
                console.log("Database initialized or empty. Seeding standard mock data...");
                // Use Promise.all for parallel seeding to speed up init
                await Promise.all([
                    ...initialUsersMock.map(u => setDocument('users', u.id, u)),
                    ...initialInventoryMock.map(i => setDocument('inventory', i.id, i)),
                    ...initialRawMaterialsMock.map(m => setDocument('raw_materials', m.id, m)),
                    ...initialClientsMock.map(c => setDocument('clients', c.id, c)),
                    ...initialWorkflowsMock.map(w => setDocument('workflows', w.id, w)),
                    ...initialTasksMock.map(t => setDocument('tasks', t.id, t)),
                    setDocument('settings', 'global_settings', initialSettings)
                ]);
            }
        } catch (e) {
            console.error("Error checking/seeding DB:", e);
        }
    };
    checkAndSeed();

    const unsubOrders = subscribeToCollection<Order>('orders', (data) => setOrders(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())));
    const unsubInventory = subscribeToCollection<InventoryItem>('inventory', setInventory);
    const unsubUsers = subscribeToCollection<User>('users', setUsers);
    const unsubWorkflows = subscribeToCollection<Workflow>('workflows', setWorkflows);
    const unsubTasks = subscribeToCollection<Task>('tasks', setTasks);
    const unsubMaterials = subscribeToCollection<RawMaterial>('raw_materials', setMaterials);
    const unsubProduction = subscribeToCollection<ProductionOrder>('production_orders', (data) => setProductionOrders(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())));
    const unsubClients = subscribeToCollection<Client>('clients', setClients);
    const unsubLogs = subscribeToCollection<AuditLog>('audit_logs', (data) => setAuditLogs(data.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())));
    const unsubNotifs = subscribeToCollection<NotificationHistoryItem>('notifications_history', (data) => setNotificationHistory(data.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())));
    
    // Settings listener (assuming single doc)
    const unsubSettings = subscribeToCollection<SystemSettings>('settings', (data) => {
        if(data.length > 0) setSettings(data[0]);
    });

    return () => {
        unsubOrders();
        unsubInventory();
        unsubUsers();
        unsubWorkflows();
        unsubTasks();
        unsubMaterials();
        unsubProduction();
        unsubClients();
        unsubLogs();
        unsubNotifs();
        unsubSettings();
    };
  }, []);

  // Helper for logging actions
  const logAction = useCallback((module: string, action: string, details: string, userOverride?: User) => {
      const actor = userOverride || currentUser;
      if (!actor) return;
      
      const newLog: AuditLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          module,
          action,
          details,
          user: actor.name,
          role: actor.role
      };
      // Send to Firebase
      addDocument('audit_logs', newLog);
  }, [currentUser]);

  // Network Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      notify('success', 'Conexión Restaurada', 'Sincronizando datos...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      notify('warning', 'Modo Offline Activado', 'Los cambios se guardarán localmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target as Node)) {
        setIsNotificationPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const notify = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string, subMessage?: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, type, message, subMessage }]);
    
    // Save to history (Firebase)
    const historyItem: NotificationHistoryItem = {
        id,
        type,
        title: message,
        description: subMessage,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    // Fire and forget
    addDocument('notifications_history', historyItem).catch(e => console.warn("Failed to save notification log", e));
    
    // Simulate Email Notifications if enabled in settings
    if (settings.emailNotifications && (type === 'error' || type === 'warning')) {
        console.log(`[SIMULACIÓN SMTP] Enviando alerta a admin@waka.ve: ${message}`);
    }

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, [settings.emailNotifications]);

  const updateExchangeRate = async (silent = false) => {
      if (!isOnline) return; 

      if (!silent) notify('info', 'Sincronizando Tasa BCV...', 'Conectando con servicio de divisas.');
      
      try {
          const rate = await fetchExchangeRate();
          setExchangeRate(rate);
          setLastRateUpdate(new Date());
          if (!silent) notify('success', 'Tasa Actualizada', `Nuevo valor: Bs. ${rate.toFixed(2)}`);
          logAction('FINANCE', 'UPDATE_RATE', `Tasa actualizada a ${rate}`);
      } catch (error: any) {
          if (!silent) {
              // Don't spam user with toast if it's a background update
              console.warn('Background rate update failed:', error);
          }
      }
  };

  useEffect(() => {
      updateExchangeRate(true);
      const interval = setInterval(() => {
          updateExchangeRate(true);
      }, 3600000);
      return () => clearInterval(interval);
  }, [isOnline]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllAsRead = () => {
      notificationHistory.forEach(n => {
          if(!n.read) updateDocument('notifications_history', n.id, { read: true });
      });
  };

  const clearHistory = () => {
      if(window.confirm('¿Borrar historial de notificaciones?')) {
          notificationHistory.forEach(n => deleteDocument('notifications_history', n.id));
      }
  };
  
  const unreadCount = notificationHistory.filter(n => !n.read).length;

  const handleAutomateInventory = (prompt: string) => {
      if (!isOnline) {
          notify('error', 'Sin Conexión', 'La IA requiere internet para funcionar.');
          return;
      }
      setWorkflowPrompt(prompt);
      setActiveView('workflows');
      notify('info', 'Generador de IA Activado', 'Configurando contexto para inventario...');
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    notify('success', `Bienvenido, ${user.name}`);
    logAction('AUTH', 'LOGIN', `Inicio de sesión exitoso`, user); 
    setActiveView('dashboard');
  };

  const handleLogout = () => {
    logAction('AUTH', 'LOGOUT', 'Cierre de sesión');
    setCurrentUser(null);
    notify('info', 'Sesión cerrada exitosamente');
    setIsNotificationPanelOpen(false);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;

      const userMsg = chatInput.trim();
      setChatMessages(prev => [...prev, {sender: 'user', text: userMsg}]);
      setChatInput('');

      // Simple Logic for WakaBot
      setTimeout(() => {
          let botResponse = "No entiendo esa consulta. Prueba 'ventas', 'stock' o 'ayuda'.";
          const lowerMsg = userMsg.toLowerCase();

          if (lowerMsg.includes('ayuda') || lowerMsg.includes('hola')) {
              botResponse = "Puedo decirte las 'ventas' del día, qué 'stock' está bajo, o cuántos 'pedidos' hay pendientes.";
          } else if (lowerMsg.includes('ventas') || lowerMsg.includes('dinero') || lowerMsg.includes('vendido')) {
              const total = orders.reduce((sum, o) => sum + o.total, 0);
              botResponse = `El total histórico de ventas registradas es Bs. ${total.toLocaleString('es-VE')}.`;
          } else if (lowerMsg.includes('stock') || lowerMsg.includes('inventario') || lowerMsg.includes('bajo')) {
              const lowStock = inventory.filter(i => i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK');
              botResponse = `Hay ${lowStock.length} productos con stock crítico. Revisa el módulo de inventario.`;
          } else if (lowerMsg.includes('pedidos') || lowerMsg.includes('pendientes')) {
              const pending = orders.filter(o => o.status === 'PENDING').length;
              botResponse = `Actualmente hay ${pending} pedidos pendientes de procesar.`;
          }

          setChatMessages(prev => [...prev, {sender: 'bot', text: botResponse}]);
      }, 500);
  };

  const allNavItems = [
    { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard size={20} />, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'ACCOUNTANT', 'WAREHOUSE'] },
    { id: 'orders', label: 'Pedidos', icon: <List size={20} />, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'WAREHOUSE', 'ACCOUNTANT'] },
    { id: 'clients', label: 'Clientes (CRM)', icon: <Users size={20} />, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { id: 'inventory', label: 'Prod. Terminados', icon: <Package size={20} />, roles: ['ADMIN', 'MANAGER', 'WAREHOUSE', 'OPERATOR'] },
    { id: 'materials', label: 'Materia Prima', icon: <FlaskConical size={20} />, roles: ['ADMIN', 'MANAGER', 'WAREHOUSE'] },
    { id: 'production', label: 'Producción', icon: <Factory size={20} />, roles: ['ADMIN', 'MANAGER', 'WAREHOUSE'] },
    { id: 'workflows', label: 'Gestión de Flujos (BPM)', icon: <GitMerge size={20} />, roles: ['ADMIN', 'MANAGER'] },
    { id: 'ai', label: 'AI Advisor', icon: <BrainCircuit size={20} />, roles: ['ADMIN', 'MANAGER'] },
    { id: 'audit', label: 'Auditoría', icon: <ShieldAlert size={20} />, roles: ['ADMIN', 'MANAGER'] },
    { id: 'settings', label: 'Configuración', icon: <SettingsIcon size={20} />, roles: ['ADMIN', 'MANAGER'] },
  ];

  const visibleNavItems = currentUser 
    ? allNavItems.filter(item => item.roles.includes(currentUser.role))
    : [];

  const renderContent = () => {
    if (!currentUser) return null;

    switch (activeView) {
      case 'dashboard':
        return <Dashboard 
            orders={orders} 
            inventory={inventory} 
            exchangeRate={exchangeRate} 
            tasks={tasks} 
            setTasks={setTasks} 
            clients={clients}
            auditLogs={auditLogs}
        />;
      case 'orders':
        return (
            <OrderList 
                orders={orders} 
                setOrders={setOrders} 
                inventory={inventory} 
                setInventory={setInventory} 
                exchangeRate={exchangeRate} 
                isOnline={isOnline} 
                notify={notify}
                clients={clients}
                logAction={logAction}
                currentUser={currentUser}
                settings={settings}
            />
        );
      case 'clients':
        return <ClientList clients={clients} setClients={setClients} notify={notify} logAction={logAction} />;
      case 'workflows':
        return <WorkflowBuilder workflows={workflows} setWorkflows={setWorkflows} initialPrompt={workflowPrompt} notify={notify} />;
      case 'ai':
        return <AIAdvisor orders={orders} notify={notify} />;
      case 'audit':
        return <AuditLogView logs={auditLogs} />;
      case 'inventory':
        return (
            <InventoryList 
                inventory={inventory} 
                setInventory={setInventory} 
                onAutomate={handleAutomateInventory} 
                exchangeRate={exchangeRate}
                logAction={logAction}
                settings={settings}
                notify={notify}
            />
        );
      case 'materials':
        return <RawMaterialList materials={materials} setMaterials={setMaterials} notify={notify} logAction={logAction} />;
      case 'production':
        return <ProductionPlan 
            productionOrders={productionOrders} 
            setProductionOrders={setProductionOrders}
            inventory={inventory}
            setInventory={setInventory}
            materials={materials}
            setMaterials={setMaterials}
            notify={notify}
            logAction={logAction}
        />;
      case 'settings':
        return (
            <Settings 
                users={users} 
                setUsers={setUsers} 
                exchangeRate={exchangeRate} 
                setExchangeRate={setExchangeRate} 
                onUpdateRate={() => updateExchangeRate(false)}
                lastRateUpdate={lastRateUpdate}
                logAction={logAction}
                settings={settings}
                setSettings={setSettings}
            />
        );
      default:
        return <Dashboard orders={orders} inventory={inventory} exchangeRate={exchangeRate} tasks={tasks} setTasks={setTasks} clients={clients} auditLogs={auditLogs} />;
    }
  };

  if (!currentUser) {
     return (
        <div className="safe-top safe-bottom safe-left safe-right min-h-screen bg-slate-50">
            <Login users={users} onLogin={handleLogin} />
        </div>
     );
  }

  const getNotificationIcon = (type: string) => {
      switch(type) {
          case 'success': return <CheckCircle size={16} className="text-emerald-500" />;
          case 'error': return <AlertCircle size={16} className="text-red-500" />;
          case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
          default: return <Info size={16} className="text-blue-500" />;
      }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-800 relative overflow-hidden safe-top safe-bottom safe-left safe-right">
      
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-3 w-full max-w-sm pointer-events-none safe-top safe-right">
        {notifications.map(n => (
          <div 
            key={n.id} 
            className={`pointer-events-auto transform transition-all duration-300 animate-fade-in flex items-start gap-3 p-4 rounded-2xl shadow-xl border bg-white/95 backdrop-blur-md
              ${n.type === 'success' ? 'border-emerald-50' : 
                n.type === 'error' ? 'border-red-50' : 
                n.type === 'warning' ? 'border-amber-50' : 
                'border-blue-50'}
            `}
          >
            <div className={`mt-0.5 ${
                n.type === 'success' ? 'text-emerald-500' : 
                n.type === 'error' ? 'text-red-500' : 
                n.type === 'warning' ? 'text-amber-500' : 
                'text-blue-500'
            }`}>
               {n.type === 'success' ? <CheckCircle size={20} /> : 
                n.type === 'error' ? <AlertCircle size={20} /> : 
                n.type === 'warning' ? <AlertTriangle size={20} /> : 
                <Info size={20} />}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-slate-800">{n.message}</h4>
              {n.subMessage && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.subMessage}</p>}
            </div>
            <button onClick={() => removeNotification(n.id)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col safe-left
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-8 pb-6 border-b border-slate-800 flex items-center justify-between bg-slate-900 safe-top">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 size={24} className="text-white" />
            </div>
            <div>
               <h1 className="text-lg font-bold leading-none tracking-tight text-white">Suministros</h1>
               <h2 className="text-sm font-light text-slate-400 leading-none mt-1">Waka C.A.</h2>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-4 mt-4">Navegación</div>
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 group relative overflow-hidden ${
                activeView === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 relative z-10">
                  <span className={`transition-transform duration-300 ${activeView === item.id ? 'scale-105' : ''}`}>
                      {item.icon}
                  </span>
                  <span className="font-medium tracking-wide text-sm">{item.label}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800 safe-bottom">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0 text-white ring-2 ring-slate-800">
                    {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold truncate text-slate-200">{currentUser.name}</p>
                    <p className="text-xs text-slate-400 truncate uppercase font-medium tracking-wider">{currentUser.role}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 hover:bg-slate-700 rounded-lg"
                  title="Cerrar Sesión"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#f8fafc]">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl h-16 border-b border-slate-100 flex items-center justify-between px-6 md:px-8 shrink-0 sticky top-0 z-30 safe-top">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex flex-col">
                 <h2 className="text-xl font-bold text-slate-800 capitalize leading-tight">
                    {visibleNavItems.find(i => i.id === activeView)?.label || 'Panel'}
                 </h2>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            
            {/* Connection Status Indicator */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600 animate-pulse'}`}>
                {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-100">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Tasa BCV
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                        Bs. {exchangeRate.toFixed(2)}
                    </span>
                </div>
            </div>
            
            <div className="relative" ref={notificationPanelRef}>
                <button 
                    onClick={() => setIsNotificationPanelOpen(!isNotificationPanelOpen)}
                    className={`p-2.5 rounded-full transition-colors relative ${isNotificationPanelOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
                >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                    )}
                </button>

                {/* Notification Panel */}
                {isNotificationPanelOpen && (
                    <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 animate-fade-in z-50 flex flex-col max-h-[500px]">
                        <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-white rounded-t-3xl">
                            <h3 className="font-bold text-slate-800 text-sm pl-2">Notificaciones</h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={markAllAsRead}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                                >
                                    <Check size={12} /> Marcar Leídas
                                </button>
                                <button 
                                    onClick={clearHistory}
                                    className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                                    title="Limpiar todo"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {notificationHistory.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                                    <Bell size={32} className="opacity-20 mb-2" />
                                    <p className="text-xs">Sin novedades.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {notificationHistory.map(item => (
                                        <div key={item.id} className={`p-4 rounded-2xl hover:bg-slate-50 transition-colors flex gap-3 ${!item.read ? 'bg-blue-50/50' : ''}`}>
                                            <div className="mt-1 shrink-0">{getNotificationIcon(item.type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <h4 className={`text-xs font-bold ${!item.read ? 'text-slate-800' : 'text-slate-500'}`}>{item.title}</h4>
                                                    {!item.read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1"></span>}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                                                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                                    <Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute:'2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
          </div>
        </header>
        
        {/* Offline Banner */}
        {!isOnline && (
            <div className="bg-amber-100 text-amber-800 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 sticky top-16 z-20 shadow-sm animate-fade-in">
                <WifiOff size={14} />
                Estás en Modo Offline. Los cambios se guardarán localmente y se sincronizarán al volver la conexión.
            </div>
        )}

        <div className="flex-1 overflow-hidden relative flex flex-col safe-bottom safe-right">
            <div className="h-full w-full">
                {renderContent()}
            </div>
        </div>

        {/* WakaBot Floating Chat */}
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
            {isChatOpen && (
                <div className="bg-white rounded-3xl shadow-2xl w-80 h-96 border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
                    <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><BrainCircuit size={18} className="text-purple-400" /> WakaBot AI</h3>
                        <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs font-medium ${
                                    msg.sender === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white text-slate-700 shadow-sm rounded-bl-none border border-slate-100'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                        <input 
                            type="text" 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Pregunta algo..."
                            className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <button type="submit" className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors">
                            <Send size={16} />
                        </button>
                    </form>
                </div>
            )}
            <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="bg-slate-900 hover:bg-blue-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            >
                {isChatOpen ? <X size={24} /> : <MessageSquareText size={24} />}
            </button>
        </div>

      </main>
    </div>
  );
};

export default App;
