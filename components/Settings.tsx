
import React, { useState } from 'react';
import { User, UserRole, SystemSettings } from '../types';
import { 
  Building, 
  Users, 
  Shield, 
  Save, 
  Plus, 
  Trash2, 
  Mail, 
  Check,
  X,
  Banknote,
  Lock,
  RefreshCw,
  Clock,
  Search,
  Smartphone,
  Key,
  Globe,
  MoreVertical
} from 'lucide-react';
import { addDocument, deleteDocument, updateDocument, setDocument } from '../services/firebase';

interface SettingsProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  exchangeRate: number;
  setExchangeRate: React.Dispatch<React.SetStateAction<number>>;
  onUpdateRate?: () => void;
  lastRateUpdate?: Date | null;
  logAction: (module: string, action: string, details: string) => void;
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
}

const Settings: React.FC<SettingsProps> = ({ users, setUsers, exchangeRate, setExchangeRate, onUpdateRate, lastRateUpdate, logAction, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'team'>('general');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  
  // New User Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'OPERATOR' as UserRole,
    password: '',
    confirmPassword: ''
  });

  const handleSaveConfig = () => {
      // Assuming 'global_settings' is the ID
      setDocument('settings', 'global_settings', settings);
      logAction('CONFIG', 'UPDATE', 'Configuración general actualizada');
      const btn = document.getElementById('save-btn');
      if(btn) {
          const originalText = btn.innerHTML;
          btn.textContent = '¡Guardado!';
          setTimeout(() => btn.innerHTML = originalText, 2000);
      }
  }

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) return;
    
    if (newUser.password !== newUser.confirmPassword) {
        alert("Las contraseñas no coinciden");
        return;
    }

    const user: User = {
      id: `usr-${Date.now()}`,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: 'ACTIVE',
      lastActive: new Date().toISOString(),
      password: newUser.password
    };

    addDocument('users', user);
    logAction('USERS', 'CREATE', `Creado usuario: ${user.name} (${user.role})`);
    setShowAddUserModal(false);
    setNewUser({ name: '', email: '', role: 'OPERATOR', password: '', confirmPassword: '' });
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al usuario ${name}?`)) {
      deleteDocument('users', id);
      logAction('USERS', 'DELETE', `Eliminado usuario: ${name}`);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'MANAGER': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'OPERATOR': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ACCOUNTANT': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'WAREHOUSE': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getRoleLabel = (role: UserRole) => {
     switch(role) {
        case 'ADMIN': return 'ADMINISTRADOR';
        case 'MANAGER': return 'GERENTE';
        case 'OPERATOR': return 'OPERADOR';
        case 'ACCOUNTANT': return 'CONTADOR';
        case 'WAREHOUSE': return 'ALMACÉN';
        default: return role;
     }
  }

  const filteredUsers = users.filter(u => 
      u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Configuración</h2>
            <p className="text-slate-500 text-sm">Administra los parámetros globales y el acceso al sistema.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              activeTab === 'general' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building size={16} /> General
            </div>
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              activeTab === 'team' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users size={16} /> Equipo
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Globe size={18} className="text-blue-500" /> Perfil de la Empresa
                  </h3>
                  <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Comercial</label>
                        <input 
                            type="text" 
                            value={settings.companyName}
                            onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RIF / Identificación Fiscal</label>
                        <input 
                            type="text" 
                            value={settings.rif}
                            onChange={(e) => setSettings({...settings, rif: e.target.value})}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección Fiscal</label>
                        <textarea 
                            value={settings.address}
                            onChange={(e) => setSettings({...settings, address: e.target.value})}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 resize-none h-20"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda Base</label>
                            <select 
                                value={settings.currency}
                                onChange={(e) => setSettings({...settings, currency: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                            >
                                <option value="VES">VES (Bolívares)</option>
                                <option value="USD">USD (Dólares)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zona Horaria</label>
                            <select 
                                value={settings.timezone}
                                onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                            >
                                <option value="UTC-04:00">UTC-04:00 (Caracas)</option>
                            </select>
                        </div>
                    </div>
                  </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Shield size={18} className="text-emerald-500" /> Seguridad y Accesos
                  </h3>
                  <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div>
                              <p className="text-sm font-bold text-slate-700">Autenticación de Dos Pasos (2FA)</p>
                              <p className="text-xs text-slate-500">Requerir código extra al iniciar sesión.</p>
                          </div>
                          <button 
                            onClick={() => setSettings({...settings, twoFactorAuth: !settings.twoFactorAuth})}
                            className={`w-10 h-6 rounded-full transition-colors relative ${settings.twoFactorAuth ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          >
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.twoFactorAuth ? 'left-5' : 'left-1'}`}></div>
                          </button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div>
                              <p className="text-sm font-bold text-slate-700">Notificaciones de Seguridad</p>
                              <p className="text-xs text-slate-500">Alertar por correo ante eventos críticos.</p>
                          </div>
                          <button 
                            onClick={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
                            className={`w-10 h-6 rounded-full transition-colors relative ${settings.emailNotifications ? 'bg-blue-600' : 'bg-slate-300'}`}
                          >
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.emailNotifications ? 'left-5' : 'left-1'}`}></div>
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
              <div className="bg-slate-900 text-white rounded-xl shadow-lg p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                  <h3 className="font-bold mb-4 flex items-center gap-2 relative z-10">
                      <Banknote size={18} className="text-emerald-400" /> Tasa de Cambio
                  </h3>
                  
                  <div className="relative z-10">
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Valor Actual (BCV)</p>
                      <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black tracking-tight text-white">Bs. {exchangeRate.toFixed(2)}</span>
                      </div>
                      
                      <div className="mt-4 space-y-2">
                          <label className="text-xs text-slate-400">Ajuste Manual</label>
                          <div className="flex gap-2">
                              <input 
                                  type="number" 
                                  value={exchangeRate}
                                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                              <button 
                                  onClick={onUpdateRate}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg transition-colors"
                                  title="Sincronizar"
                              >
                                  <RefreshCw size={16} />
                              </button>
                          </div>
                      </div>

                      {lastRateUpdate && (
                          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-400">
                              <Clock size={12} />
                              Actualizado: {lastRateUpdate.toLocaleTimeString()}
                          </div>
                      )}
                  </div>
              </div>

              <button 
                id="save-btn"
                onClick={handleSaveConfig}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                  <Save size={18} /> Guardar Cambios
              </button>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="flex flex-col space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar usuario..." 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
             </div>
             <button 
               onClick={() => setShowAddUserModal(true)}
               className="w-full md:w-auto px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 font-bold text-xs shadow-md active:scale-95"
             >
               <Plus size={16} /> Agregar Miembro
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map(user => (
                <div key={user.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow group relative">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-bold text-lg">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{user.name}</h4>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border mt-1 ${getRoleBadgeColor(user.role)}`}>
                                    {getRoleLabel(user.role)}
                                </span>
                            </div>
                        </div>
                        <button className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                            <MoreVertical size={16} />
                        </button>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Mail size={12} /> {user.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Clock size={12} /> Último acceso: {new Date(user.lastActive).toLocaleDateString()}
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${user.status === 'ACTIVE' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                            {user.status === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                        <div className="flex gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar">
                                <Key size={14} />
                            </button>
                            <button 
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                                title="Eliminar"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Agregar Nuevo Miembro</h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  placeholder="juan@empresa.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                    <input 
                      type="password" 
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                      placeholder="••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar</label>
                    <input 
                      type="password" 
                      value={newUser.confirmPassword}
                      onChange={(e) => setNewUser({...newUser, confirmPassword: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                      placeholder="••••••"
                    />
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Asignar Rol</label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {(['ADMIN', 'MANAGER', 'OPERATOR', 'WAREHOUSE', 'ACCOUNTANT'] as UserRole[]).map((role) => (
                    <label 
                      key={role}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        newUser.role === role 
                          ? 'border-blue-500 bg-blue-50 shadow-sm' 
                          : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="role" 
                        checked={newUser.role === role}
                        onChange={() => setNewUser({...newUser, role})}
                        className="text-blue-600 focus:ring-blue-500 accent-blue-600"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-800">{getRoleLabel(role)}</span>
                        <span className="block text-[10px] text-slate-500">
                          {role === 'ADMIN' ? 'Control Total' : 
                           role === 'MANAGER' ? 'Gestión y Supervisión' :
                           role === 'WAREHOUSE' ? 'Solo Inventario' :
                           role === 'ACCOUNTANT' ? 'Solo Lectura Financiera' :
                           'Ventas y Pedidos'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowAddUserModal(false)}
                className="px-4 py-2 text-slate-600 font-bold text-xs hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddUser}
                className="px-6 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
              >
                Crear Usuario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
