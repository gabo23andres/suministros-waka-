
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiWorkflowResponse } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Standard Offline Templates (Not "Mock" anymore)
const OFFLINE_STOCK_WORKFLOW: GeminiWorkflowResponse = {
  name: "Flujo de Control de Stock (Estándar)",
  description: "Plantilla de automatización local para control de inventario bajo.",
  steps: [
    { name: "Trigger: Actualización de Inventario", type: "TRIGGER", description: "Se activa cuando cambia la cantidad de un producto." },
    { name: "Condition: Stock Crítico", type: "CONDITION", description: "Verifica si el stock es menor a 10 unidades." },
    { name: "Email: Alerta Gerencia", type: "NOTIFICATION", description: "Envía reporte a compras@waka.ve." },
    { name: "Action: Reordenar", type: "ACTION", description: "Genera orden de compra interna." }
  ]
};

const OFFLINE_SHIPPING_WORKFLOW: GeminiWorkflowResponse = {
  name: "Confirmación de Despacho (Estándar)",
  description: "Plantilla local para gestión de guías y notificaciones.",
  steps: [
    { name: "Trigger: Orden Completada", type: "TRIGGER", description: "Se activa cuando el estado de la orden cambia a COMPLETED." },
    { name: "System: Generar Guía", type: "ACTION", description: "Solicita número de control interno o guía de transporte." },
    { name: "Email: Cliente", type: "NOTIFICATION", description: "Envía Nota de Entrega y datos de transporte." },
    { name: "Log: Auditoría", type: "ACTION", description: "Registra la salida en el libro de despachos." }
  ]
};

const OFFLINE_VALERY_WORKFLOW: GeminiWorkflowResponse = {
  name: "Integración Administrativa Valery",
  description: "Conector de base de datos local para facturación fiscal.",
  steps: [
    { name: "Trigger: Nueva Venta Web", type: "TRIGGER", description: "Detecta una nueva orden confirmada." },
    { name: "DB: Verificar Cliente", type: "ACTION", description: "Consulta existencia de RIF en tabla de clientes Valery." },
    { name: "Logic: Validación Fiscal", type: "CONDITION", description: "Verifica que los datos fiscales estén completos." },
    { name: "DB: Insertar Factura", type: "ACTION", description: "Registra documento en espera de impresión fiscal." }
  ]
};

const OFFLINE_BACKORDER_WORKFLOW: GeminiWorkflowResponse = {
  name: "Gestión de Backorders (Reposición)",
  description: "Flujo de recuperación para pedidos sin stock.",
  steps: [
    { name: "Trigger: Estado WAITING_STOCK", type: "TRIGGER", description: "Se activa cuando una orden queda pendiente por falta de inventario." },
    { name: "Email: Alerta Compras", type: "NOTIFICATION", description: "Notifica urgencia de reposición a proveedores para los items faltantes." },
    { name: "Email: Notificación Cliente", type: "NOTIFICATION", description: "Informa al cliente sobre la demora y fecha estimada de despacho." },
    { name: "Task: Seguimiento", type: "ACTION", description: "Crea tarea de revisión de stock en 24 horas." }
  ]
};

const OFFLINE_ANALYSIS_RESPONSE = `
- **Tendencia de Demanda**: Se observa un incremento sostenido en la rotación de productos de red (Routers/Cables). Se sugiere aumentar stock de seguridad un 20%.
- **Eficiencia de Despacho**: El tiempo promedio de cierre de órdenes ha mejorado. Mantener el flujo actual de notificaciones.
- **Cobranza**: Revisar pedidos en estado 'Pendiente' con más de 48 horas para liberar stock comprometido.
`;

const OFFLINE_INVENTORY_OPTIMIZATION = `
### Estrategias de Optimización de Stock

1. **Reabastecimiento Crítico (Clase A)**:
   - Se detectan productos de alto valor con stock bajo. Sugerencia: Emitir orden de compra inmediata para evitar pérdida de ventas clave.

2. **Liquidación de Inventario (Clase C)**:
   - Los productos de baja rotación ocupan espacio valioso. Recomendación: Crear "Kits de Oferta" o aplicar descuentos del 15% para liberar almacén.

3. **Balance de Capital**:
   - Tienes capital inmovilizado en productos con exceso de stock. Ajusta los niveles máximos de reposición para el próximo trimestre.
`;

interface ServiceResponse<T> {
    data: T;
    error?: string;
    isFallback?: boolean;
}

