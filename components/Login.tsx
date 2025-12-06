
import React, { useState } from 'react';
import { User } from '../types';
import { Building2, Lock, Mail, ArrowRight, AlertCircle, ArrowLeft, CheckCircle, KeyRound, ShieldCheck } from 'lucide-react';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        setError('Credenciales inválidas. Verifique sus datos.');
        setIsLoading(false);
        return;
      }

      if (user.password !== password) {
        setError('Credenciales inválidas. Verifique sus datos.');
        setIsLoading(false);
        return;
      }

      if (user.status !== 'ACTIVE') {
        setError('Cuenta suspendida. Contacte al Departamento de Sistemas.');
        setIsLoading(false);
        return;
      }

      onLogin(user);
    }, 800);
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setRecoveryStatus('IDLE');
      setIsLoading(true);

      setTimeout(() => {
          const userExists = users.some(u => u.email.toLowerCase() === recoveryEmail.toLowerCase());
          
          if (userExists) {
              setRecoveryStatus('SUCCESS');
          } else {
              setRecoveryStatus('ERROR');
          }
          setIsLoading(false);
      }, 1000);
  };

  const resetView = () => {
      setIsRecovering(false);
      setRecoveryStatus('IDLE');
      setRecoveryEmail('');
      setError('');
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration - Professional Dark Corporate Style */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
         <div className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] rounded-full bg-blue-900/10 blur-[100px]"></div>
         <div className="absolute top-[40%] -right-[10%] w-[600px] h-[600px] rounded-full bg-slate-800/20 blur-[100px]"></div>
      </div>

      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden z-10 relative animate-fade-in transition-all duration-300 border border-slate-200">
        <div className="p-10 pb-6 bg-white border-b border-slate-50">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
               <Building2 className="text-white" size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 tracking-tight">Suministros Waka C.A.</h2>
          <p className="text-center text-slate-500 text-xs font-medium tracking-wide mt-2">
            Sistema Administrativo Integral
          </p>
        </div>

        {/* RECOVERY VIEW */}
        {isRecovering ? (
            <div className="p-10 pt-8 space-y-5 animate-fade-in">
                <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Recuperación de Cuenta</h3>
                    <p className="text-xs text-slate-500">Ingrese su correo corporativo para restablecer credenciales.</p>
                </div>

                {recoveryStatus === 'SUCCESS' ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-6 text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-sm">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-emerald-800">Solicitud Procesada</h4>
                            <p className="text-xs text-emerald-700 mt-1">
                                Se han enviado las instrucciones a <strong>{recoveryEmail}</strong>.
                            </p>
                        </div>
                        <button 
                            onClick={resetView}
                            className="text-xs font-bold text-emerald-700 underline hover:text-emerald-800"
                        >
                            Regresar al Inicio
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleRecoverySubmit} className="space-y-5">
                        {recoveryStatus === 'ERROR' && (
                            <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-lg flex items-center gap-2">
                                <AlertCircle size={16} /> Correo no encontrado en la base de datos.
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2">Correo Registrado</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="email" 
                                    value={recoveryEmail}
                                    onChange={(e) => setRecoveryEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition-all bg-slate-50 text-slate-900 text-sm"
                                    placeholder="usuario@waka.ve"
                                    required
                                />
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm shadow-md active:scale-95"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>Enviar Instrucciones <ArrowRight size={16} /></>
                            )}
                        </button>
                    </form>
                )}

                {recoveryStatus !== 'SUCCESS' && (
                    <button 
                        onClick={resetView}
                        className="w-full text-slate-500 text-xs font-bold hover:text-slate-800 flex items-center justify-center gap-2 mt-4 transition-colors"
                    >
                        <ArrowLeft size={14} /> Cancelar
                    </button>
                )}
            </div>
        ) : (
            /* LOGIN VIEW */
            <>
                <form onSubmit={handleSubmit} className="p-10 pt-8 space-y-6 animate-fade-in">
                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-lg flex items-center gap-2 animate-pulse">
                    <AlertCircle size={16} /> {error}
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Usuario Corporativo</label>
                    <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-800 transition-colors" size={18} />
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition-all bg-slate-50 text-slate-900 text-sm"
                        placeholder="usuario@waka.ve"
                        required
                    />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Contraseña</label>
                    <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-800 transition-colors" size={18} />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition-all bg-slate-50 text-slate-900 text-sm"
                        placeholder="••••••••"
                        required
                    />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group shadow-md active:scale-[0.98]"
                >
                    {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                    <>
                        <span className="text-sm">Iniciar Sesión Segura</span> 
                        <ShieldCheck size={16} />
                    </>
                    )}
                </button>
                </form>

                <div className="p-6 text-center border-t border-slate-50 bg-slate-50/50">
                    <button 
                        onClick={() => setIsRecovering(true)}
                        className="text-xs text-slate-500 hover:text-blue-600 font-bold transition-colors"
                    >
                        ¿Olvidó su credencial? Contacte a Sistemas.
                    </button>
                    <p className="text-[10px] text-slate-400 mt-4 font-mono">v1.0.0 (Prod) | © 2025 Waka C.A.</p>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default Login;
