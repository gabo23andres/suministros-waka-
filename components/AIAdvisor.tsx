
import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { analyzeOrderTrends } from '../services/geminiService';
import { Sparkles, Zap, TrendingUp, AlertCircle, RefreshCcw } from 'lucide-react';

interface AIAdvisorProps {
  orders: Order[];
  notify: (type: 'success' | 'error' | 'info' | 'warning', message: string, subMessage?: string) => void;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ orders, notify }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    // Prepare summary string for AI
    const summary = `
      Total Orders: ${orders.length}
      Revenue: Bs. ${orders.reduce((acc, o) => acc + o.total, 0)}
      Failed Orders: ${orders.filter(o => o.status === OrderStatus.FAILED).length}
      Processing: ${orders.filter(o => o.status === OrderStatus.PROCESSING).length}
    `;
    
    // Call the service which now returns { data, error, isFallback }
    const { data, error, isFallback } = await analyzeOrderTrends(summary);
    
    setAnalysis(data);
    setLoading(false);

    if (isFallback) {
        notify('warning', 'Análisis Offline', error || 'Servicio de IA no disponible. Usando datos históricos.');
    } else {
        notify('success', 'Análisis Completado', 'Generado por Gemini 2.5 Flash');
    }
  };

  useEffect(() => {
      // Auto run analysis on mount if empty
      if (!analysis) runAnalysis();
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-8 text-white shadow-lg flex items-center justify-between">
            <div>
                <h2 className="text-3xl font-bold mb-2">Inteligencia de Flujo</h2>
                <p className="text-indigo-100 opacity-90">Insights en tiempo real impulsados por Gemini 2.5 Flash</p>
            </div>
            <button 
                onClick={runAnalysis}
                disabled={loading}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 border border-white/10"
            >
                {loading ? <RefreshCcw className="animate-spin" /> : <Sparkles className="text-yellow-300" />}
                Actualizar Análisis
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-blue-500">
                <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <TrendingUp className="text-blue-600" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">Puntaje de Eficiencia</h3>
                <p className="text-4xl font-extrabold text-slate-900 mb-1">87<span className="text-lg text-slate-400 font-normal">/100</span></p>
                <p className="text-xs text-slate-500 mt-2">Basado en tiempo de procesamiento vs complejidad.</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-amber-500">
                <div className="bg-amber-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <Zap className="text-amber-600" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">Tasa de Automatización</h3>
                <p className="text-4xl font-extrabold text-slate-900 mb-1">64%</p>
                <p className="text-xs text-slate-500 mt-2">Pedidos procesados sin intervención manual.</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-red-500">
                <div className="bg-red-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="text-red-600" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">Cuellos de Botella</h3>
                <p className="text-4xl font-extrabold text-slate-900 mb-1">2</p>
                <p className="text-xs text-slate-500 mt-2">Etapas críticas del flujo que requieren atención.</p>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="text-purple-500" size={18} />
                    Recomendaciones Estratégicas IA
                </h3>
            </div>
            <div className="p-8">
                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                    </div>
                ) : (
                    <div className="prose text-slate-700 space-y-4">
                        {analysis ? (
                            analysis.split('\n').map((line, i) => (
                                <p key={i} className="flex items-start gap-3">
                                    {line.trim().startsWith('-') || line.trim().startsWith('*') ? (
                                         <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                    ) : null}
                                    <span>{line.replace(/^[-*]/, '').trim()}</span>
                                </p>
                            ))
                        ) : (
                            <p className="text-slate-400 italic">Análisis no disponible.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default AIAdvisor;
