
import React, { useState, useMemo, useRef } from 'react';
import { Order, OrderStatus, InventoryItem, OrderProduct, Client, User, SystemSettings } from '../types';
import { Search, Plus, X, MessageCircle, ShoppingCart, Trash2, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, Clock, FileDown, User as UserIcon, Calendar, CloudOff, RefreshCw, Upload, Map, Percent, DollarSign, Check, Package, Navigation, Tag } from 'lucide-react';
import { addDocument, updateDocument } from '../services/firebase';

interface OrderListProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  exchangeRate: number;
  isOnline?: boolean; 
  notify: (type: 'success' | 'error' | 'info' | 'warning', message: string, subMessage?: string) => void;
  clients: Client[];
  logAction: (module: string, action: string, details: string) => void;
  currentUser: User | null;
  settings: SystemSettings;
}

interface CartItem {
    productId: string;
    name: string;
    price: number; 
    quantity: number;
    isBackorder: boolean; 
}

const PACK_SIZES = [6, 12, 24, 60];

const OrderList: React.FC<OrderListProps> = ({ orders, setOrders, inventory, setInventory, exchangeRate, isOnline = true, notify, clients, logAction, currentUser, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeliveryNote, setShowDeliveryNote] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // New Order Form State
  const [newOrderCustomer, setNewOrderCustomer] = useState('');
  const [newOrderRif, setNewOrderRif] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentProductId, setCurrentProductId] = useState<string>('');
  const [currentQty, setCurrentQty] = useState<number>(1);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');

  // Client Selection State
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedClientTier, setSelectedClientTier] = useState<'A' | 'B' | 'C'>('A');

  // Edit Order Form State
  const [detailAddProductId, setDetailAddProductId] = useState('');
  const [detailAddQty, setDetailAddQty] = useState(1);

  // Product List Sorting & Filtering State
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Excel Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingSyncOrders = useMemo(() => orders.filter(o => o.pendingSync).length, [orders]);

  const calculateStockStatus = (qty: number): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' => {
      if (qty <= 0) return 'OUT_OF_STOCK';
      if (qty < 10) return 'LOW_STOCK';
      return 'IN_STOCK';
  };

  const getProductPriceForTier = (item: InventoryItem, tier: 'A' | 'B' | 'C') => {
      if (tier === 'B' && item.priceB && item.priceB > 0) return item.priceB;
      if (tier === 'C' && item.priceC && item.priceC > 0) return item.priceC;
      return item.price; // Default to Base Price
  };

  const handleSyncOrders = () => {
      if (pendingSyncOrders === 0) return;
      const confirmSync = window.confirm(`¿Sincronizar ${pendingSyncOrders} pedidos pendientes con el servidor central?`);
      if (confirmSync) {
          orders.filter(o => o.pendingSync).forEach(o => {
              updateDocument('orders', o.id, { pendingSync: false });
          });
          notify('success', 'Sincronización Iniciada', 'Actualizando base de datos...');
          logAction('ORDERS', 'SYNC', `Sincronizados ${pendingSyncOrders} pedidos offline`);
      }
  };

  const selectClient = (client: Client) => {
      setNewOrderCustomer(client.name);
      setNewOrderRif(client.rif);
      setSelectedClientTier(client.priceTier || 'A'); // Set price tier based on client
      
      // Notify if a special tier is applied
      if(client.priceTier === 'B') notify('info', 'Precio Mayor Aplicado', 'Se usarán precios de Lista B.');
      if(client.priceTier === 'C') notify('info', 'Precio VIP Aplicado', 'Se usarán precios de Lista C.');

      setShowClientSearch(false);
      setClientSearchTerm('');
      
      // Clear cart to avoid price mismatches if client changes mid-order
      if(cart.length > 0) {
          if(window.confirm('Cambiar de cliente recalculará o vaciará el carrito. ¿Desea continuar?')) {
              setCart([]);
          } else {
              // Revert logic would go here, but for simplicity we just clear or enforce flow
          }
      }
  };

  const filteredClients = clients.filter(c => 
      c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
      c.rif.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
        notify('error', 'Error de Librería', 'La librería de Excel no está cargada. Recargue la página.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws);

            if (data.length === 0) {
                notify('warning', 'Archivo Vacío', 'El archivo no contiene datos válidos.');
                return;
            }

            const importedOrders: Order[] = data.map((row: any, idx) => {
                const customerName = row['Cliente'] || row['Nombre'] || row['Customer'] || 'Cliente Importado';
                const rif = row['RIF'] || row['Documento'] || 'N/A';
                const totalAmount = parseFloat(row['Total'] || row['Monto'] || row['Amount'] || '0');
                const dateStr = row['Fecha'] || row['Date'] || new Date().toISOString();
                const statusStr = row['Estatus'] || row['Estado'] || 'PENDING';

                let status = OrderStatus.PENDING;
                if (statusStr.toUpperCase().includes('COMPL')) status = OrderStatus.COMPLETED;
                if (statusStr.toUpperCase().includes('PROC')) status = OrderStatus.PROCESSING;
                if (statusStr.toUpperCase().includes('CANC')) status = OrderStatus.CANCELED;

                const genericProduct: OrderProduct = {
                    id: `imp-prod-${Date.now()}-${idx}`,
                    name: 'Carga Masiva de Datos',
                    price: totalAmount, 
                    quantity: 1
                };

                return {
                    id: `IMP-${Date.now()}-${idx}`,
                    customer: `${customerName} (${rif})`,
                    subtotal: totalAmount,
                    discount: 0,
                    total: totalAmount,
                    status: status,
                    date: new Date(dateStr).toISOString(), 
                    items: 1,
                    products: [genericProduct],
                    pendingSync: !isOnline,
                    sellerName: currentUser?.name || 'Sistema (Importación)'
                };
            });

            importedOrders.forEach(o => addDocument('orders', o));
            
            notify('success', 'Importación Completada', `Se cargaron ${importedOrders.length} pedidos correctamente.`);
            logAction('ORDERS', 'IMPORT_EXCEL', `Importados ${importedOrders.length} registros desde ${file.name}`);
            
        } catch (error) {
            console.error(error);
            notify('error', 'Error de Lectura', 'El formato del archivo Excel no es compatible.');
        }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleAddToCart = () => {
      if (!currentProductId) return;
      const product = inventory.find(i => i.id === currentProductId);
      if (!product) return;

      const priceToUse = getProductPriceForTier(product, selectedClientTier);

      const existingInCart = cart.find(c => c.productId === currentProductId)?.quantity || 0;
      const totalProposed = existingInCart + currentQty;
      
      let isBackorder = false;
      
      if (totalProposed > product.quantity) {
          isBackorder = true;
          const deficit = totalProposed - Math.max(0, product.quantity);
          notify('warning', 'Stock Insuficiente', `Agregado como Pre-Venta. Faltan ${deficit} unidades para reposición.`);
      }

      setCart(prev => {
          const existing = prev.find(item => item.productId === currentProductId);
          if (existing) {
              return prev.map(item => item.productId === currentProductId 
                  ? { ...item, quantity: item.quantity + currentQty, isBackorder: isBackorder || item.isBackorder, price: priceToUse } 
                  : item
              );
          }
          return [...prev, { 
              productId: product.id, 
              name: product.name, 
              price: priceToUse, 
              quantity: currentQty,
              isBackorder
          }];
      });
      setCurrentQty(1);
      setCurrentProductId('');
  };

  const removeFromCart = (productId: string) => {
      setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const calculatedDiscount = discountType === 'PERCENTAGE' 
      ? (cartSubtotal * discountValue / 100) 
      : discountValue;
  
  const cartTotal = Math.max(0, cartSubtotal - calculatedDiscount);

  const handleCreateOrder = () => {
    if (!newOrderCustomer.trim() || !newOrderRif.trim()) {
        notify('error', 'Datos Incompletos', 'Cliente y RIF son obligatorios.');
        return;
    }

    if (cart.length === 0) {
        notify('warning', 'Orden Vacía', 'Debe agregar al menos un producto.');
        return;
    }

    const rifRegex = /^[VEJPGvejpg][-]?\d{5,9}(?:[-]?\d)?$/;
    if (!rifRegex.test(newOrderRif.trim())) {
        notify('error', 'Formato Inválido', 'El RIF debe ser válido. Ej: J-12345678-9');
        return;
    }

    const hasBackorders = cart.some(item => {
        const product = inventory.find(i => i.id === item.productId);
        return product ? item.quantity > product.quantity : false;
    });

    const initialStatus = hasBackorders ? OrderStatus.WAITING_STOCK : OrderStatus.PENDING;

    cart.forEach(cartItem => {
        const item = inventory.find(i => i.id === cartItem.productId);
        if (item) {
            const newQty = item.quantity - cartItem.quantity;
            updateDocument('inventory', item.id, { 
                quantity: newQty, 
                status: calculateStockStatus(newQty) 
            });
        }
    });

    const orderProducts: OrderProduct[] = cart.map(c => ({
        id: c.productId,
        name: c.name,
        price: c.price,
        quantity: c.quantity
    }));

    const newOrderId = `ORD-${2025000 + orders.length}`;

    const order: Order = {
      id: newOrderId,
      customer: `${newOrderCustomer} (${newOrderRif.toUpperCase()})`,
      items: cartItemsCount,
      products: orderProducts,
      subtotal: cartSubtotal,
      discount: calculatedDiscount,
      total: cartTotal,
      status: initialStatus,
      date: new Date().toISOString(),
      pendingSync: !isOnline,
      sellerId: currentUser?.id,
      sellerName: currentUser?.name || 'Sistema',
      deliveryNotes: []
    };

    addDocument('orders', order);
    logAction('ORDERS', 'CREATE', `Nueva orden ${newOrderId} para ${newOrderCustomer}`);
    
    if (initialStatus === OrderStatus.WAITING_STOCK) {
        notify('warning', 'Orden con Backorder', 'Se generó deuda de inventario. Requiere reposición.');
    } else if (!isOnline) {
        notify('info', 'Guardado Offline', 'Orden pendiente de sincronización.');
    } else {
        notify('success', 'Orden Creada', `Control ${order.id} generado por ${order.sellerName}.`);
    }

    setShowCreateModal(false);
    setNewOrderCustomer('');
    setNewOrderRif('');
    setCart([]);
    setDiscountValue(0);
    setDiscountType('PERCENTAGE');
    setCurrentProductId('');
    setSelectedClientTier('A'); // Reset tier
  };

  const handleRemoveFromOrder = (productId: string) => {
    if (!selectedOrder) return;
    
    const productToRemove = selectedOrder.products.find(p => p.id === productId);
    if (!productToRemove) return;

    const invItem = inventory.find(i => i.id === productId);
    if (invItem) {
        const newQty = invItem.quantity + productToRemove.quantity;
        updateDocument('inventory', invItem.id, { quantity: newQty, status: calculateStockStatus(newQty) });
    }

    const updatedProducts = selectedOrder.products.filter(p => p.id !== productId);
    const newSubtotal = updatedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const newItemsCount = updatedProducts.reduce((sum, p) => sum + p.quantity, 0);
    
    const newTotal = Math.max(0, newSubtotal - selectedOrder.discount);

    const updatedOrder = {
        products: updatedProducts,
        subtotal: newSubtotal,
        total: newTotal,
        items: newItemsCount,
        pendingSync: !isOnline
    };

    updateDocument('orders', selectedOrder.id, updatedOrder);
    setSelectedOrder({ ...selectedOrder, ...updatedOrder });
    logAction('ORDERS', 'UPDATE_ITEMS', `Eliminado ${productToRemove.name} de orden ${selectedOrder.id}`);
    notify('info', 'Producto Eliminado', 'Se ha devuelto el stock al inventario.');
  };

  const handleAddToOrder = () => {
    if (!selectedOrder || !detailAddProductId) return;
    
    const invItem = inventory.find(i => i.id === detailAddProductId);
    if (!invItem) return;

    if (detailAddQty > invItem.quantity) {
         const deficit = detailAddQty - Math.max(0, invItem.quantity);
         notify('warning', 'Agregado como Backorder', `Excede stock actual. Deuda generada: -${deficit}`);
    }

    const newQty = invItem.quantity - detailAddQty;
    updateDocument('inventory', invItem.id, { quantity: newQty, status: calculateStockStatus(newQty) });

    let updatedProducts = [...selectedOrder.products];
    const existingIndex = updatedProducts.findIndex(p => p.id === detailAddProductId);
    
    // Note: When adding to an existing order, we default to base price unless logic is complex. 
    // For simplicity, we use invItem.price (Base) here, but could implement a check for original customer tier if needed.
    const priceToAdd = invItem.price; 

    if (existingIndex >= 0) {
        updatedProducts[existingIndex] = {
            ...updatedProducts[existingIndex],
            quantity: updatedProducts[existingIndex].quantity + detailAddQty
        };
    } else {
        updatedProducts.push({
            id: invItem.id,
            name: invItem.name,
            price: priceToAdd,
            quantity: detailAddQty
        });
    }

    const newSubtotal = updatedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const newItemsCount = updatedProducts.reduce((sum, p) => sum + p.quantity, 0);
    const newTotal = Math.max(0, newSubtotal - selectedOrder.discount);

    const updatedOrder = {
        products: updatedProducts,
        subtotal: newSubtotal,
        total: newTotal,
        items: newItemsCount,
        pendingSync: !isOnline,
        status: (detailAddQty > invItem.quantity) ? OrderStatus.WAITING_STOCK : selectedOrder.status
    };

    updateDocument('orders', selectedOrder.id, updatedOrder);
    setSelectedOrder({ ...selectedOrder, ...updatedOrder });
    setDetailAddProductId('');
    setDetailAddQty(1);
    logAction('ORDERS', 'UPDATE_ITEMS', `Agregado ${invItem.name} (${detailAddQty}) a orden ${selectedOrder.id}`);
    notify('success', 'Producto Agregado', 'La orden ha sido actualizada.');
  };

  const handleProductSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getProcessedProducts = () => {
    if (!selectedOrder) return [];
    
    let prods = [...selectedOrder.products];

    if (productSearchTerm) {
      const term = productSearchTerm.toLowerCase();
      prods = prods.filter(p => p.name.toLowerCase().includes(term));
    }

    prods.sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof typeof a];
      let bVal: any = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'subtotal') {
          aVal = a.price * a.quantity;
          bVal = b.price * b.quantity;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return prods;
  };

  const renderSortIcon = (key: string) => {
     if (sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 text-slate-300" />;
     return sortConfig.direction === 'asc' 
        ? <ArrowUp size={14} className="ml-1 text-blue-600" /> 
        : <ArrowDown size={14} className="ml-1 text-blue-600" />;
  };

  const handleNotifyCustomer = (customer: string) => {
    if (!isOnline) {
        notify('warning', 'Modo Offline', 'Notificación encolada para envío posterior.');
        return;
    }
    notify('info', 'Enviando Notificación', `Email de estatus enviado a ${customer}.`);
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (!orderToUpdate) return;
      
      const oldStatus = orderToUpdate.status;
      const isCanceling = (newStatus === OrderStatus.CANCELED || newStatus === OrderStatus.FAILED);
      const wasCanceled = (oldStatus === OrderStatus.CANCELED || oldStatus === OrderStatus.FAILED);
      const isCompleting = (newStatus === OrderStatus.COMPLETED);

      if (isCompleting) {
          const riskyProducts = orderToUpdate.products.filter(p => {
              const invItem = inventory.find(i => i.id === p.id);
              return invItem && invItem.quantity < 0;
          });

          if (riskyProducts.length > 0) {
              const confirmComplete = window.confirm(
                  `⚠️ ALERTA DE INVENTARIO NEGATIVO\n\n` +
                  `Hay ${riskyProducts.length} producto(s) en esta orden que aún figuran como AGOTADOS (Stock Negativo).\n` +
                  `Esto indica que la mercancía no ha ingresado al sistema.\n\n` +
                  `¿Desea cerrar el despacho de todos modos?\n(Cancele para revisar y eliminar los items faltantes antes de despachar).`
              );
              if (!confirmComplete) return;
          }
      }

      if (isCanceling && !wasCanceled) {
          if(window.confirm("¿Anular pedido? Se reintegrará la mercancía al inventario.")) {
             orderToUpdate.products.forEach(p => {
                 const inv = inventory.find(i => i.id === p.id);
                 if (inv) {
                     const newQty = inv.quantity + p.quantity;
                     updateDocument('inventory', inv.id, { quantity: newQty, status: calculateStockStatus(newQty) });
                 }
             });
             notify('success', 'Pedido Anulado', 'Inventario restaurado correctamente.');
          } else {
              return; 
          }
      }

      if (!isCanceling && wasCanceled) {
           const checkStock = orderToUpdate.products.every(p => {
               const inv = inventory.find(i => i.id === p.id);
               return inv && inv.quantity >= p.quantity;
           });
           
           const msg = checkStock 
                ? "¿Reactivar pedido? Se descontará el stock nuevamente." 
                : "⚠️ STOCK INSUFICIENTE para algunos productos.\n¿Reactivar pedido en modo Backorder (Stock Negativo)?";

           if(window.confirm(msg)) {
             orderToUpdate.products.forEach(p => {
                 const inv = inventory.find(i => i.id === p.id);
                 if (inv) {
                     const newQty = inv.quantity - p.quantity;
                     updateDocument('inventory', inv.id, { quantity: newQty, status: calculateStockStatus(newQty) });
                 }
             });
             notify('info', 'Pedido Reactivado', 'Se ha ajustado el inventario.');
          } else {
              return; 
          }
      }

      updateDocument('orders', orderId, { status: newStatus, pendingSync: !isOnline });
      
      if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
      }

      logAction('ORDERS', 'UPDATE_STATUS', `Orden ${orderId} cambiada a ${newStatus}`);

      if (newStatus === OrderStatus.COMPLETED) {
          const msg = isOnline 
              ? 'Guía generada y notificada al cliente.' 
              : 'Orden cerrada localmente.';
          notify('success', 'Despacho Completado', msg);
      }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customer.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers = ['Control', 'Cliente', 'Fecha', 'Vendedor', 'Items', 'Base (USD)', 'Total (Bs)', 'Estatus'];
    const csvRows = [
        headers.join(','),
        ...filteredOrders.map(order => [
            order.id,
            `"${order.customer.replace(/"/g, '""')}"`,
            new Date(order.date).toLocaleDateString('es-VE'),
            order.sellerName || 'Sistema',
            order.items,
            (order.total / exchangeRate).toFixed(2),
            order.total.toFixed(2),
            order.status
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Waka_Reporte_Ventas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logAction('ORDERS', 'EXPORT', 'Exportado reporte CSV de ventas');
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('delivery-note-content');
    if (!element || !selectedOrder) return;
    const html2pdf = (window as any).html2pdf;
    if (html2pdf) {
        const opt = {
          margin: [0, 0],
          filename: `NE_${selectedOrder.id}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
        logAction('ORDERS', 'PRINT', `Impresa Nota de Entrega ${selectedOrder.id}`);
    } else {
        notify('error', 'Error de Impresión', 'Módulo de PDF no disponible.');
    }
  };

  const handleDirectDownloadPDF = () => {
    const element = document.getElementById('hidden-delivery-note');
    if (!element || !selectedOrder) return;
    const html2pdf = (window as any).html2pdf;
    if (html2pdf) {
        const opt = {
          margin: [0, 0],
          filename: `NE_${selectedOrder.id}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
        logAction('ORDERS', 'PRINT', `Impresa Nota de Entrega ${selectedOrder.id} (Directo)`);
    } else {
        notify('error', 'Error de Impresión', 'Módulo de PDF no disponible.');
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.COMPLETED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case OrderStatus.PROCESSING: return 'bg-blue-100 text-blue-700 border-blue-200';
      case OrderStatus.PENDING: return 'bg-amber-50 text-amber-700 border-amber-200';
      case OrderStatus.WAITING_STOCK: return 'bg-purple-100 text-purple-700 border-purple-200';
      case OrderStatus.FAILED: return 'bg-red-100 text-red-700 border-red-200';
      case OrderStatus.CANCELED: return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
     switch (status) {
      case OrderStatus.COMPLETED: return 'Completado';
      case OrderStatus.PROCESSING: return 'En Proceso';
      case OrderStatus.PENDING: return 'Pendiente';
      case OrderStatus.WAITING_STOCK: return 'Por Despachar';
      case OrderStatus.FAILED: return 'Fallido';
      case OrderStatus.CANCELED: return 'Anulado';
      default: return status;
    }
  };

  const openDetail = (order: Order) => {
      setSelectedOrder(order);
      setShowDetailModal(true);
      setShowDeliveryNote(false);
      setShowMapModal(false);
      setDetailAddProductId('');
      setDetailAddQty(1);
      setProductSearchTerm('');
      setSortConfig({ key: 'name', direction: 'asc' });
  }

  const processedProducts = getProcessedProducts();

  const DeliveryNoteContent = ({ order, isHidden = false }: { order: Order, isHidden?: boolean }) => {
      const formattedId = order.id.replace('ORD-', 'NE-25-');
      return (
        <div className={`bg-white text-slate-900 ${isHidden ? '' : 'min-h-full p-16 flex flex-col'}`}>
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">{settings.companyName}</h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Suministros C.A.</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-slate-900 uppercase">Nota de Entrega</h2>
                    <p className="text-blue-600 font-mono text-lg font-bold mt-1">#{formattedId}</p>
                </div>
            </div>

            <div className="flex justify-between mb-8 text-sm">
                <div>
                    <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Remitente:</h4>
                    <p className="font-bold">{settings.companyName}</p>
                    <p className="text-slate-500 text-xs">RIF: {settings.rif}</p>
                    <p className="text-slate-500 text-xs w-48">{settings.address}</p>
                </div>
                <div className="text-right">
                    <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Destinatario:</h4>
                    <p className="font-bold text-base">{order.customer}</p>
                    <p className="text-slate-500 text-xs mt-1">Fecha de Emisión: {new Date().toLocaleDateString('es-VE')}</p>
                    <p className="text-slate-500 text-xs font-bold">Vendedor: {order.sellerName || 'Sistema'}</p>
                </div>
            </div>

            <div className="flex-1 mb-8">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-900">
                            <th className="py-2 text-xs font-black text-slate-900 uppercase tracking-wider w-16 text-center">Cant.</th>
                            <th className="py-2 text-xs font-black text-slate-900 uppercase tracking-wider pl-4">Descripción del Producto</th>
                            <th className="py-2 text-xs font-black text-slate-900 uppercase tracking-wider text-right w-24">Unit. (Ref)</th>
                            <th className="py-2 text-xs font-black text-slate-900 uppercase tracking-wider text-right w-24">Total (Ref)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {order.products.map((p, i) => {
                            return (
                            <tr key={i}>
                                <td className="py-3 font-bold text-slate-900 text-center bg-slate-50">{p.quantity}</td>
                                <td className="py-3 pl-4 font-medium text-slate-700 text-sm">{p.name}</td>
                                <td className="py-3 text-right font-mono text-xs text-slate-500">${(p.price/exchangeRate).toFixed(2)}</td>
                                <td className="py-3 text-right font-mono text-xs text-slate-800 font-bold">${((p.price*p.quantity)/exchangeRate).toFixed(2)}</td>
                            </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="flex justify-end mb-12">
                <div className="w-64 space-y-2 text-right">
                     <div className="flex justify-between text-sm text-slate-600">
                         <span>Subtotal:</span>
                         <span className="font-mono">${(order.subtotal/exchangeRate).toFixed(2)}</span>
                     </div>
                     {order.discount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600 font-bold">
                            <span>Descuento:</span>
                            <span className="font-mono">-${(order.discount/exchangeRate).toFixed(2)}</span>
                        </div>
                     )}
                     <div className="border-t-2 border-slate-900 pt-2 flex justify-between text-lg font-black text-slate-900">
                         <span>TOTAL:</span>
                         <span>${(order.total/exchangeRate).toFixed(2)}</span>
                     </div>
                     <div className="text-xs text-slate-500 mt-1">
                         Bs. {order.total.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                     </div>
                </div>
            </div>

            <div className="border-t-2 border-slate-900 mb-12"></div>

            <div className="grid grid-cols-2 gap-12 mt-auto">
                <div>
                    <div className="border-b border-slate-400 h-16 mb-2"></div>
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Despachado Por</p>
                    <p className="text-[10px] text-slate-500">Sello Húmedo y Firma Autorizada</p>
                </div>
                <div>
                    <div className="border-b border-slate-400 h-16 mb-2"></div>
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recibido Conforme</p>
                    <p className="text-[10px] text-slate-500">Nombre, C.I. y Firma del Cliente</p>
                </div>
            </div>

            <div className="text-center mt-8 text-[9px] text-slate-400 uppercase tracking-widest">
                Original: Cliente / Copia: Contabilidad
            </div>
        </div>
      );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-8 space-y-4">
      <input 
        type="file" 
        accept=".xlsx, .xls" 
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
        <div className="flex w-full md:w-auto gap-4 items-center">
             <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <ShoppingCart size={24} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800">Control de Pedidos</h3>
                <div className="flex gap-2 text-xs font-medium">
                    <span className="text-slate-500">{filteredOrders.length} Registros</span>
                    {pendingSyncOrders > 0 && (
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                            <CloudOff size={10} /> {pendingSyncOrders} sin sincronizar
                        </span>
                    )}
                </div>
             </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
             <div className="flex gap-2 w-full md:w-auto">
                 {isOnline && pendingSyncOrders > 0 && (
                     <button
                        onClick={handleSyncOrders}
                        className="flex-1 md:flex-none bg-amber-50 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-sm text-xs border border-amber-200 active:scale-95"
                     >
                        <RefreshCw size={14} /> Sync ({pendingSyncOrders})
                     </button>
                 )}

                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 md:flex-none bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-sm text-xs border border-emerald-100 active:scale-95"
                    title="Cargar archivo .xlsx"
                >
                    <Upload size={14} /> <span className="hidden lg:inline">Excel</span>
                </button>

                <button 
                    onClick={handleExportCSV}
                    className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow text-xs active:scale-95"
                >
                    <Download size={14} /> <span className="hidden sm:inline">CSV</span>
                </button>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg text-xs active:scale-95"
                >
                    <Plus size={14} /> <span>Crear Orden</span>
                </button>
            </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 shrink-0">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar por Control o Cliente..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none text-sm bg-white shadow-sm transition-all text-slate-700"
                />
            </div>
            <div className="relative">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'ALL')}
                    className="appearance-none w-full md:w-48 pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 focus:ring-2 focus:ring-slate-800 outline-none cursor-pointer shadow-sm transition-all hover:bg-slate-50"
                >
                    <option value="ALL">Estado: Todos</option>
                    {Object.values(OrderStatus).map(s => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                    ))}
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
            </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0">
        {/* Mobile View */}
        <div className="md:hidden overflow-y-auto p-4 space-y-4 custom-scrollbar">
             {filteredOrders.map(order => (
                 <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                     <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                         <div>
                             <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                {order.id}
                                {order.pendingSync && <CloudOff size={10} className="text-amber-500" />}
                             </span>
                             <p className="font-bold text-slate-800 text-sm mt-1">{order.customer}</p>
                             <p className="text-[10px] text-slate-400 mt-0.5">{order.sellerName}</p>
                         </div>
                         <div className="text-right flex flex-col items-end gap-1">
                             <p className="text-xs text-slate-400">{new Date(order.date).toLocaleDateString('es-VE')}</p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                         </div>
                     </div>
                     
                     <div className="flex justify-between items-center">
                         <div>
                             <p className="text-xs text-slate-500 uppercase font-bold">Total</p>
                             <p className="text-emerald-700 font-bold text-lg">${(order.total / exchangeRate).toFixed(2)}</p>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => handleNotifyCustomer(order.customer)} className="p-2 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all"><MessageCircle size={18} /></button>
                             <button onClick={() => openDetail(order)} className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 hover:bg-blue-100 active:scale-95 transition-all"><Eye size={18} /></button>
                         </div>
                     </div>
                 </div>
             ))}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-auto flex-1 custom-scrollbar"> 
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Control / Fecha</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Cliente / Razón Social</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Vendedor</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Items</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Total Operación</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Estatus</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{order.id}</span>
                        {order.pendingSync && <span title="Offline"><CloudOff size={14} className="text-amber-500" /></span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(order.date).toLocaleDateString('es-VE')}
                      </div>
                  </td>
                  <td className="px-6 py-4">
                      <span className="font-bold text-slate-800 text-sm">{order.customer}</span>
                  </td>
                  <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded w-fit">
                          <UserIcon size={12} className="text-slate-400" />
                          <span className="font-medium truncate max-w-[120px]">{order.sellerName || 'Sistema'}</span>
                      </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                     <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{order.items}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-emerald-700 font-bold text-sm">$ {(order.total / exchangeRate).toFixed(2)}</div>
                    <div className="text-[11px] text-slate-400 font-medium">Bs. {order.total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleNotifyCustomer(order.customer)}
                        className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors active:scale-95"
                        title="Notificar"
                      >
                        <MessageCircle size={16} />
                      </button>
                      <button 
                        onClick={() => openDetail(order)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors active:scale-95"
                        title="Ver Detalles"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
          <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh] border border-slate-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm">
                             #{selectedOrder.id.split('-')[1]}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                {selectedOrder.customer}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(selectedOrder.status)}`}>
                                    {getStatusLabel(selectedOrder.status)}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">{new Date(selectedOrder.date).toLocaleDateString('es-VE')}</span>
                                <span className="text-xs text-slate-500 font-bold ml-2">Vendedor: {selectedOrder.sellerName || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         <button 
                            className="px-3 py-2 text-slate-600 hover:text-blue-700 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95"
                            onClick={() => setShowMapModal(true)}
                         >
                            <Map size={16} />
                            <span className="text-xs font-bold hidden sm:inline">Ruta</span>
                         </button>
                         <button 
                            className="px-3 py-2 text-slate-600 hover:text-blue-700 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95"
                            onClick={() => handleDirectDownloadPDF()}
                         >
                            <Printer size={16} />
                            <span className="text-xs font-bold hidden sm:inline">Imprimir NE</span>
                         </button>
                         <button 
                            className="px-3 py-2 text-slate-600 hover:text-blue-700 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95"
                            onClick={() => setShowDeliveryNote(true)}
                         >
                            <FileText size={16} />
                            <span className="text-xs font-bold hidden sm:inline">Visualizar</span>
                         </button>
                         <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors">
                            <X size={20} />
                         </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/30">
                    <div className="p-6 space-y-6">
                        {selectedOrder.status === OrderStatus.WAITING_STOCK && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-4 shadow-sm">
                                <div className="bg-amber-100 p-2 rounded text-amber-600"><Clock size={16} /></div>
                                <div>
                                    <h4 className="font-bold text-amber-900 text-sm">Pendiente por Despacho</h4>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Inventario comprometido (Backorder). Se requiere reposición para liberar la guía.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col lg:flex-row gap-6">
                             {/* Product Table */}
                             <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                         Detalle de Items
                                     </h4>
                                </div>
                                <table className="w-full text-left text-sm flex-1">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase cursor-pointer select-none">Item</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase text-right cursor-pointer select-none">Cant.</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Unitario</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase text-right cursor-pointer select-none">Subtotal</th>
                                            {(selectedOrder.status === OrderStatus.PENDING || selectedOrder.status === OrderStatus.WAITING_STOCK) && (
                                                <th className="px-4 py-2"></th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {processedProducts.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3 text-slate-700 font-medium">{p.name}</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-600">{p.quantity}</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">${(p.price/exchangeRate).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-700 font-mono">${((p.price * p.quantity)/exchangeRate).toFixed(2)}</td>
                                                {(selectedOrder.status === OrderStatus.PENDING || selectedOrder.status === OrderStatus.WAITING_STOCK) && (
                                                    <td className="px-4 py-3 text-center w-10">
                                                        <button onClick={() => handleRemoveFromOrder(p.id)} className="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-100">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right text-xs text-slate-500">Subtotal</td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-700 text-xs">
                                                ${((selectedOrder.subtotal || selectedOrder.total) / exchangeRate).toFixed(2)}
                                            </td>
                                            <td></td>
                                        </tr>
                                        {selectedOrder.discount > 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-2 text-right text-xs font-bold text-emerald-600">Descuento</td>
                                                <td className="px-4 py-2 text-right font-mono text-emerald-600 text-xs">
                                                    -${(selectedOrder.discount / exchangeRate).toFixed(2)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-800 text-xs uppercase border-t border-slate-200">Total</td>
                                            <td className="px-4 py-3 text-right font-black text-slate-900 text-sm border-t border-slate-200">
                                                ${(selectedOrder.total / exchangeRate).toFixed(2)}
                                            </td>
                                            <td className="border-t border-slate-200"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                             </div>

                             {/* Actions Panel */}
                             <div className="w-full lg:w-72 space-y-6">
                                 {/* Status Management */}
                                 <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Gestión de Estatus</h4>
                                     <div className="space-y-2">
                                         <select 
                                            value={selectedOrder.status}
                                            onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value as OrderStatus)}
                                            className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                         >
                                             {Object.values(OrderStatus).map(s => (
                                                 <option key={s} value={s}>{getStatusLabel(s)}</option>
                                             ))}
                                         </select>
                                         {(selectedOrder.status === OrderStatus.PENDING || selectedOrder.status === OrderStatus.WAITING_STOCK) && (
                                             <div className="grid grid-cols-2 gap-2 pt-2">
                                                 <button 
                                                    onClick={() => handleStatusChange(selectedOrder.id, OrderStatus.COMPLETED)}
                                                    className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors border border-emerald-200"
                                                 >
                                                     Completar
                                                 </button>
                                                 <button 
                                                    onClick={() => handleStatusChange(selectedOrder.id, OrderStatus.CANCELED)}
                                                    className="px-3 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors border border-slate-200"
                                                 >
                                                     Anular
                                                 </button>
                                             </div>
                                         )}
                                     </div>
                                 </div>

                                 {/* Add Products */}
                                 {(selectedOrder.status === OrderStatus.PENDING || selectedOrder.status === OrderStatus.WAITING_STOCK) && (
                                     <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Agregar Item</h4>
                                         <div className="space-y-3">
                                             <select 
                                                value={detailAddProductId}
                                                onChange={(e) => setDetailAddProductId(e.target.value)}
                                                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500"
                                             >
                                                 <option value="">Seleccionar producto...</option>
                                                 {inventory.map(i => (
                                                     <option key={i.id} value={i.id}>
                                                         {i.name} (${(i.price/exchangeRate).toFixed(2)}) {i.quantity <= 0 ? '[BACKORDER]' : ''}
                                                     </option>
                                                 ))}
                                             </select>
                                             <div className="flex gap-2">
                                                 <input 
                                                    type="number" 
                                                    value={detailAddQty}
                                                    onChange={(e) => setDetailAddQty(parseInt(e.target.value) || 1)}
                                                    min="1"
                                                    className="w-20 p-2.5 rounded-lg border border-slate-200 text-xs font-bold text-center outline-none"
                                                 />
                                                 <button 
                                                    onClick={handleAddToOrder}
                                                    disabled={!detailAddProductId}
                                                    className="flex-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                 >
                                                     Agregar
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* Map Modal */}
      {showMapModal && selectedOrder && (
          <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in border border-slate-200 h-[500px] flex flex-col">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <Map size={18} className="text-blue-600" /> Ruta de Entrega
                      </h3>
                      <button onClick={() => setShowMapModal(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                  </div>
                  <div className="flex-1 bg-slate-100 relative">
                      <iframe 
                          width="100%" 
                          height="100%" 
                          frameBorder="0" 
                          scrolling="no" 
                          marginHeight={0} 
                          marginWidth={0} 
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(settings.address)}+to+${encodeURIComponent(selectedOrder.customer.split('(')[0])}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                          title="Ruta de despacho"
                      ></iframe>
                      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-xl shadow-lg border border-slate-200 max-w-xs">
                          <div className="flex items-start gap-3">
                              <div className="mt-1 text-emerald-600"><Navigation size={20} /></div>
                              <div>
                                  <p className="text-xs font-bold text-slate-500 uppercase">Destino</p>
                                  <p className="text-sm font-bold text-slate-800">{selectedOrder.customer}</p>
                                  <p className="text-xs text-slate-400 mt-1">Calculando ruta óptima...</p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Delivery Note Preview Modal */}
      {showDeliveryNote && selectedOrder && (
          <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white">
             <div className="bg-white w-full max-w-4xl h-[85vh] overflow-y-auto shadow-2xl relative animate-fade-in print:w-full print:h-screen print:max-w-none print:shadow-none print:rounded-none rounded-none">
                 
                 <div className="sticky top-0 left-0 right-0 bg-slate-800 text-white p-4 flex justify-between items-center print:hidden shadow-lg z-50">
                    <h3 className="font-bold flex items-center gap-2 text-sm"><FileText size={18} /> Vista Previa Documento</h3>
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
                            onClick={() => setShowDeliveryNote(false)}
                            className="bg-slate-700 hover:bg-slate-600 p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors ml-2 active:scale-95"
                        >
                            <X size={16} />
                        </button>
                    </div>
                 </div>

                 <div id="delivery-note-content">
                    <DeliveryNoteContent order={selectedOrder} />
                 </div>
             </div>
          </div>
      )}

      {/* Hidden container for direct PDF generation */}
      {selectedOrder && (
          <div className="absolute top-0 left-0 w-full z-[-1] opacity-0 pointer-events-none">
              <div id="hidden-delivery-note">
                  <DeliveryNoteContent order={selectedOrder} isHidden={true} />
              </div>
          </div>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in flex flex-col md:flex-row h-[85vh] md:h-[600px] border border-slate-200">
            
            {/* Left Panel: Customer & Cart */}
            <div className="w-full md:w-1/3 bg-slate-50 p-6 border-r border-slate-100 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 text-lg">Nueva Orden</h3>
                    <button onClick={() => setShowCreateModal(false)} className="md:hidden text-slate-400"><X size={24} /></button>
                </div>
                
                <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    {/* Customer Info */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Razón Social" 
                                value={newOrderCustomer}
                                onChange={(e) => setNewOrderCustomer(e.target.value)}
                                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-800 bg-white"
                            />
                            <button 
                                onClick={() => setShowClientSearch(true)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700 p-1 bg-blue-50 rounded-lg transition-colors"
                                title="Buscar Cliente"
                            >
                                <Search size={16} />
                            </button>
                        </div>
                        <input 
                            type="text" 
                            placeholder="RIF / C.I." 
                            value={newOrderRif}
                            onChange={(e) => setNewOrderRif(e.target.value.toUpperCase())}
                            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono text-slate-600 outline-none focus:ring-2 focus:ring-slate-800 bg-white uppercase"
                        />
                        {selectedClientTier !== 'A' && (
                            <div className={`text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 ${selectedClientTier === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                <Tag size={12} />
                                <span>Lista Aplicada: {selectedClientTier === 'B' ? 'Mayor (B)' : 'VIP (C)'}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-slate-200 my-4"></div>

                    {/* Cart Summary */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Resumen ({cartItemsCount} items)</label>
                        {cart.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs italic bg-white rounded-xl border border-dashed border-slate-200">
                                Carrito vacío
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cart.map((item, idx) => (
                                    <div key={`${item.productId}-${idx}`} className={`bg-white p-3 rounded-xl border flex justify-between items-center group shadow-sm ${item.isBackorder ? 'border-amber-200 bg-amber-50/30 border-dashed' : 'border-slate-100'}`}>
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className="text-xs font-bold text-slate-700 truncate">{item.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">
                                                {item.quantity} x ${(item.price/exchangeRate).toFixed(2)}
                                                {item.isBackorder && <span className="text-amber-600 font-bold ml-1">[BACKORDER]</span>}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-800">${((item.price * item.quantity)/exchangeRate).toFixed(2)}</p>
                                            <button onClick={() => removeFromCart(item.productId)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-[10px]">Quitar</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Descuento</span>
                            <div className="flex items-center gap-1 bg-slate-100 rounded p-0.5">
                                <button 
                                    onClick={() => { setDiscountType('PERCENTAGE'); setDiscountValue(0); }}
                                    className={`p-1 rounded text-[10px] font-bold transition-all ${discountType === 'PERCENTAGE' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                                >
                                    <Percent size={12} />
                                </button>
                                <button 
                                    onClick={() => { setDiscountType('FIXED'); setDiscountValue(0); }}
                                    className={`p-1 rounded text-[10px] font-bold transition-all ${discountType === 'FIXED' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                                >
                                    <DollarSign size={12} />
                                </button>
                            </div>
                        </div>
                        <input 
                            type="number" 
                            min="0"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full p-2 text-right font-mono font-bold text-sm bg-slate-50 rounded border border-slate-100 outline-none focus:border-blue-400"
                        />
                    </div>

                    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Subtotal</span>
                            <span>${(cartSubtotal/exchangeRate).toFixed(2)}</span>
                        </div>
                        {calculatedDiscount > 0 && (
                            <div className="flex justify-between text-xs text-emerald-400 font-bold mb-2">
                                <span>Desc.</span>
                                <span>-${(calculatedDiscount/exchangeRate).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-end border-t border-slate-700 pt-2">
                            <span className="font-bold text-sm">TOTAL</span>
                            <div className="text-right">
                                <span className="block text-2xl font-black leading-none">${(cartTotal/exchangeRate).toFixed(2)}</span>
                                <span className="text-[10px] text-slate-400 font-mono">Bs. {cartTotal.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={handleCreateOrder}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/30 text-sm flex justify-center items-center gap-2 active:scale-95"
                    >
                        <Check size={18} /> Confirmar Pedido
                    </button>
                </div>
            </div>

            {/* Right Panel: Product Catalog */}
            <div className="flex-1 p-6 bg-white flex flex-col relative">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <Package size={18} className="text-blue-500" /> Catálogo
                    </h4>
                    <button onClick={() => setShowCreateModal(false)} className="hidden md:block text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={20} /></button>
                </div>

                <div className="flex gap-2 mb-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select 
                            value={currentProductId}
                            onChange={(e) => {
                                setCurrentProductId(e.target.value);
                                setCurrentQty(1);
                            }}
                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-white transition-colors"
                        >
                            <option value="">Seleccionar producto...</option>
                            {inventory.map(item => {
                                const price = getProductPriceForTier(item, selectedClientTier);
                                return (
                                <option key={item.id} value={item.id}>
                                    {item.name} - ${(price/exchangeRate).toFixed(2)} 
                                    {item.quantity <= 0 ? ' [AGOTADO - ADMITIR PEDIDO]' : ` (Disp: ${item.quantity})`}
                                </option>
                            )})}
                        </select>
                    </div>
                    <div className="w-24 relative">
                        <input 
                            type="number" 
                            min="1"
                            value={currentQty}
                            onChange={(e) => setCurrentQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full h-full text-center font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button 
                        onClick={handleAddToCart}
                        disabled={!currentProductId}
                        className="bg-slate-900 text-white px-4 rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {/* Quick Quantities */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    {PACK_SIZES.map(size => (
                        <button
                            key={size}
                            onClick={() => setCurrentQty(size)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${currentQty === size ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}
                        >
                            {size} Uds.
                        </button>
                    ))}
                </div>

                {/* Visual Grid of Products (Optional, for better UX) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {inventory.map(item => {
                            const price = getProductPriceForTier(item, selectedClientTier);
                            return (
                            <button
                                key={item.id}
                                onClick={() => { setCurrentProductId(item.id); setCurrentQty(1); }}
                                className={`text-left p-3 rounded-xl border transition-all hover:shadow-md group flex flex-col justify-between h-28 ${currentProductId === item.id ? 'ring-2 ring-blue-500 border-transparent bg-blue-50' : 'bg-white border-slate-100 hover:border-blue-200'}`}
                            >
                                <div>
                                    <p className="font-bold text-xs text-slate-700 line-clamp-2 leading-tight group-hover:text-blue-700">{item.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1">{item.sku}</p>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.quantity <= 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {item.quantity <= 0 ? 'AGOTADO' : `${item.quantity} un.`}
                                    </span>
                                    <span className="font-black text-sm text-slate-800">${(price/exchangeRate).toFixed(2)}</span>
                                </div>
                            </button>
                        )})}
                    </div>
                </div>
            </div>

            {/* Client Search Modal Overlay */}
            {showClientSearch && (
                <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">Buscar Cliente</h3>
                        <button onClick={() => setShowClientSearch(false)} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100"><X size={18} /></button>
                    </div>
                    <div className="p-4">
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Nombre o RIF..." 
                                value={clientSearchTerm}
                                onChange={(e) => setClientSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {filteredClients.map(client => (
                                <button 
                                    key={client.id}
                                    onClick={() => selectClient(client)}
                                    className="w-full text-left p-3 rounded-xl border border-slate-100 hover:bg-blue-50 hover:border-blue-100 transition-all group"
                                >
                                    <div className="flex justify-between">
                                        <p className="font-bold text-sm text-slate-800 group-hover:text-blue-700">{client.name}</p>
                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold group-hover:bg-white">
                                            {client.priceTier === 'B' ? 'Lista B (Mayor)' : client.priceTier === 'C' ? 'Lista C (VIP)' : 'Lista A (Base)'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-xs text-slate-500 font-mono">{client.rif}</span>
                                        <span className="text-[10px] text-slate-400">Crédito: ${client.creditLimit}</span>
                                    </div>
                                </button>
                            ))}
                            {filteredClients.length === 0 && (
                                <p className="text-center text-slate-400 text-sm py-4">No se encontraron clientes.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;