export const generateWorkflowFromPrompt = async (prompt: string): Promise<ServiceResponse<GeminiWorkflowResponse>> => {
  const ai = getClient();
  const lowerPrompt = prompt.toLowerCase();
  
  // Intelligent Template Logic
  const getLocalTemplate = () => {
      if (lowerPrompt.includes('envío') || lowerPrompt.includes('shipping') || lowerPrompt.includes('tracking') || lowerPrompt.includes('guía') || lowerPrompt.includes('despacho')) {
          return { ...OFFLINE_SHIPPING_WORKFLOW, description: `Configuración basada en solicitud: "${prompt.substring(0, 30)}..."` };
      }
      if (lowerPrompt.includes('valery') || lowerPrompt.includes('administrativo') || lowerPrompt.includes('sincronizar') || lowerPrompt.includes('base de datos')) {
          return { ...OFFLINE_VALERY_WORKFLOW, description: `Integración DB: "${prompt.substring(0, 30)}..."` };
      }
      if (lowerPrompt.includes('backorder') || lowerPrompt.includes('waiting') || lowerPrompt.includes('reposición') || lowerPrompt.includes('stock negativo') || lowerPrompt.includes('retraso') || lowerPrompt.includes('delay')) {
          return { ...OFFLINE_BACKORDER_WORKFLOW, description: `Gestión de Demora: "${prompt.substring(0, 30)}..."` };
      }
      return { ...OFFLINE_STOCK_WORKFLOW, description: `Configuración Estándar: "${prompt.substring(0, 30)}..."` };
  };

  // If no AI client, use local templates
  if (!ai) {
    await new Promise(resolve => setTimeout(resolve, 800)); 
    return { data: getLocalTemplate(), isFallback: true };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{
            text: `Actúa como un Ingeniero de Sistemas Senior configurando un ERP.
            Crea un flujo de trabajo BPMN estructurado basado en esta solicitud: "${prompt}".
            
            Objetivos:
            1. Control de Inventarios y Logística.
            2. Comunicación Corporativa (Email, SMS).
            3. Integración SQL/ERP (Valery).
      
            Reglas:
            - Nombres técnicos y profesionales.
            - Estructura lógica.
            - Tipos: TRIGGER, ACTION, CONDITION, NOTIFICATION.
            - Respuesta en Español Neutro.`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nombre técnico del flujo" },
            description: { type: Type.STRING, description: "Descripción funcional" },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nombre del Nodo" },
                  type: { type: Type.STRING, enum: ["TRIGGER", "ACTION", "CONDITION", "NOTIFICATION"] },
                  description: { type: Type.STRING, description: "Configuración" }
                },
                required: ["name", "type", "description"]
              }
            }
          },
          required: ["name", "description", "steps"]
        }
      }
    });

    const text = response.text;
    if (!text) {
        throw new Error("Respuesta vacía del modelo");
    }
    return { data: JSON.parse(text) as GeminiWorkflowResponse };
  } catch (error: any) {
    console.warn("AI Service Error:", error);
    return { 
        data: getLocalTemplate(), 
        error: error.message || "Error de conexión con Gemini AI",
        isFallback: true
    };
  }
};

export const analyzeOrderTrends = async (orderSummary: string): Promise<ServiceResponse<string>> => {
    const ai = getClient();
    
    if (!ai) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { data: OFFLINE_ANALYSIS_RESPONSE, isFallback: true };
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
              parts: [{
                text: `Analiza los siguientes datos operativos de Suministros Waka C.A. y genera un reporte ejecutivo con 3 recomendaciones estratégicas: ${orderSummary}`
              }]
            },
            config: {
                systemInstruction: "Eres un Consultor de Negocios Senior. Genera respuestas formales, concisas y orientadas a resultados en Español."
            }
        });
        return { data: response.text || OFFLINE_ANALYSIS_RESPONSE };
    } catch (error: any) {
        console.warn("AI Analysis Error:", error);
        return { 
            data: OFFLINE_ANALYSIS_RESPONSE, 
            error: error.message || "Servicio de análisis no disponible",
            isFallback: true
        };
    }
}

export const analyzeInventoryOptimization = async (inventorySummary: string): Promise<ServiceResponse<string>> => {
    const ai = getClient();

    if (!ai) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return { data: OFFLINE_INVENTORY_OPTIMIZATION, isFallback: true };
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
              parts: [{
                text: `Como experto en Logística y Supply Chain, analiza estos datos de inventario y proporciona 3 estrategias concretas de optimización (Reabastecimiento, Liquidación, Estrategia ABC): ${inventorySummary}`
              }]
            },
            config: {
                systemInstruction: "Genera recomendaciones breves, técnicas y accionables en formato Markdown. Enfócate en reducir costos y mejorar el nivel de servicio."
            }
        });
        return { data: response.text || OFFLINE_INVENTORY_OPTIMIZATION };
    } catch (error: any) {
        console.warn("AI Optimization Error:", error);
        return { 
            data: OFFLINE_INVENTORY_OPTIMIZATION, 
            error: error.message || "Servicio de optimización no disponible",
            isFallback: true
        };
    }
}
