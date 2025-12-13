
export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  WAITING_STOCK = 'WAITING_STOCK', // New status for backorders
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED'
}

export enum StepType {
  TRIGGER = 'TRIGGER',
  ACTION = 'ACTION',
  CONDITION = 'CONDITION',
  NOTIFICATION = 'NOTIFICATION'
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  description: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  steps: WorkflowStep[];
}

export interface OrderProduct {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isBackorder?: boolean;
}

export interface Order {
  id: string;
  customer: string;
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  date: string;
  items: number;
  products: OrderProduct[];
  workflowId?: string;
  pendingSync?: boolean;
  sellerId?: string;
  sellerName?: string;
  deliveryNotes?: { date: string; note: string; user: string }[];
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number; // Base Price (Tier A)
  priceB?: number; // Wholesale (Tier B)
  priceC?: number; // VIP/Distributor (Tier C)
  category: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface RawMaterial {
  id: string;
  name: string;
  code: string;
  unit: 'L' | 'KG' | 'UND' | 'M' | 'SACO';
  quantity: number;
  minLevel: number;
  cost: number;
}

export interface ProductionOrder {
  id: string;
  date: string;
  targetProductId: string;
  targetProductName: string;
  quantityTarget: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  consumedMaterials: {
      materialId: string;
      materialName: string;
      quantity: number;
  }[];
  notes?: string;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'ACCOUNTANT' | 'WAREHOUSE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  lastActive: string;
  password?: string;
}

export interface Client {
  id: string;
  name: string;
  rif: string;
  email: string;
  phone: string;
  address: string;
  creditLimit: number;
  notes?: string;
  priceTier: 'A' | 'B' | 'C'; // Determines which price list to use
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  module: string;
  details: string;
  user: string;
  role: string;
}

export interface GeminiWorkflowResponse {
  name: string;
  description: string;
  steps: {
    name: string;
    type: string;
    description: string;
  }[];
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  subMessage?: string;
}

export interface NotificationHistoryItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  timestamp: string;
  read: boolean;
}

export interface Task {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
  dueDate: string;
}

export interface SystemSettings {
  companyName: string;
  rif: string;
  address: string;
  currency: string;
  timezone: string;
  emailNotifications: boolean;
  twoFactorAuth: boolean;
}

export interface LogActionFunc {
    (module: string, action: string, details: string, userOverride?: User): void;
}