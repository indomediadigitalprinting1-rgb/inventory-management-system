import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyIncomingConfirmation,
  applyStockAdjustment,
  canAccessRoute,
  canAdjustStock,
  canDeleteCategory,
  canDeleteItemPermanently,
  canDeleteNotification,
  canDeleteSupplier,
  canDeleteUnit,
  createIncomingReversal,
  filterVisibleNotifications,
  generateNextSequentialCode,
  getNonOwnerUsers,
  getRemainingReadMinutes,
  isNotificationExpired,
  partitionDeletableCategories,
  partitionDeletableItems,
  partitionDeletableSuppliers,
  partitionDeletableUnits,
  processStockDelivery,
  READ_NOTIFICATION_TTL_MS,
  reviewStockRequest,
  sortItemsByCode,
  validateAdminSlotAvailability,
  validateItemUniqueness,
} from './rules';
import type {
  IncomingTransaction,
  InventoryItem,
  NotificationItem,
  StockRequest,
  UserAccount,
  UserInvite,
} from './types';

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item_1',
    code: 'BRG-001',
    barcode: 'IMS-100001',
    name: 'Plat Baja 2mm',
    categoryId: 'cat_1',
    categoryName: 'Logam',
    specification: '2mm x 1200mm',
    unitId: 'unit_1',
    unitName: 'Lembar',
    initialStock: 10,
    currentStock: 30,
    minStock: 5,
    purchasePrice: 120000,
    supplierId: 'sup_1',
    supplierName: 'PT Baja Nusantara',
    active: true,
    hasTransactions: false,
    createdByUid: 'owner_1',
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    ...overrides,
  };
}

test('RBAC menu and permission boundaries per role', () => {
  assert.equal(canAccessRoute('OWNER', 'users'), true);
  assert.equal(canAccessRoute('OWNER', 'audit-logs'), true);
  assert.equal(canAccessRoute('OWNER', 'units'), true);
  assert.equal(canAccessRoute('ADMIN', 'users'), false);
  assert.equal(canAccessRoute('ADMIN', 'audit-logs'), false);
  assert.equal(canAccessRoute('ADMIN', 'units'), false);
  assert.equal(canAccessRoute('ADMIN', 'deliveries'), true);
  assert.equal(canAccessRoute('PRODUKSI', 'scanner'), true);
  assert.equal(canAccessRoute('PRODUKSI', 'requests'), true);
  assert.equal(canAccessRoute('PRODUKSI', 'incoming'), false);
  assert.equal(canAccessRoute('PRODUKSI', 'deliveries'), false);
  assert.equal(canAdjustStock('OWNER'), true);
  assert.equal(canAdjustStock('ADMIN'), false);
  assert.equal(canAdjustStock('PRODUKSI'), false);
});

