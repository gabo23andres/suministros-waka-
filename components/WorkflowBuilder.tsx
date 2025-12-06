
import React, { useState, useEffect } from 'react';
import { Workflow, StepType, GeminiWorkflowResponse } from '../types';
import { generateWorkflowFromPrompt } from '../services/geminiService';
import { 
  Plus, Sparkles, Trash2, 
  ArrowLeft, Database, Globe, Mail, MessageSquare, 
  Server, PlayCircle, Split, Truck, CheckCircle, AlertTriangle, Bell, Zap, HardDrive, Pencil, Save
} from 'lucide-react';
import { addDocument, updateDocument, deleteDocument } from '../services/firebase';

interface WorkflowBuilderProps {
  workflows: Workflow[];
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>;
  initialPrompt?: string;
  notify: (type: 'success' | 'error' | 'info' | 'warning', message: string, subMessage?: string) => void;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflows, setWorkflows, initialPrompt, notify }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(workflows[0]?.id || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Execution Simulation State
  const [executingStep, setExecutingStep] = useState<string | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  useEffect(() => {
    if (initialPrompt) {
        setAiPrompt(initialPrompt);
        setShowAiModal(true);
    }
  }, [initialPrompt]);

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);

  const handleSelectWorkflow = (id: string) => {
    setSelectedWorkflowId(id);
    setShowMobileList(false);
    setExecutionLog([]);
    setExecutingStep(null);
    setIsEditing(false); // Exit edit mode when switching
  };

  const handleGenerateWorkflow = async () => {
    if (!aiPrompt.trim()) {
        notify('error', 'El prompt no puede estar vacío', 'Por favor describe el flujo que deseas crear.');
        return;
    }
    setIsGenerating(true);
    
    // Call the service which now returns { data, error, isFallback }
    const { data, error, isFallback } = await generateWorkflowFromPrompt(aiPrompt);
    
    if (data) {
      const newWorkflow: Workflow = {
        id: Date.now().toString(),
        name: data.name,
        description: data.description,
        active: false,
        steps: data.steps.map((s, idx) => ({
          id: `step-${Date.now()}-${idx}`,
          name: s.name,
          type: s.type as StepType,
          description: s.description
        }))
      };
      
      const newId = await addDocument('workflows', newWorkflow);
      
      setSelectedWorkflowId(newId);
      setShowMobileList(false);
      setShowAiModal(false);
      setAiPrompt('');
      
      if (isFallback) {
          notify('warning', 'Modo Plantilla Offline', error || 'Servicio IA no disponible. Se ha generado una plantilla estándar.');
      } else {
          notify('success', 'Flujo generado exitosamente', 'Se ha creado la estructura base.');
      }
    } else {
        notify('error', 'Error al generar flujo', error || 'Intenta nuevamente más tarde.');
    }
    setIsGenerating(false);
  };

  const deleteStep = (workflowId: string, stepId: string) => {
    const wf = workflows.find(w => w.id === workflowId);
    if (!wf) return;
    
    const updatedSteps = wf.steps.filter(s => s.id !== stepId);
    updateDocument('workflows', workflowId, { steps: updatedSteps });
  };

  const toggleActive = (id: string) => {
    const wf = workflows.find(w => w.id === id);
    if (!wf) return;
    updateDocument('workflows', id, { active: !wf.active });
  };

  const updateWorkflowDetails = (key: 'name' | 'description', value: string) => {
      if (!selectedWorkflowId) return;
      // Optimistic update for UI input
      // In a real scenario we might debounce this
      setWorkflows(prev => prev.map(w => w.id === selectedWorkflowId ? { ...w, [key]: value } : w));
  }

  const updateStepDetails = (stepId: string, key: 'name' | 'description', value: string) => {
      if (!selectedWorkflowId) return;
      setWorkflows(prev => prev.map(w => {
          if (w.id !== selectedWorkflowId) return w;
          return {
              ...w,
              steps: w.steps.map(s => s.id === stepId ? { ...s, [key]: value } : s)
          };
      }));
  }

  const saveChanges = () => {
      if (!selectedWorkflow) return;

      // Validation logic
      if (!selectedWorkflow.name.trim()) {
          notify('error', 'Nombre obligatorio', 'El nombre del flujo no puede estar vacío.');
          return;
      }

      for (const step of selectedWorkflow.steps) {
          if (!step.name.trim()) {
              notify('error', 'Nodo inválido', 'Todos los pasos deben tener un nombre.');
              return;
          }
      }

      updateDocument('workflows', selectedWorkflow.id, selectedWorkflow);
      setIsEditing(false);
      notify('success', 'Cambios guardados', 'El flujo ha sido actualizado correctamente.');
  };

  const simulateExecution = async () => {
    if (!selectedWorkflow) return;
    setExecutionLog([]);
    
    // Visual simulation loop
    for (const step of selectedWorkflow.steps) {
        setExecutingStep(step.id);
        await new Promise(r => setTimeout(r, 800)); // Simulate processing time
        setExecutionLog(prev => [...prev, step.id]);
    }
    setExecutingStep(null);
  };

  const getNodeColor = (type: StepType) => {
      switch(type) {
          case StepType.TRIGGER: return 'border-t-4 border-t-emerald-500';
          case StepType.ACTION: return 'border-t-4 border-t-blue-500';
          case StepType.CONDITION: return 'border-t-4 border-t-amber-500';
          case StepType.NOTIFICATION: return 'border-t-4 border-t-rose-500';
          default: return 'border-t-4 border-t-slate-500';
      }
  }

  const getNodeIcon = (name: string, type: StepType) => {
    const n = name.toLowerCase();
    // Specific Icon for Valery Systems
    if (n.includes('valery')) return <HardDrive size={18} className="text-orange-600" />;
    
    if (n.includes('webhook') || n.includes('api')) return <Globe size={18} className="text-emerald-600" />;
    if (n.includes('mail') || n.includes('correo')) return <Mail size={18} className="text-rose-600" />;
    if (n.includes('whatsapp') || n.includes('sms') || n.includes('slack')) return <MessageSquare size={18} className="text-green-600" />;
    if (n.includes('db') || n.includes('sql') || n.includes('inventario') || n.includes('stock')) return <Database size={18} className="text-blue-600" />;
    if (n.includes('if') || n.includes('condi') || n.includes('filter')) return <Split size={18} className="text-amber-600" />;
    if (n.includes('shipping') || n.includes('envío') || n.includes('despacho') || n.includes('tracking') || n.includes('guía')) return <Truck size={18} className="text-indigo-600" />;
    
    switch (type) {
      case StepType.TRIGGER: return <Zap size={18} className="text-emerald-500" />;
      case StepType.ACTION: return <Server size={18} className="text-blue-500" />;
      case StepType.CONDITION: return <AlertTriangle size={18} className="text-amber-500" />;
      case StepType.NOTIFICATION: return <Bell size={18} className="text-rose-500" />;
      default: return <CheckCircle size={18} className="text-slate-500" />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)] gap-4 md:gap-6 relative">
      {/* Sidebar List */}
      <div className={`w-full md:w-80 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden transition-all
        ${!showMobileList ? 'hidden md:flex' : 'flex h-full'}
      `}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Mis Flujos</h3>
          <button 
            onClick={() => setShowAiModal(true)}
            className="p-2 bg-gradient-to-r from-rose-500 to-purple-600 text-white rounded-lg hover:shadow-md transition-all flex items-center gap-2 text-xs font-bold active:scale-95"
          >
            <Plus size={14} /> CREAR
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {workflows.map(w => (
            <div 
              key={w.id}
              onClick={() => handleSelectWorkflow(w.id)}
              className={`p-3 rounded-lg cursor-pointer border transition-all ${
                selectedWorkflowId === w.id 
                  ? 'bg-slate-50 border-purple-300 shadow-sm' 
                  : 'bg-white border-transparent hover:bg-slate-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <h4 className={`font-bold text-sm ${selectedWorkflowId === w.id ? 'text-slate-800' : 'text-slate-600'}`}>
                  {w.name}
                </h4>
                <div className={`w-2 h-2 rounded-full mt-1.5 ${w.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 font-medium uppercase">{w.steps.length} Nodos</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className={`flex-1 bg-slate-50 rounded-xl border border-slate-200 flex flex-col overflow-hidden relative
         ${showMobileList ? 'hidden md:flex' : 'flex h-full'}
      `}>
        {/* Dot Pattern Background */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

        {selectedWorkflow ? (
          <>
            <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 relative">
              <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setShowMobileList(true)}
                    className="md:hidden p-1.5 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="flex-1">
                    {isEditing ? (
                        <input 
                            type="text" 
                            value={selectedWorkflow.name}
                            onChange={(e) => updateWorkflowDetails('name', e.target.value)}
                            className="text-lg font-bold text-slate-800 bg-white border border-blue-300 rounded px-2 py-1 w-full focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nombre del Flujo"
                        />
                    ) : (
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            {selectedWorkflow.name}
                        </h2>
                    )}
                    
                    {isEditing ? (
                        <input 
                            type="text" 
                            value={selectedWorkflow.description}
                            onChange={(e) => updateWorkflowDetails('description', e.target.value)}
                            className="text-xs text-slate-500 bg-white border border-blue-300 rounded px-2 py-1 w-full mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Descripción breve"
                        />
                    ) : (
                        <p className="text-xs text-slate-500">{selectedWorkflow.description}</p>
                    )}
                  </div>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                 {isEditing ? (
                     <button 
                        onClick={saveChanges}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
                     >
                        <Save size={14} /> GUARDAR
                     </button>
                 ) : (
                     <button 
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
                     >
                        <Pencil size={14} /> EDITAR
                     </button>
                 )}
                 <button 
                    onClick={simulateExecution}
                    disabled={executingStep !== null || isEditing}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    {executingStep ? <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span> : <PlayCircle size={14} />}
                    TEST
                  </button>
                  <button 
                    onClick={() => toggleActive(selectedWorkflow.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors active:scale-95 ${
                      selectedWorkflow.active 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {selectedWorkflow.active ? 'ACTIVO' : 'INACTIVO'}
                  </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 relative z-0">
                <div className="max-w-3xl mx-auto space-y-8 pb-20">
                  {selectedWorkflow.steps.map((step, idx) => {
                    const isExecuting = executingStep === step.id;
                    const isCompleted = executionLog.includes(step.id);
                    
                    return (
                    <div 
                        key={step.id} 
                        className="relative group animation-fade-in" 
                        style={{ 
                            animationDelay: `${idx * 100}ms`,
                            animationFillMode: 'both' 
                        }}
                    >
                       {/* Connector Line */}
                       {idx > 0 && (
                           <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300"></div>
                       )}
                       {idx > 0 && (
                           <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-slate-300">
                               <div className="w-2 h-2 border-b-2 border-r-2 border-slate-300 rotate-45"></div>
                           </div>
                       )}

                      <div className={`
                        bg-white rounded-lg shadow-sm border transition-all duration-300 relative
                        ${getNodeColor(step.type)}
                        ${isExecuting ? 'ring-4 ring-emerald-100 border-emerald-500 scale-105 shadow-lg' : 'border-slate-200'}
                        ${isCompleted ? 'border-emerald-500' : ''}
                      `}>
                        {/* Node Header */}
                        <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-lg">
                            <div className="flex items-center gap-2">
                                {getNodeIcon(step.name, step.type)}
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{step.type}</span>
                            </div>
                            <div className="flex gap-1">
                                {isCompleted && <CheckCircle size={14} className="text-emerald-500" />}
                                {isEditing && (
                                    <button 
                                        onClick={() => deleteStep(selectedWorkflow.id, step.id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors p-1 hover:bg-slate-200 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Node Body */}
                        <div className="p-4">
                            {isEditing ? (
                                <input 
                                    type="text"
                                    value={step.name}
                                    onChange={(e) => updateStepDetails(step.id, 'name', e.target.value)}
                                    className="font-bold text-slate-800 mb-1 text-sm bg-white border border-blue-300 rounded px-2 py-1 w-full focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="Nombre del nodo"
                                />
                            ) : (
                                <h4 className="font-bold text-slate-800 mb-1 text-sm">{step.name}</h4>
                            )}
                            
                            {isEditing ? (
                                <textarea 
                                    value={step.description}
                                    onChange={(e) => updateStepDetails(step.id, 'description', e.target.value)}
                                    className="text-xs text-slate-500 font-mono bg-white p-2 rounded border border-blue-300 w-full focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                    rows={2}
                                    placeholder="Configuración técnica"
                                />
                            ) : (
                                <p className="text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">{step.description}</p>
                            )}
                        </div>
                      </div>
                    </div>
                  )})}

                  {/* Add Node Button */}
                  <div className="flex justify-center pt-4">
                     <button 
                        onClick={() => setShowAiModal(true)}
                        className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
                     >
                        <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center group-hover:border-purple-400 group-hover:bg-purple-50 transition-all shadow-sm">
                           <Plus size={20} className="text-slate-400 group-hover:text-purple-500" />
                        </div>
                        <span className="text-xs font-medium text-slate-400 group-hover:text-purple-600">Agregar Nodo</span>
                     </button>
                  </div>
                </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center z-10">
             <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <Sparkles size={32} className="text-slate-300" />
             </div>
             <h3 className="text-lg font-bold text-slate-600 mb-2">Lienzo de Automatización</h3>
             <p className="max-w-xs text-sm">Selecciona un flujo o usa la IA para diseñar una nueva automatización de procesos de negocio (BPM).</p>
          </div>
        )}
      </div>

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animation-fade-in">
            <div className="p-6 bg-gradient-to-br from-purple-600 to-indigo-700 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
              <h3 className="text-xl font-bold flex items-center gap-2 relative z-10">
                <Sparkles className="text-yellow-300" /> Arquitecto de Flujos
              </h3>
              <p className="text-purple-100 text-sm mt-1 relative z-10">
                Describe tu proceso y la IA diseñará los nodos necesarios (Webhooks, IFs, Valery, APIs).
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">¿Qué proceso deseas automatizar?</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ej: Cuando el inventario baje de 10 unidades, verifica si hay pedidos pendientes, y si es así, envía un WhatsApp al proveedor y un correo al gerente."
                className="w-full border border-slate-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-slate-700 text-sm shadow-inner bg-slate-50"
              />
              <div className="mt-4">
                  <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Plantillas Rápidas</p>
                  <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setAiPrompt("Crear un flujo que al completar una orden envíe un correo al cliente con el número de tracking y una guía de despacho.")}
                        className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs rounded font-medium border border-indigo-100 hover:bg-indigo-100 transition-colors active:scale-95"
                      >
                        Confirmación de Envío
                      </button>
                      <button 
                        onClick={() => setAiPrompt("Sincronizar inventario: Si hay movimiento en la web, actualizar base de datos Valery Administrativo y alertar si hay stock bajo.")}
                        className="px-2 py-1 bg-orange-50 text-orange-600 text-xs rounded font-medium border border-orange-100 hover:bg-orange-100 transition-colors active:scale-95"
                      >
                        Sincronizar Valery
                      </button>
                      <button 
                        onClick={() => setAiPrompt("Bot de WhatsApp que responda preguntas frecuentes sobre horarios y ubicaciones.")}
                        className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded font-medium border border-green-100 hover:bg-green-100 transition-colors active:scale-95"
                      >
                        WhatsApp Bot
                      </button>
                      <button 
                        onClick={() => setAiPrompt("Crear un flujo automatizado para gestión de Backorders: Cuando una orden entra en estado WAITING_STOCK, enviar alerta urgente a compras@waka.ve y notificar al cliente que su pedido está en espera de reposición.")}
                        className="px-2 py-1 bg-rose-50 text-rose-600 text-xs rounded font-medium border border-rose-100 hover:bg-rose-100 transition-colors active:scale-95"
                      >
                        Gestión de Backorders
                      </button>
                      <button 
                        onClick={() => setAiPrompt("Generar flujo de notificación de retraso: Si una orden cambia a WAITING_STOCK, enviar un correo de disculpa al cliente y notificar al equipo de logística.")}
                        className="px-2 py-1 bg-amber-50 text-amber-600 text-xs rounded font-medium border border-amber-100 hover:bg-amber-100 transition-colors active:scale-95"
                      >
                        Notificación de Retraso
                      </button>
                  </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm transition-colors active:scale-95"
              >
                Cancelar
              </button>
              <button 
                onClick={handleGenerateWorkflow}
                disabled={isGenerating}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-200 active:scale-95"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    Diseñando Nodos...
                  </>
                ) : (
                  <>Generar Flujo</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowBuilder;
