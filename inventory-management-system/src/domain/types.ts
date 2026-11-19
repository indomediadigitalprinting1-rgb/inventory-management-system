export type UserRole = 'OWNER' | 'ADMIN' | 'PRODUKSI';

export type RequestStatus =
  | 'MENUNGGU_PERSETUJUAN'
  | 'DISETUJUI'
  | 'DITOLAK'
  | 'SIAP_DIAMBIL'
  | 'DALAM_PROSES_PENGAMBILAN'
  | 'SELESAI'
  | 'DIBATALKAN';

export type IncomingStatus = 'DRAFT' | 'CONFIRMED' | 'REVERSED';

export type LedgerTxType = 'MASUK' | 'KELUAR' | 'PENYESUAIAN' | 'PEMBALIK';

export type AdjustmentType = 'INCREASE' | 'DECREASE' | 'OPNAME';

export type NavRoute =
  | 'dashboard'
  | 'items'
  | 'categories'
  | 'units'
  | 'suppliers'
  | 'incoming'
  | 'requests'
  | 'deliveries'
  | 'outgoing'
  | 'scanner'
  | 'stock-card'
  | 'history'
  | 'reports'
  | 'users'
  | 'audit-logs'
  | 'settings';

export interface SystemConfig {
  initialized: boolean;
  ownerUid: string;
  ownerEmail: string;
  companyName: string;
  lowStockAlertEnabled: boolean;
  updatedAt: string;
}

export interface AdminSlot {
  occupied: boolean;
  adminUid: string | null;
  adminEmail: string | null;
  updatedAt: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  active: boolean;
  inviteId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserInvite {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'PRODUKSI';
  department: string;
  active: boolean;
  claimedUid?: string | null;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  barcode: string;
  name: string;
  categoryId: string;
  categoryName: string;
  specification: string;
  unitId: string;
  unitName: string;
  initialStock: number;
  currentStock: number;
  minStock: number;
  purchasePrice: number;
  supplierId: string;
  supplierName: string;
  active: boolean;
  hasTransactions: boolean;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomingLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitName: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface IncomingTransaction {
  id: string;
  txNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  items: IncomingLineItem[];
  totalAmount: number;
  notes: string;
  status: IncomingStatus;
  reversalOfId?: string | null;
  idempotencyKey: string;
  createdByUid: string;
  createdByName: string;
  confirmedByUid?: string | null;
  confirmedByName?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitName: string;
  requestedQty: number;
  approvedQty: number;
  deliveredQty: number;
}

export interface StockRequest {
  id: string;
  requestNumber: string;
  requesterUid: string;
  requesterName: string;
  department: string;
  notes: string;
  status: RequestStatus;
  items: RequestLineItem[];
  approvedByUid?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitName: string;
  deliveredQty: number;
}

export interface DeliveryRecord {
  id: string;
  deliveryNumber: string;
  stockOutNumber: string;
  requestId: string;
  requestNumber: string;
  requesterUid: string;
  requesterName: string;
  items: DeliveryLineItem[];
  notes: string;
  deliveredByUid: string;
  deliveredByName: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  txNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  type: AdjustmentType;
  previousStock: number;
  qtyChange: number;
  newStock: number;
  reason: string;
  idempotencyKey: string;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
}

export interface StockLedgerEntry {
  id: string;
  date: string;
  txNumber: string;
  txType: LedgerTxType;
  referenceId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  unitName: string;
  qtyIn: number;
  qtyOut: number;
  balanceAfter: number;
  notes: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  targetRole: UserRole;
  targetUid?: string | null;
  type: string;
  title: string;
  message: string;
  linkView?: NavRoute | null;
  relatedId?: string | null;
  readBy: string[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  createdAt: string;
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  MENUNGGU_PERSETUJUAN: 'Menunggu Persetujuan',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
  SIAP_DIAMBIL: 'Siap Diambil',
  DALAM_PROSES_PENGAMBILAN: 'Dalam Proses Pengambilan',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
};

export type ReportType =
  | 'STOK'
  | 'STOK_MINIMUM'
  | 'STOK_HABIS'
  | 'BARANG_MASUK'
  | 'BARANG_KELUAR'
  | 'PENGGUNAAN_PRODUKSI'
  | 'TRANSAKSI_PENGGUNA'
  | 'PERIODE'
  | 'KARTU_STOK'
  | 'PERMINTAAN_BARANG';
