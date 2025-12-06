
// --- LOCAL SIMULATION SERVICE (MOCK FIREBASE) ---
// ROBUST STABLE VERSION
// Este servicio reemplaza la conexión fallida a Firebase Cloud para eliminar errores
// y garantizar que la aplicación funcione al 100% en modo local/demostración.
// Incluye manejo de errores para corrupción de datos y límites de almacenamiento.

export type CollectionName = 
  | 'orders' 
  | 'inventory' 
  | 'users' 
  | 'clients' 
  | 'workflows' 
  | 'tasks' 
  | 'raw_materials' 
  | 'production_orders' 
  | 'audit_logs' 
  | 'settings'
  | 'notifications_history';

// Sistema de Eventos para simular "Real-Time" (Suscripciones)
const listeners: Record<string, Array<(data: any[]) => void>> = {};

// Helper: Leer datos del LocalStorage de forma segura (Autocuración)
const getCollectionData = (collection: CollectionName): any[] => {
    try {
        const key = `waka_db_${collection}`;
        const stored = localStorage.getItem(key);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch (e) {
        console.error(`[DB Error] Corrupción de datos en ${collection}. Reseteando colección.`, e);
        // Si hay error de parsing (datos corruptos), retornamos array vacío para no romper la app
        // y limpiamos la entrada corrupta
        try {
            localStorage.removeItem(`waka_db_${collection}`);
        } catch (cleanupErr) {
            console.error("Error cleaning up corrupt DB", cleanupErr);
        }
        return [];
    }
};

// Helper: Escribir datos y notificar a los componentes
const saveAndNotify = (collection: CollectionName, data: any[]) => {
    try {
        const key = `waka_db_${collection}`;
        const payload = JSON.stringify(data);
        localStorage.setItem(key, payload);
        
        // Notificar a los suscriptores
        if (listeners[collection]) {
            listeners[collection].forEach(callback => callback(data));
        }
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.error("Critical: LocalStorage Full. Cannot save data.");
            alert("⚠️ Memoria llena. No se pueden guardar más datos localmente. Considere borrar el historial de auditoría o exportar datos.");
        } else {
            console.error("Error writing local DB", e);
        }
    }
};

// 1. Subscribe (Simula onSnapshot de Firebase)
export const subscribeToCollection = <T>(
  collectionName: CollectionName, 
  callback: (data: T[]) => void
) => {
  // Registrar el listener
  if (!listeners[collectionName]) {
      listeners[collectionName] = [];
  }
  listeners[collectionName].push(callback);

  // Enviar datos iniciales inmediatamente (Next tick para simular asincronía y evitar bloqueos UI)
  setTimeout(() => {
      try {
          const initialData = getCollectionData(collectionName);
          callback(initialData as T[]);
      } catch (err) {
          console.error(`Error in subscription callback for ${collectionName}`, err);
          callback([]); // Fallback seguro
      }
  }, 0);

  // Retornar función de limpieza (unsubscribe)
  return () => {
      if (listeners[collectionName]) {
          listeners[collectionName] = listeners[collectionName].filter(cb => cb !== callback);
      }
  };
};

// 2. Add Document
export const addDocument = async (collectionName: CollectionName, data: any) => {
    try {
        const currentData = getCollectionData(collectionName);
        
        // Generar ID si no viene uno
        const newId = data.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newItem = { ...data, id: newId };
        
        const newData = [...currentData, newItem];
        saveAndNotify(collectionName, newData);
        
        return newId;
    } catch (e) {
        console.error("Error in addDocument", e);
        throw e;
    }
};

// 3. Set Document (Crear o Sobrescribir con ID específico)
export const setDocument = async (collectionName: CollectionName, id: string, data: any) => {
    try {
        const currentData = getCollectionData(collectionName);
        const index = currentData.findIndex(item => item.id === id);
        
        let newData;
        if (index >= 0) {
            // Actualizar existente (merge superficial)
            newData = [...currentData];
            newData[index] = { ...currentData[index], ...data, id };
        } else {
            // Crear nuevo
            newData = [...currentData, { ...data, id }];
        }
        
        saveAndNotify(collectionName, newData);
    } catch (e) {
        console.error("Error in setDocument", e);
    }
};

// 4. Update Document
export const updateDocument = async (collectionName: CollectionName, id: string, data: any) => {
    try {
        const currentData = getCollectionData(collectionName);
        let found = false;
        const newData = currentData.map(item => {
            if (item.id === id) {
                found = true;
                return { ...item, ...data }; // Merge de campos
            }
            return item;
        });
        
        if (found) {
            saveAndNotify(collectionName, newData);
        } else {
            console.warn(`Document ${id} not found in ${collectionName} to update.`);
        }
    } catch (e) {
        console.error("Error in updateDocument", e);
    }
};

// 5. Delete Document
export const deleteDocument = async (collectionName: CollectionName, id: string) => {
    try {
        const currentData = getCollectionData(collectionName);
        const newData = currentData.filter(item => item.id !== id);
        
        saveAndNotify(collectionName, newData);
    } catch (e) {
        console.error("Error in deleteDocument", e);
    }
};

// 6. Check Empty (Para el Seeding inicial)
export const isCollectionEmpty = async (collectionName: CollectionName): Promise<boolean> => {
    try {
        const data = getCollectionData(collectionName);
        return data.length === 0;
    } catch (e) {
        return true; // Asumir vacío si hay error para permitir re-intento de seed
    }
};

// Exportar objeto vacío 'db' para mantener compatibilidad de importaciones
export const db = {};
