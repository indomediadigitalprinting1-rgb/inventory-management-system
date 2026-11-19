import type {
  AdjustmentType,
  AdminSlot,
  DeliveryLineItem,
  DeliveryRecord,
  IncomingLineItem,
  IncomingTransaction,
  InventoryItem,
  NavRoute,
  RequestLineItem,
  StockAdjustment,
  StockLedgerEntry,
  StockRequest,
  UserAccount,
  UserInvite,
  UserRole,
} from './types';

export interface MenuDefinition {
  route: NavRoute;
  label: string;
}

export const MENU_BY_ROLE: Record<UserRole, MenuDefinition[]> = {
  OWNER: [
    { route: 'dashboard', label: 'Dashboard' },
    { route: 'items', label: 'Master Barang' },
    { route: 'categories', label: 'Kategori' },
    { route: 'units', label: 'Satuan' },
    { route: 'suppliers', label: 'Supplier' },
    { route: 'incoming', label: 'Barang Masuk' },
    { route: 'requests', label: 'Permintaan Barang' },
    { route: 'deliveries', label: 'Penyerahan Barang' },
    { route: 'outgoing', label: 'Barang Keluar' },
    { route: 'scanner', label: 'Scan Barcode' },
    { route: 'stock-card', label: 'Kartu Stok' },
    { route: 'history', label: 'Riwayat Transaksi' },
    { route: 'reports', label: 'Laporan' },
    { route: 'users', label: 'Pengguna' },
    { route: 'audit-logs', label: 'Audit Log' },
    { route: 'settings', label: 'Pengaturan' },
  ],
  ADMIN: [
    { route: 'dashboard', label: 'Dashboard' },
    { route: 'items', label: 'Master Barang' },
    { route: 'categories', label: 'Kategori' },
    { route: 'suppliers', label: 'Supplier' },
    { route: 'incoming', label: 'Barang Masuk' },
    { route: 'requests', label: 'Permintaan Barang' },
    { route: 'deliveries', label: 'Penyerahan Barang' },
    { route: 'outgoing', label: 'Barang Keluar' },
    { route: 'scanner', label: 'Scan Barcode' },
    { route: 'stock-card', label: 'Kartu Stok' },
    { route: 'history', label: 'Riwayat Transaksi' },
    { route: 'reports', label: 'Laporan' },
  ],
  PRODUKSI: [
    { route: 'dashboard', label: 'Dashboard' },
    { route: 'items', label: 'Data Barang' },
    { route: 'scanner', label: 'Scan Barcode' },
    { route: 'requests', label: 'Permintaan Barang' },
    { route: 'history', label: 'Riwayat Permintaan' },
  ],
};

export function canAccessRoute(role: UserRole, route: NavRoute): boolean {
  return MENU_BY_ROLE[role].some((m) => m.route === route);
}

