import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportData } from './reports';
import type { InventoryItem, ReportType, StockLedgerEntry } from './types';

const items: InventoryItem[] = [
  {
    id: 'i1',
    code: 'BRG-001',
    barcode: 'IMS-001',
    name: 'Baut M8',
    categoryId: 'c1',
    categoryName: 'Fastener',
    specification: 'Stainless',
    unitId: 'u1',
    unitName: 'Pcs',
    initialStock: 100,
    currentStock: 0,
    minStock: 20,
    purchasePrice: 500,
    supplierId: 's1',
    supplierName: 'PT Baut Jaya',
    active: true,
    hasTransactions: true,
    createdByUid: 'o1',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'i2',
    code: 'BRG-002',
    barcode: 'IMS-002',
    name: 'Kabel NYY 2x1.5',
    categoryId: 'c2',
    categoryName: 'Elektrikal',
    specification: '50m Roll',
    unitId: 'u2',
    unitName: 'Roll',
    initialStock: 10,
    currentStock: 4,
    minStock: 5,
    purchasePrice: 350000,
    supplierId: 's1',
    supplierName: 'PT Baut Jaya',
    active: true,
    hasTransactions: true,
    createdByUid: 'o1',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
];

const ledger: StockLedgerEntry[] = [
  {
    id: 'l1',
    date: '2026-11-18',
    txNumber: 'BM-001',
    txType: 'MASUK',
    referenceId: 'in1',
    itemId: 'i2',
    itemCode: 'BRG-002',
    itemName: 'Kabel NYY 2x1.5',
    categoryName: 'Elektrikal',
    unitName: 'Roll',
    qtyIn: 5,
    qtyOut: 0,
    balanceAfter: 10,
    notes: 'Restock',
    userId: 'a1',
    userName: 'Admin',
    createdAt: '2026-11-18T08:00:00Z',
  },
];

test('All 10 report types generate structured tables and respect filters', () => {
  const allTypes: ReportType[] = [
    'STOK',
    'STOK_MINIMUM',
    'STOK_HABIS',
    'BARANG_MASUK',
    'BARANG_KELUAR',
    'PENGGUNAAN_PRODUKSI',
    'TRANSAKSI_PENGGUNA',
    'PERIODE',
    'KARTU_STOK',
    'PERMINTAAN_BARANG',
  ];

  for (const reportType of allTypes) {
    const res = buildReportData({
      filter: { reportType },
      items,
      incoming: [],
      deliveries: [],
      requests: [],
      ledger,
    });
    assert.ok(res.title.length > 0);
    assert.ok(res.columns.length >= 4);
  }

  const outOfStock = buildReportData({
    filter: { reportType: 'STOK_HABIS' },
    items,
    incoming: [],
    deliveries: [],
    requests: [],
    ledger,
  });
  assert.equal(outOfStock.rows.length, 1);
  assert.equal(outOfStock.rows[0][0], 'BRG-001');

  const minStock = buildReportData({
    filter: { reportType: 'STOK_MINIMUM' },
    items,
    incoming: [],
    deliveries: [],
    requests: [],
    ledger,
  });
  assert.equal(minStock.rows.length, 1);
  assert.equal(minStock.rows[0][0], 'BRG-002');
});