test('Max 1 Admin enforcement prevents second admin account or invite', () => {
  const users: UserAccount[] = [
    {
      uid: 'owner_1',
      email: 'owner@ims.id',
      name: 'Owner',
      role: 'OWNER',
      department: 'Manajemen',
      active: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      uid: 'admin_1',
      email: 'admin1@ims.id',
      name: 'Admin Gudang',
      role: 'ADMIN',
      department: 'Gudang',
      active: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  ];
  const invites: UserInvite[] = [];

  const secondAdmin = validateAdminSlotAvailability({
    targetRole: 'ADMIN',
    targetEmail: 'admin2@ims.id',
    adminSlot: {
      occupied: true,
      adminUid: 'admin_1',
      adminEmail: 'admin1@ims.id',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    existingUsers: users,
    existingInvites: invites,
  });
  assert.equal(secondAdmin.allowed, false);

  const multipleProduksi = validateAdminSlotAvailability({
    targetRole: 'PRODUKSI',
    targetEmail: 'produksi99@ims.id',
    adminSlot: {
      occupied: true,
      adminUid: 'admin_1',
      adminEmail: 'admin1@ims.id',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    existingUsers: users,
    existingInvites: invites,
  });
  assert.equal(multipleProduksi.allowed, true);
});

test('Item code & barcode uniqueness and delete protection with history', () => {
  const existing = [makeItem({ id: 'item_1', code: 'BRG-001', barcode: 'IMS-100001', hasTransactions: true })];

  assert.equal(
    validateItemUniqueness({ code: 'brg-001', barcode: 'IMS-999', existingItems: existing }).valid,
    false
  );
  assert.equal(
    validateItemUniqueness({ code: 'BRG-002', barcode: 'ims-100001', existingItems: existing }).valid,
    false
  );
  assert.equal(
    validateItemUniqueness({ code: 'BRG-002', barcode: 'IMS-100002', existingItems: existing }).valid,
    true
  );

  assert.equal(canDeleteItemPermanently('OWNER', existing[0]), false);
  assert.equal(canDeleteItemPermanently('OWNER', makeItem({ hasTransactions: false })), true);
  assert.equal(canDeleteItemPermanently('ADMIN', makeItem({ hasTransactions: false })), false);
});

test('Incoming confirmation adds stock, locks edits, and reversal restores stock', () => {
  const item = makeItem({ currentStock: 30, hasTransactions: false });
  const map = new Map([[item.id, item]]);
  const draftTx: IncomingTransaction = {
    id: 'in_1',
    txNumber: 'BM-20261118-0001',
    date: '2026-11-18',
    supplierId: 'sup_1',
    supplierName: 'PT Baja Nusantara',
    items: [{ itemId: 'item_1', itemCode: 'BRG-001', itemName: 'Plat Baja 2mm', unitName: 'Lembar', qty: 15, price: 120000, subtotal: 1800000 }],
    totalAmount: 1800000,
    notes: 'PO #88',
    status: 'DRAFT',
    idempotencyKey: 'idem_in_1',
    createdByUid: 'admin_1',
    createdByName: 'Admin Gudang',
    createdAt: '2026-11-18T08:00:00Z',
    updatedAt: '2026-11-18T08:00:00Z',
  };

  const usedKeys = new Set<string>();
  const confirmed = applyIncomingConfirmation({
    tx: draftTx,
    itemsById: map,
    actor: { uid: 'admin_1', name: 'Admin Gudang' },
    usedIdempotencyKeys: usedKeys,
    nowIso: '2026-11-18T09:00:00Z',
  });
  usedKeys.add(`confirm_${draftTx.id}`);

  assert.equal(confirmed.updatedTx.status, 'CONFIRMED');
  assert.equal(confirmed.updatedItems[0].currentStock, 45);
  assert.equal(confirmed.updatedItems[0].hasTransactions, true);
  assert.equal(confirmed.ledgerEntries[0].qtyIn, 15);
  assert.equal(confirmed.ledgerEntries[0].balanceAfter, 45);

  assert.throws(() =>
    applyIncomingConfirmation({
      tx: confirmed.updatedTx,
      itemsById: map,
      actor: { uid: 'admin_1', name: 'Admin Gudang' },
      usedIdempotencyKeys: usedKeys,
      nowIso: '2026-11-18T09:05:00Z',
    })
  );

  const reversed = createIncomingReversal({
    originalTx: confirmed.updatedTx,
    itemsById: map,
    actor: { uid: 'owner_1', name: 'Owner' },
    reason: 'Salah input surat jalan',
    reversalId: 'in_rev_1',
    reversalTxNumber: 'REV-BM-20261118-0001',
    idempotencyKey: 'idem_rev_1',
    usedIdempotencyKeys: usedKeys,
    nowIso: '2026-11-18T10:00:00Z',
  });

  assert.equal(reversed.markedOriginalTx.status, 'REVERSED');
  assert.equal(reversed.updatedItems[0].currentStock, 30);
  assert.equal(reversed.ledgerEntries[0].txType, 'PEMBALIK');
  assert.equal(reversed.ledgerEntries[0].qtyOut, 15);
});

test('Request -> Approval -> Partial Deliveries (20 -> 12 -> 8 -> SELESAI) and negative stock prevention', () => {
  const item = makeItem({ currentStock: 25 });
  const map = new Map([[item.id, item]]);
  const req: StockRequest = {
    id: 'req_1',
    requestNumber: 'REQ-20261118-0001',
    requesterUid: 'prod_1',
    requesterName: 'Budi Produksi',
    department: 'Produksi A',
    notes: 'Kebutuhan Line 1',
    status: 'MENUNGGU_PERSETUJUAN',
    items: [
      {
        itemId: 'item_1',
        itemCode: 'BRG-001',
        itemName: 'Plat Baja 2mm',
        unitName: 'Lembar',
        requestedQty: 20,
        approvedQty: 0,
        deliveredQty: 0,
      },
    ],
    createdAt: '2026-11-18T08:00:00Z',
    updatedAt: '2026-11-18T08:00:00Z',
  };

  // Produksi cannot approve
  assert.throws(() =>
    reviewStockRequest({
      request: req,
      decision: 'APPROVE',
      actor: { uid: 'prod_1', name: 'Budi', role: 'PRODUKSI' },
      nowIso: '2026-11-18T08:10:00Z',
    })
  );

  // Admin approves 20 units - stock MUST remain 25
  const approved = reviewStockRequest({
    request: req,
    decision: 'APPROVE',
    approvedQuantities: { item_1: 20 },
    actor: { uid: 'admin_1', name: 'Admin', role: 'ADMIN' },
    nowIso: '2026-11-18T08:15:00Z',
  });
  assert.equal(approved.status, 'SIAP_DIAMBIL');
  assert.equal(map.get('item_1')?.currentStock, 25);

  const usedKeys = new Set<string>();

  // Delivery 1: 12 units -> remaining 8, status DALAM_PROSES_PENGAMBILAN
  const del1 = processStockDelivery({
    request: approved,
    deliverQuantities: { item_1: 12 },
    itemsById: map,
    actor: { uid: 'admin_1', name: 'Admin', role: 'ADMIN' },
    notes: 'Penyerahan tahap 1',
    deliveryId: 'del_1',
    deliveryNumber: 'SJ-001',
    stockOutNumber: 'BK-001',
    idempotencyKey: 'idem_del_1',
    usedIdempotencyKeys: usedKeys,
    nowIso: '2026-11-18T09:00:00Z',
  });
  usedKeys.add('idem_del_1');

  assert.equal(del1.updatedRequest.status, 'DALAM_PROSES_PENGAMBILAN');
  assert.equal(del1.updatedRequest.items[0].deliveredQty, 12);
  assert.equal(map.get('item_1')?.currentStock, 13);
  assert.equal(del1.deliveryRecord.stockOutNumber, 'BK-001');

  // Duplicate idempotency key blocked
  assert.throws(() =>
    processStockDelivery({
      request: del1.updatedRequest,
      deliverQuantities: { item_1: 8 },
      itemsById: map,
      actor: { uid: 'admin_1', name: 'Admin', role: 'ADMIN' },
      notes: 'Duplikat',
      deliveryId: 'del_dup',
      deliveryNumber: 'SJ-DUP',
      stockOutNumber: 'BK-DUP',
      idempotencyKey: 'idem_del_1',
      usedIdempotencyKeys: usedKeys,
      nowIso: '2026-11-18T09:01:00Z',
    })
  );

  // Over-delivery (> remaining 8) blocked
  assert.throws(() =>
    processStockDelivery({
      request: del1.updatedRequest,
      deliverQuantities: { item_1: 9 },
      itemsById: map,
      actor: { uid: 'admin_1', name: 'Admin', role: 'ADMIN' },
      notes: 'Kelebihan',
      deliveryId: 'del_over',
      deliveryNumber: 'SJ-OVER',
      stockOutNumber: 'BK-OVER',
      idempotencyKey: 'idem_del_over',
      usedIdempotencyKeys: usedKeys,
      nowIso: '2026-11-18T09:02:00Z',
    })
  );

  // Delivery 2: remaining 8 units -> status SELESAI, stock becomes 5
  const del2 = processStockDelivery({
    request: del1.updatedRequest,
    deliverQuantities: { item_1: 8 },
    itemsById: map,
    actor: { uid: 'admin_1', name: 'Admin', role: 'ADMIN' },
    notes: 'Penyerahan tahap 2 pelunasan',
    deliveryId: 'del_2',
    deliveryNumber: 'SJ-002',
    stockOutNumber: 'BK-002',
    idempotencyKey: 'idem_del_2',
    usedIdempotencyKeys: usedKeys,
    nowIso: '2026-11-18T10:00:00Z',
  });
  assert.equal(del2.updatedRequest.status, 'SELESAI');
  assert.equal(del2.updatedRequest.items[0].deliveredQty, 20);
  assert.equal(map.get('item_1')?.currentStock, 5);
  assert.equal(del2.ledgerEntries[0].balanceAfter, 5);
});

test('Negative stock blocked when warehouse stock drops below approved quantity', () => {
  const item = makeItem({ currentStock: 3 });
  const map = new Map([[item.id, item]]);
  const approved: StockRequest = {
    id: 'req_low',
    requestNumber: 'REQ-LOW',
    requesterUid: 'prod_1',
    requesterName: 'Budi',
    department: 'Produksi',
    notes: 'Urgent',
    status: 'SIAP_DIAMBIL',
    items: [
      {
        itemId: 'item_1',
        itemCode: 'BRG-001',
        itemName: 'Plat Baja 2mm',
        unitName: 'Lembar',
        requestedQty: 10,
        approvedQty: 10,
        deliveredQty: 0,
      },
    ],
    createdAt: '2026-11-18T08:00:00Z',
    updatedAt: '2026-11-18T08:00:00Z',
  };

  assert.throws(
    () =>
      processStockDelivery({
        request: approved,
        deliverQuantities: { item_1: 5 },
        itemsById: map,
        actor: { uid: 'admin_1', name: 'Admin', role: 'ADMIN' },
        notes: 'Coba kurangi melebihi stok',
        deliveryId: 'del_neg',
        deliveryNumber: 'SJ-NEG',
        stockOutNumber: 'BK-NEG',
        idempotencyKey: 'idem_neg',
        usedIdempotencyKeys: new Set(),
        nowIso: '2026-11-18T09:00:00Z',
      }),
    /tidak mencukupi/i
  );
  assert.equal(map.get('item_1')?.currentStock, 3);
});

test('Owner stock adjustment works and rejects non-owners or negative balances', () => {
  const item = makeItem({ currentStock: 10 });
  assert.throws(() =>
    applyStockAdjustment({
      item,
      type: 'OPNAME',
      value: 8,
      reason: 'Opname bulanan',
      actor: { uid: 'admin_1', name: 'Admin', role: 'ADMIN' },
      adjustmentId: 'adj_1',
      txNumber: 'ADJ-001',
      idempotencyKey: 'idem_adj_1',
      usedIdempotencyKeys: new Set(),
      nowIso: '2026-11-18T11:00:00Z',
    })
  );

  assert.throws(() =>
    applyStockAdjustment({
      item,
      type: 'DECREASE',
      value: 12,
      reason: 'Rusak',
      actor: { uid: 'owner_1', name: 'Owner', role: 'OWNER' },
      adjustmentId: 'adj_2',
      txNumber: 'ADJ-002',
      idempotencyKey: 'idem_adj_2',
      usedIdempotencyKeys: new Set(),
      nowIso: '2026-11-18T11:00:00Z',
    })
  );

  const res = applyStockAdjustment({
    item,
    type: 'OPNAME',
    value: 14,
    reason: 'Hasil stock opname gudang A',
    actor: { uid: 'owner_1', name: 'Owner', role: 'OWNER' },
    adjustmentId: 'adj_3',
    txNumber: 'ADJ-003',
    idempotencyKey: 'idem_adj_3',
    usedIdempotencyKeys: new Set(),
    nowIso: '2026-11-18T11:00:00Z',
  });
  assert.equal(res.updatedItem.currentStock, 14);
  assert.equal(res.adjustment.qtyChange, 4);
  assert.equal(res.ledgerEntry.qtyIn, 4);
  assert.equal(res.ledgerEntry.balanceAfter, 14);
});

test('Read notifications expire exactly 30 minutes after being read while unread stay visible', () => {
  const createdAt = '2026-11-18T08:00:00.000Z';
  const readAtOwner = '2026-11-18T10:00:00.000Z';
  const readAtMs = Date.parse(readAtOwner);

  const unreadNotif: NotificationItem = {
    id: 'n_unread',
    targetRole: 'OWNER',
    type: 'LOW_STOCK',
    title: 'Stok Minimum',
    message: 'Kabel hampir habis',
    readBy: [],
    createdAt,
  };

  const readNotif: NotificationItem = {
    id: 'n_read',
    targetRole: 'ADMIN',
    type: 'NEW_REQUEST',
    title: 'Permintaan Baru',
    message: 'Permintaan masuk',
    readBy: ['uid_owner'],
    readAtBy: { uid_owner: readAtOwner },
    createdAt,
  };

  // Even 3 hours after creation, unread notifications never expire
  assert.equal(isNotificationExpired(unreadNotif, 'uid_owner', readAtMs + 180 * 60 * 1000), false);
  assert.equal(getRemainingReadMinutes(unreadNotif, 'uid_owner', readAtMs), null);

  // At 29m59s after readAt, read notification is still visible
  const beforeExpiryMs = readAtMs + READ_NOTIFICATION_TTL_MS - 1000;
  assert.equal(isNotificationExpired(readNotif, 'uid_owner', beforeExpiryMs), false);
  assert.equal(getRemainingReadMinutes(readNotif, 'uid_owner', beforeExpiryMs), 1);

  // At exactly 30m00s after readAt, read notification disappears for uid_owner
  const atExpiryMs = readAtMs + READ_NOTIFICATION_TTL_MS;
  assert.equal(isNotificationExpired(readNotif, 'uid_owner', atExpiryMs), true);
  assert.equal(getRemainingReadMinutes(readNotif, 'uid_owner', atExpiryMs), 0);

  // Another user who has NOT read the same notification still sees it
  assert.equal(isNotificationExpired(readNotif, 'uid_admin', atExpiryMs), false);

  const visibleForOwner = filterVisibleNotifications([unreadNotif, readNotif], 'uid_owner', atExpiryMs);
  assert.deepEqual(
    visibleForOwner.map((n) => n.id),
    ['n_unread']
  );

  // RBAC check for notification deletion
  assert.equal(canDeleteNotification('OWNER', readNotif, 'uid_owner'), true);
  assert.equal(canDeleteNotification('ADMIN', readNotif, 'uid_admin'), true);
  assert.equal(canDeleteNotification('ADMIN', unreadNotif, 'uid_admin'), false);
  assert.equal(
    canDeleteNotification('PRODUKSI', { targetRole: 'PRODUKSI', targetUid: 'uid_prod_1' }, 'uid_prod_1'),
    true
  );
  assert.equal(
    canDeleteNotification('PRODUKSI', { targetRole: 'PRODUKSI', targetUid: 'uid_prod_2' }, 'uid_prod_1'),
    false
  );
});

test('generateNextSequentialCode continues sequentially past max code even after middle deletions', () => {
  assert.equal(generateNextSequentialCode('BRG', [], 3), 'BRG-001');

  // Simulate 40 items (BRG-001..BRG-040) where BRG-039 was deleted -> 39 items left, max is BRG-040
  const afterDelete39 = Array.from({ length: 40 }, (_, i) => `BRG-${String(i + 1).padStart(3, '0')}`).filter(
    (code) => code !== 'BRG-039'
  );
  assert.equal(afterDelete39.length, 39);
  assert.equal(generateNextSequentialCode('BRG', afterDelete39, 3), 'BRG-041');

  // Case-insensitive and ignores non-numeric or unrelated codes
  assert.equal(
    generateNextSequentialCode('KAT', ['KAT-LGM', 'kat-02', 'KAT-05', 'KAT-ELK'], 2),
    'KAT-06'
  );
  assert.equal(generateNextSequentialCode('SUP', ['SUP-01', 'SUP-03'], 2), 'SUP-04');
});

test('partitionDeletableItems separates deletable items from items with transaction history or non-OWNER role', () => {
  const cleanA = makeItem({ id: 'a', code: 'BRG-001', hasTransactions: false });
  const txB = makeItem({ id: 'b', code: 'BRG-002', hasTransactions: true });
  const cleanC = makeItem({ id: 'c', code: 'BRG-003', hasTransactions: false });

  const ownerSplit = partitionDeletableItems('OWNER', [cleanA, txB, cleanC]);
  assert.deepEqual(
    ownerSplit.deletable.map((i) => i.id),
    ['a', 'c']
  );
  assert.deepEqual(
    ownerSplit.locked.map((i) => i.id),
    ['b']
  );

  const adminSplit = partitionDeletableItems('ADMIN', [cleanA, txB, cleanC]);
  assert.equal(adminSplit.deletable.length, 0);
  assert.equal(adminSplit.locked.length, 3);
});

test('sortItemsByCode orders old and newly imported items naturally ascending by code', () => {
  const unsorted = [
    { code: 'BRG-040', name: 'Empat Puluh' },
    { code: 'SYNC-002', name: 'Sync Dua' },
    { code: 'BRG-002', name: 'Dua' },
    { code: 'BRG-10', name: 'Sepuluh' },
    { code: 'BRG-001', name: 'Satu' },
    { code: 'SYNC-001', name: 'Sync Satu' },
    { code: 'BRG-039', name: 'Tiga Sembilan' },
  ];
  const sorted = sortItemsByCode(unsorted);
  assert.deepEqual(
    sorted.map((i) => i.code),
    ['BRG-001', 'BRG-002', 'BRG-10', 'BRG-039', 'BRG-040', 'SYNC-001', 'SYNC-002']
  );
});

test('getNonOwnerUsers filters out OWNER accounts cleanly', () => {
  const mixedUsers: UserAccount[] = [
    {
      uid: 'u1',
      email: 'owner@pabrik.id',
      name: 'Owner',
      role: 'OWNER',
      department: 'Direksi',
      active: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      uid: 'u2',
      email: 'admin@pabrik.id',
      name: 'Admin',
      role: 'ADMIN',
      department: 'Gudang',
      active: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      uid: 'u3',
      email: 'prod1@pabrik.id',
      name: 'Prod 1',
      role: 'PRODUKSI',
      department: 'Line A',
      active: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  ];
  assert.deepEqual(
    getNonOwnerUsers(mixedUsers).map((u) => u.uid),
    ['u2', 'u3']
  );
});

test('Category, unit, and supplier deletion guards enforce OWNER role and block records still referenced', () => {
  const items = [makeItem({ categoryId: 'cat_used', unitId: 'unit_used', supplierId: 'sup_item' })];
  const incoming = [{ supplierId: 'sup_tx' }];

  const cats = [
    { id: 'cat_used', code: 'KAT-01', name: 'Logam' },
    { id: 'cat_free', code: 'KAT-02', name: 'Lainnya' },
  ];
  assert.equal(canDeleteCategory('OWNER', 'cat_used', items), false);
  assert.equal(canDeleteCategory('OWNER', 'cat_free', items), true);
  assert.equal(canDeleteCategory('ADMIN', 'cat_free', items), false);
  const catSplit = partitionDeletableCategories('OWNER', cats, items);
  assert.deepEqual(catSplit.deletable.map((c) => c.id), ['cat_free']);
  assert.deepEqual(catSplit.locked.map((c) => c.id), ['cat_used']);

  const units = [
    { id: 'unit_used', code: 'LBR', name: 'Lembar' },
    { id: 'unit_free', code: 'ROLL', name: 'Roll' },
  ];
  assert.equal(canDeleteUnit('OWNER', 'unit_used', items), false);
  assert.equal(canDeleteUnit('OWNER', 'unit_free', items), true);
  assert.equal(canDeleteUnit('PRODUKSI', 'unit_free', items), false);
  const unitSplit = partitionDeletableUnits('OWNER', units, items);
  assert.deepEqual(unitSplit.deletable.map((u) => u.id), ['unit_free']);
  assert.deepEqual(unitSplit.locked.map((u) => u.id), ['unit_used']);

  const suppliers = [
    { id: 'sup_item', code: 'SUP-01', name: 'Dipakai Barang' },
    { id: 'sup_tx', code: 'SUP-02', name: 'Dipakai Transaksi' },
    { id: 'sup_free', code: 'SUP-03', name: 'Tidak Dipakai' },
  ];
  assert.equal(canDeleteSupplier('OWNER', 'sup_item', items, incoming), false);
  assert.equal(canDeleteSupplier('OWNER', 'sup_tx', items, incoming), false);
  assert.equal(canDeleteSupplier('OWNER', 'sup_free', items, incoming), true);
  assert.equal(canDeleteSupplier('ADMIN', 'sup_free', items, incoming), false);
  const supSplit = partitionDeletableSuppliers('OWNER', suppliers, items, incoming);
  assert.deepEqual(supSplit.deletable.map((s) => s.id), ['sup_free']);
  assert.deepEqual(supSplit.locked.map((s) => s.id), ['sup_item', 'sup_tx']);
});

