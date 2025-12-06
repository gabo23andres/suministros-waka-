
export const fetchExchangeRate = async (): Promise<number> => {
  try {
    // Intentamos conectar con una API pública de tasas de cambio
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - Servicio no disponible`);
    }

    const data = await response.json();
    
    if (!data || typeof data.rates?.VES !== 'number') {
        throw new Error('Formato de respuesta inválido del proveedor de tasas');
    }

    return data.rates.VES;
  } catch (error: any) {
    console.error("Exchange Rate Error:", error);
    // Propagate the error message so the UI can display it
    throw new Error(error.message || 'Error de conexión al obtener tasa');
  }
};