export function canEditMasterItems(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canManageUnits(role: UserRole): boolean {
  return role === 'OWNER';
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'OWNER';
}

export function canAdjustStock(role: UserRole): boolean {
  return role === 'OWNER';
}

export function canApproveOrDeliver(role: UserRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canViewAuditLogs(role: UserRole): boolean {
  return role === 'OWNER';
}

export function canDeleteItemPermanently(role: UserRole, item: Pick<InventoryItem, 'hasTransactions'>): boolean {
  if (role !== 'OWNER') return false;
  return !item.hasTransactions;
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.slice(0, 120) || 'id';
}

export function emailToInviteId(email: string): string {
  return sanitizeId(email.trim().toLowerCase());
}

export function normalizeCodeKey(value: string): string {
  return sanitizeId(value.trim().toUpperCase());
}

export function generateCode128Value(prefix = 'IMS'): string {
  const ts = Date.now().toString().slice(-7);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${ts}${rand}`;
}

export function generateDocNumber(prefix: string, sequenceSeed?: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const suffix = sequenceSeed ?? Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}-${ymd}-${suffix}`;
}

export function validateAdminSlotAvailability(params: {
  targetRole: UserRole;
  targetEmail: string;
  adminSlot: AdminSlot | null;
  existingUsers: UserAccount[];
  existingInvites: UserInvite[];
}): { allowed: boolean; reason?: string } {
  const normalizedTarget = params.targetEmail.trim().toLowerCase();
  if (params.targetRole !== 'ADMIN') {
    return { allowed: true };
  }

  if (
    params.adminSlot?.occupied &&
    params.adminSlot.adminEmail &&
    params.adminSlot.adminEmail.trim().toLowerCase() !== normalizedTarget
  ) {
    return {
      allowed: false,
      reason: `Maksimal 1 akun ADMIN diizinkan. Slot Admin saat ini sudah ditempati oleh ${params.adminSlot.adminEmail}.`,
    };
  }

  const otherActiveAdminUser = params.existingUsers.find(
    (u) => u.role === 'ADMIN' && u.active && u.email.trim().toLowerCase() !== normalizedTarget
  );
  if (otherActiveAdminUser) {
    return {
      allowed: false,
      reason: `Akun ADMIN aktif sudah ada (${otherActiveAdminUser.email}). Nonaktifkan atau ubah role Admin yang ada terlebih dahulu.`,
    };
  }

  const otherAdminInvite = params.existingInvites.find(
    (inv) => inv.role === 'ADMIN' && inv.active && inv.email.trim().toLowerCase() !== normalizedTarget
  );
  if (otherAdminInvite) {
    return {
      allowed: false,
      reason: `Undangan ADMIN aktif sudah ada untuk ${otherAdminInvite.email}. Maksimal hanya 1 akun Admin.`,
    };
  }

  return { allowed: true };
}

export function validateItemUniqueness(params: {
  code: string;
  barcode: string;
  editingItemId?: string;
  existingItems: InventoryItem[];
}): { valid: boolean; error?: string } {
  const normCode = params.code.trim().toUpperCase();
  const normBarcode = params.barcode.trim().toUpperCase();
  if (!normCode) return { valid: false, error: 'Kode barang wajib diisi.' };
  if (!normBarcode) return { valid: false, error: 'Barcode wajib diisi.' };

  const dupCode = params.existingItems.find(
    (item) => item.id !== params.editingItemId && item.code.trim().toUpperCase() === normCode
  );
  if (dupCode) {
    return { valid: false, error: `Kode barang "${params.code}" sudah digunakan oleh ${dupCode.name}.` };
  }

  const dupBarcode = params.existingItems.find(
    (item) => item.id !== params.editingItemId && item.barcode.trim().toUpperCase() === normBarcode
  );
  if (dupBarcode) {
    return { valid: false, error: `Barcode "${params.barcode}" sudah digunakan oleh ${dupBarcode.name}.` };
  }

  return { valid: true };
}

export function calculateIncomingTotal(items: IncomingLineItem[]): number {
  return items.reduce((sum, line) => sum + Number(line.qty) * Number(line.price), 0);
}

export function applyIncomingConfirmation(params: {
  tx: IncomingTransaction;
  itemsById: Map<string, InventoryItem>;
  actor: { uid: string; name: string };
  usedIdempotencyKeys: Set<string>;
  nowIso: string;
}): {
  updatedTx: IncomingTransaction;
  updatedItems: InventoryItem[];
  ledgerEntries: StockLedgerEntry[];
} {
  if (params.tx.status !== 'DRAFT') {
    throw new Error('Hanya transaksi berstatus DRAFT yang dapat dikonfirmasi.');
  }
  const confirmKey = `confirm_${params.tx.id}`;
  if (params.usedIdempotencyKeys.has(confirmKey)) {
    throw new Error('Konfirmasi ganda terdeteksi (idempotency key sudah digunakan).');
  }
  if (params.tx.items.length === 0) {
    throw new Error('Daftar barang tidak boleh kosong.');
  }

  const updatedItems: InventoryItem[] = [];
  const ledgerEntries: StockLedgerEntry[] = [];

  for (const line of params.tx.items) {
    if (line.qty <= 0) {
      throw new Error(`Jumlah barang ${line.itemName} harus lebih besar dari 0.`);
    }
    const current = params.itemsById.get(line.itemId);
    if (!current) {
      throw new Error(`Barang ${line.itemName} tidak ditemukan di master data.`);
    }
    const newBalance = current.currentStock + line.qty;
    const updatedItem: InventoryItem = {
      ...current,
      currentStock: newBalance,
      hasTransactions: true,
      updatedAt: params.nowIso,
    };
    params.itemsById.set(current.id, updatedItem);
    updatedItems.push(updatedItem);

    ledgerEntries.push({
      id: sanitizeId(`led_${params.tx.id}_${line.itemId}_${ledgerEntries.length}`),
      date: params.tx.date,
      txNumber: params.tx.txNumber,
      txType: 'MASUK',
      referenceId: params.tx.id,
      itemId: current.id,
      itemCode: current.code,
      itemName: current.name,
      categoryName: current.categoryName,
      unitName: current.unitName,
      qtyIn: line.qty,
      qtyOut: 0,
      balanceAfter: newBalance,
      notes: params.tx.notes || `Barang masuk dari ${params.tx.supplierName}`,
      userId: params.actor.uid,
      userName: params.actor.name,
      createdAt: params.nowIso,
    });
  }

  const updatedTx: IncomingTransaction = {
    ...params.tx,
    status: 'CONFIRMED',
    confirmedByUid: params.actor.uid,
    confirmedByName: params.actor.name,
    confirmedAt: params.nowIso,
    updatedAt: params.nowIso,
  };

  return { updatedTx, updatedItems, ledgerEntries };
}

export function createIncomingReversal(params: {
  originalTx: IncomingTransaction;
  itemsById: Map<string, InventoryItem>;
  actor: { uid: string; name: string };
  reason: string;
  reversalId: string;
  reversalTxNumber: string;
  idempotencyKey: string;
  usedIdempotencyKeys: Set<string>;
  nowIso: string;
}): {
  markedOriginalTx: IncomingTransaction;
  reversalTx: IncomingTransaction;
  updatedItems: InventoryItem[];
  ledgerEntries: StockLedgerEntry[];
} {
  if (params.originalTx.status !== 'CONFIRMED') {
    throw new Error('Hanya transaksi CONFIRMED yang dapat dibalik.');
  }
  if (params.usedIdempotencyKeys.has(params.idempotencyKey)) {
    throw new Error('Transaksi pembalik ganda terdeteksi.');
  }
  if (!params.reason.trim()) {
    throw new Error('Alasan pembalikan transaksi wajib diisi.');
  }

  const updatedItems: InventoryItem[] = [];
  const ledgerEntries: StockLedgerEntry[] = [];

  for (const line of params.originalTx.items) {
    const current = params.itemsById.get(line.itemId);
    if (!current) {
      throw new Error(`Barang ${line.itemName} tidak ditemukan.`);
    }
    const nextStock = current.currentStock - line.qty;
    if (nextStock < 0) {
      throw new Error(
        `Tidak dapat membalik transaksi: stok ${current.name} saat ini (${current.currentStock}) lebih kecil dari jumlah masuk (${line.qty}).`
      );
    }
    const updatedItem: InventoryItem = {
      ...current,
      currentStock: nextStock,
      hasTransactions: true,
      updatedAt: params.nowIso,
    };
    params.itemsById.set(current.id, updatedItem);
    updatedItems.push(updatedItem);

    ledgerEntries.push({
      id: sanitizeId(`led_${params.reversalId}_${line.itemId}_${ledgerEntries.length}`),
      date: params.nowIso.slice(0, 10),
      txNumber: params.reversalTxNumber,
      txType: 'PEMBALIK',
      referenceId: params.reversalId,
      itemId: current.id,
      itemCode: current.code,
      itemName: current.name,
      categoryName: current.categoryName,
      unitName: current.unitName,
      qtyIn: 0,
      qtyOut: line.qty,
      balanceAfter: nextStock,
      notes: `Pembalik ${params.originalTx.txNumber}: ${params.reason.trim()}`,
      userId: params.actor.uid,
      userName: params.actor.name,
      createdAt: params.nowIso,
    });
  }

  const markedOriginalTx: IncomingTransaction = {
    ...params.originalTx,
    status: 'REVERSED',
    updatedAt: params.nowIso,
  };

  const reversalTx: IncomingTransaction = {
    id: params.reversalId,
    txNumber: params.reversalTxNumber,
    date: params.nowIso.slice(0, 10),
    supplierId: params.originalTx.supplierId,
    supplierName: params.originalTx.supplierName,
    items: params.originalTx.items,
    totalAmount: params.originalTx.totalAmount,
    notes: `Transaksi pembalik untuk ${params.originalTx.txNumber}: ${params.reason.trim()}`,
    status: 'REVERSED',
    reversalOfId: params.originalTx.id,
    idempotencyKey: params.idempotencyKey,
    createdByUid: params.actor.uid,
    createdByName: params.actor.name,
    confirmedByUid: params.actor.uid,
    confirmedByName: params.actor.name,
    confirmedAt: params.nowIso,
    createdAt: params.nowIso,
    updatedAt: params.nowIso,
  };

  return { markedOriginalTx, reversalTx, updatedItems, ledgerEntries };
}

export function reviewStockRequest(params: {
  request: StockRequest;
  decision: 'APPROVE' | 'REJECT';
  approvedQuantities?: Record<string, number>;
  markReadyImmediately?: boolean;
  rejectionReason?: string;
  actor: { uid: string; name: string; role: UserRole };
  nowIso: string;
}): StockRequest {
  if (!canApproveOrDeliver(params.actor.role)) {
    throw new Error('Hanya ADMIN atau OWNER yang dapat memproses persetujuan.');
  }
  if (params.request.status !== 'MENUNGGU_PERSETUJUAN') {
    throw new Error(`Permintaan berstatus ${params.request.status} tidak dapat diproses lagi.`);
  }

  if (params.decision === 'REJECT') {
    const reason = (params.rejectionReason ?? '').trim();
    if (reason.length < 3) {
      throw new Error('Alasan penolakan wajib diisi minimal 3 karakter.');
    }
    return {
      ...params.request,
      status: 'DITOLAK',
      approvedByUid: params.actor.uid,
      approvedByName: params.actor.name,
      approvedAt: params.nowIso,
      rejectionReason: reason,
      items: params.request.items.map((line) => ({ ...line, approvedQty: 0 })),
      updatedAt: params.nowIso,
    };
  }

  const nextItems: RequestLineItem[] = params.request.items.map((line) => {
    const approved = params.approvedQuantities?.[line.itemId] ?? line.requestedQty;
    if (approved < 0 || approved > line.requestedQty) {
      throw new Error(
        `Jumlah disetujui untuk ${line.itemName} (${approved}) harus antara 0 dan jumlah diminta (${line.requestedQty}).`
      );
    }
    return {
      ...line,
      approvedQty: approved,
    };
  });

  const totalApproved = nextItems.reduce((sum, i) => sum + i.approvedQty, 0);
  if (totalApproved <= 0) {
    throw new Error('Minimal 1 barang harus memiliki jumlah disetujui > 0.');
  }

  return {
    ...params.request,
    status: params.markReadyImmediately !== false ? 'SIAP_DIAMBIL' : 'DISETUJUI',
    items: nextItems,
    approvedByUid: params.actor.uid,
    approvedByName: params.actor.name,
    approvedAt: params.nowIso,
    rejectionReason: null,
    updatedAt: params.nowIso,
  };
}

export function processStockDelivery(params: {
  request: StockRequest;
  deliverQuantities: Record<string, number>;
  itemsById: Map<string, InventoryItem>;
  actor: { uid: string; name: string; role: UserRole };
  notes: string;
  deliveryId: string;
  deliveryNumber: string;
  stockOutNumber: string;
  idempotencyKey: string;
  usedIdempotencyKeys: Set<string>;
  nowIso: string;
}): {
  updatedRequest: StockRequest;
  deliveryRecord: DeliveryRecord;
  updatedItems: InventoryItem[];
  ledgerEntries: StockLedgerEntry[];
} {
  if (!canApproveOrDeliver(params.actor.role)) {
    throw new Error('Hanya ADMIN atau OWNER yang dapat mengonfirmasi penyerahan barang.');
  }
  if (params.usedIdempotencyKeys.has(params.idempotencyKey)) {
    throw new Error('Transaksi penyerahan ganda terdeteksi.');
  }
  if (!['DISETUJUI', 'SIAP_DIAMBIL', 'DALAM_PROSES_PENGAMBILAN'].includes(params.request.status)) {
    throw new Error(`Permintaan berstatus ${params.request.status} tidak dapat diserahkan.`);
  }

  const deliveryLines: DeliveryLineItem[] = [];
  const updatedItems: InventoryItem[] = [];
  const ledgerEntries: StockLedgerEntry[] = [];

  const nextRequestItems: RequestLineItem[] = params.request.items.map((line) => {
    const qtyToDeliver = Number(params.deliverQuantities[line.itemId] ?? 0);
    if (qtyToDeliver < 0) {
      throw new Error(`Jumlah penyerahan untuk ${line.itemName} tidak boleh negatif.`);
    }
    if (qtyToDeliver === 0) {
      return line;
    }

    const remainingApproved = line.approvedQty - line.deliveredQty;
    if (qtyToDeliver > remainingApproved) {
      throw new Error(
        `Penyerahan ${line.itemName} (${qtyToDeliver}) melebihi sisa yang disetujui (${remainingApproved}).`
      );
    }

    const masterItem = params.itemsById.get(line.itemId);
    if (!masterItem) {
      throw new Error(`Barang ${line.itemName} tidak ditemukan.`);
    }
    if (masterItem.currentStock < qtyToDeliver) {
      throw new Error(
        `Stok ${masterItem.name} tidak mencukupi. Stok saat ini: ${masterItem.currentStock}, diminta serah: ${qtyToDeliver}.`
      );
    }

    const nextStock = masterItem.currentStock - qtyToDeliver;
    if (nextStock < 0) {
      throw new Error(`Stok negatif dicegah untuk ${masterItem.name}.`);
    }

    const updatedMaster: InventoryItem = {
      ...masterItem,
      currentStock: nextStock,
      hasTransactions: true,
      updatedAt: params.nowIso,
    };
    params.itemsById.set(masterItem.id, updatedMaster);
    updatedItems.push(updatedMaster);

    deliveryLines.push({
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      unitName: line.unitName,
      deliveredQty: qtyToDeliver,
    });

    ledgerEntries.push({
      id: sanitizeId(`led_${params.deliveryId}_${line.itemId}_${ledgerEntries.length}`),
      date: params.nowIso.slice(0, 10),
      txNumber: params.stockOutNumber,
      txType: 'KELUAR',
      referenceId: params.deliveryId,
      itemId: masterItem.id,
      itemCode: masterItem.code,
      itemName: masterItem.name,
      categoryName: masterItem.categoryName,
      unitName: masterItem.unitName,
      qtyIn: 0,
      qtyOut: qtyToDeliver,
      balanceAfter: nextStock,
      notes:
        params.notes.trim() ||
        `Penyerahan ${params.deliveryNumber} untuk ${params.request.requestNumber} (${params.request.requesterName})`,
      userId: params.actor.uid,
      userName: params.actor.name,
      createdAt: params.nowIso,
    });

    return {
      ...line,
      deliveredQty: line.deliveredQty + qtyToDeliver,
    };
  });

  if (deliveryLines.length === 0) {
    throw new Error('Masukkan minimal 1 barang dengan jumlah penyerahan > 0.');
  }

  const allCompleted = nextRequestItems.every((line) => line.deliveredQty >= line.approvedQty);

  const updatedRequest: StockRequest = {
    ...params.request,
    items: nextRequestItems,
    status: allCompleted ? 'SELESAI' : 'DALAM_PROSES_PENGAMBILAN',
    updatedAt: params.nowIso,
  };

  const deliveryRecord: DeliveryRecord = {
    id: params.deliveryId,
    deliveryNumber: params.deliveryNumber,
    stockOutNumber: params.stockOutNumber,
    requestId: params.request.id,
    requestNumber: params.request.requestNumber,
    requesterUid: params.request.requesterUid,
    requesterName: params.request.requesterName,
    items: deliveryLines,
    notes: params.notes.trim(),
    deliveredByUid: params.actor.uid,
    deliveredByName: params.actor.name,
    idempotencyKey: params.idempotencyKey,
    createdAt: params.nowIso,
  };

  return { updatedRequest, deliveryRecord, updatedItems, ledgerEntries };
}

export function applyStockAdjustment(params: {
  item: InventoryItem;
  type: AdjustmentType;
  value: number;
  reason: string;
  actor: { uid: string; name: string; role: UserRole };
  adjustmentId: string;
  txNumber: string;
  idempotencyKey: string;
  usedIdempotencyKeys: Set<string>;
  nowIso: string;
}): {
  updatedItem: InventoryItem;
  adjustment: StockAdjustment;
  ledgerEntry: StockLedgerEntry;
} {
  if (!canAdjustStock(params.actor.role)) {
    throw new Error('Hanya OWNER yang diizinkan melakukan penyesuaian stok.');
  }
  if (params.usedIdempotencyKeys.has(params.idempotencyKey)) {
    throw new Error('Penyesuaian ganda terdeteksi.');
  }
  if (params.reason.trim().length < 3) {
    throw new Error('Alasan penyesuaian wajib diisi minimal 3 karakter.');
  }
  if (params.value < 0) {
    throw new Error('Nilai penyesuaian tidak boleh negatif.');
  }

  const previousStock = params.item.currentStock;
  let newStock = previousStock;
  let qtyChange = 0;

  if (params.type === 'INCREASE') {
    qtyChange = params.value;
    newStock = previousStock + params.value;
  } else if (params.type === 'DECREASE') {
    qtyChange = -params.value;
    newStock = previousStock - params.value;
  } else {
    // OPNAME sets physical stock count
    newStock = params.value;
    qtyChange = newStock - previousStock;
  }

  if (newStock < 0) {
    throw new Error(`Penyesuaian akan menghasilkan stok negatif (${newStock}). Ditolak.`);
  }
  if (qtyChange === 0) {
    throw new Error('Selisih penyesuaian adalah 0, tidak ada perubahan stok.');
  }

  const updatedItem: InventoryItem = {
    ...params.item,
    currentStock: newStock,
    hasTransactions: true,
    updatedAt: params.nowIso,
  };

  const adjustment: StockAdjustment = {
    id: params.adjustmentId,
    txNumber: params.txNumber,
    itemId: params.item.id,
    itemCode: params.item.code,
    itemName: params.item.name,
    type: params.type,
    previousStock,
    qtyChange,
    newStock,
    reason: params.reason.trim(),
    idempotencyKey: params.idempotencyKey,
    createdByUid: params.actor.uid,
    createdByName: params.actor.name,
    createdAt: params.nowIso,
  };

  const ledgerEntry: StockLedgerEntry = {
    id: sanitizeId(`led_${params.adjustmentId}_${params.item.id}`),
    date: params.nowIso.slice(0, 10),
    txNumber: params.txNumber,
    txType: 'PENYESUAIAN',
    referenceId: params.adjustmentId,
    itemId: params.item.id,
    itemCode: params.item.code,
    itemName: params.item.name,
    categoryName: params.item.categoryName,
    unitName: params.item.unitName,
    qtyIn: qtyChange > 0 ? qtyChange : 0,
    qtyOut: qtyChange < 0 ? Math.abs(qtyChange) : 0,
    balanceAfter: newStock,
    notes: `Penyesuaian (${params.type}): ${params.reason.trim()}`,
    userId: params.actor.uid,
    userName: params.actor.name,
    createdAt: params.nowIso,
  };

  return { updatedItem, adjustment, ledgerEntry };
}

export interface DashboardMetrics {
  totalItems: number;
  totalStockUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalIncomingQty: number;
  totalOutgoingQty: number;
  todayIncomingCount: number;
  todayOutgoingCount: number;
  pendingRequestsCount: number;
  readyOrInProgressRequestsCount: number;
  myTotalRequests: number;
  myPendingRequests: number;
  myApprovedRequests: number;
  myRejectedRequests: number;
  myInProgressRequests: number;
  myTotalPickedUpUnits: number;
}

export function computeDashboardMetrics(params: {
  items: InventoryItem[];
  ledger: StockLedgerEntry[];
  requests: StockRequest[];
  deliveries: DeliveryRecord[];
  currentUid: string;
  todayDate: string;
}): DashboardMetrics {
  const activeItems = params.items.filter((i) => i.active);
  const totalItems = activeItems.length;
  const totalStockUnits = activeItems.reduce((sum, i) => sum + i.currentStock, 0);
  const outOfStockCount = activeItems.filter((i) => i.currentStock <= 0).length;
  const lowStockCount = activeItems.filter((i) => i.currentStock > 0 && i.currentStock <= i.minStock).length;

  const totalIncomingQty = params.ledger
    .filter((l) => l.txType === 'MASUK')
    .reduce((sum, l) => sum + l.qtyIn, 0);
  const totalOutgoingQty = params.ledger
    .filter((l) => l.txType === 'KELUAR')
    .reduce((sum, l) => sum + l.qtyOut, 0);

  const todayIncomingCount = params.ledger.filter(
    (l) => l.txType === 'MASUK' && l.date === params.todayDate
  ).length;
  const todayOutgoingCount = params.ledger.filter(
    (l) => l.txType === 'KELUAR' && l.date === params.todayDate
  ).length;

  const pendingRequestsCount = params.requests.filter((r) => r.status === 'MENUNGGU_PERSETUJUAN').length;
  const readyOrInProgressRequestsCount = params.requests.filter((r) =>
    ['DISETUJUI', 'SIAP_DIAMBIL', 'DALAM_PROSES_PENGAMBILAN'].includes(r.status)
  ).length;

  const myRequests = params.requests.filter((r) => r.requesterUid === params.currentUid);
  const myTotalPickedUpUnits = params.deliveries
    .filter((d) => d.requesterUid === params.currentUid)
    .reduce((sum, d) => sum + d.items.reduce((s, l) => s + l.deliveredQty, 0), 0);

  return {
    totalItems,
    totalStockUnits,
    lowStockCount,
    outOfStockCount,
    totalIncomingQty,
    totalOutgoingQty,
    todayIncomingCount,
    todayOutgoingCount,
    pendingRequestsCount,
    readyOrInProgressRequestsCount,
    myTotalRequests: myRequests.length,
    myPendingRequests: myRequests.filter((r) => r.status === 'MENUNGGU_PERSETUJUAN').length,
    myApprovedRequests: myRequests.filter((r) =>
      ['DISETUJUI', 'SIAP_DIAMBIL', 'SELESAI'].includes(r.status)
    ).length,
    myRejectedRequests: myRequests.filter((r) => r.status === 'DITOLAK').length,
    myInProgressRequests: myRequests.filter((r) =>
      ['DISETUJUI', 'SIAP_DIAMBIL', 'DALAM_PROSES_PENGAMBILAN'].includes(r.status)
    ).length,
    myTotalPickedUpUnits,
  };
}

export interface FlowChartPoint {
  date: string;
  masuk: number;
  keluar: number;
}

export function computeStockFlowSeries(ledger: StockLedgerEntry[], days = 14): FlowChartPoint[] {
  const byDate = new Map<string, { masuk: number; keluar: number }>();
  for (const entry of ledger) {
    const existing = byDate.get(entry.date) ?? { masuk: 0, keluar: 0 };
    if (entry.txType === 'MASUK') existing.masuk += entry.qtyIn;
    if (entry.txType === 'KELUAR') existing.keluar += entry.qtyOut;
    byDate.set(entry.date, existing);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, vals]) => ({ date, masuk: vals.masuk, keluar: vals.keluar }));
}
