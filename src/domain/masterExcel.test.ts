import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildMasterDatabaseWorkbook,
  generateSequentialMasterCode,
  generateUnitCodeFromName,
  parseActiveStatus,
  parseMasterDatabaseWorkbook,
  parseNumericCell,
} from './masterExcel';
import type { Category, InventoryItem, Supplier, Unit } from './types';

test('Master Excel round-trip preserves items, categories, units, and suppliers', () => {
  const categories: Category[] = [
    {
      id: 'cat_1',
      code: 'KAT-01',
      name: 'Logam & Plat',
      description: 'Material plat dan besi',
      active: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'cat_2',
      code: 'KAT-02',
      name: 'Elektrikal',
      description: 'Komponen panel',
      active: false,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  ];

  const units: Unit[] = [
    {
      id: 'unit_1',
      code: 'LBR',
      name: 'Lembar',
      description: 'Satuan lembaran',
      active: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  ];

  const suppliers: Supplier[] = [
    {
      id: 'sup_1',
      code: 'SUP-01',
      name: 'PT Baja Nusantara',
      contactPerson: 'Andi Wijaya',
      phone: '08123456789',
      email: 'sales@baja.id',
      address: 'Jl. Industri No. 12 Bekasi',
      active: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  ];

  const items: InventoryItem[] = [
    {
      id: 'item_1',
      code: 'BRG-001',
      barcode: 'IMS-100001',
      name: 'Plat Baja Galvanis 2mm',
      categoryId: 'cat_1',
      categoryName: 'Logam & Plat',
      specification: '2mm x 1200mm x 2400mm',
      unitId: 'unit_1',
      unitName: 'Lembar',
      initialStock: 40,
      currentStock: 48,
      minStock: 10,
      purchasePrice: 275000,
      supplierId: 'sup_1',
      supplierName: 'PT Baja Nusantara',
      active: true,
      hasTransactions: true,
      createdByUid: 'uid_owner_01',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  ];

  const wb = buildMasterDatabaseWorkbook({
    items,
    categories,
    units,
    suppliers,
    includePrice: true,
  });

  assert.deepEqual(wb.SheetNames, ['Master Barang', 'Kategori', 'Satuan', 'Supplier']);

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const reloaded = XLSX.read(buf, { type: 'array' });
  const parsed = parseMasterDatabaseWorkbook(reloaded);

  assert.equal(parsed.categories.length, 2);
  assert.equal(parsed.categories[0].code, 'KAT-01');
  assert.equal(parsed.categories[1].active, false);

  assert.equal(parsed.units.length, 1);
  assert.equal(parsed.units[0].code, 'LBR');
  assert.equal(parsed.units[0].name, 'Lembar');

  assert.equal(parsed.suppliers.length, 1);
  assert.equal(parsed.suppliers[0].contactPerson, 'Andi Wijaya');
  assert.equal(parsed.suppliers[0].phone, '08123456789');
  assert.equal(parsed.suppliers[0].address, 'Jl. Industri No. 12 Bekasi');

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].code, 'BRG-001');
  assert.equal(parsed.items[0].categoryCode, 'KAT-01');
  assert.equal(parsed.items[0].unitCode, 'LBR');
  assert.equal(parsed.items[0].supplierCode, 'SUP-01');
  assert.equal(parsed.items[0].purchasePrice, 275000);
  assert.equal(parsed.items[0].minStock, 10);
});

test('Parser supports legacy single-sheet Excel and Suplayer/number aliases', () => {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Kode Barang', 'Nama Barang', 'Kategori', 'Satuan', 'Stok Awal', 'Min Stok', 'Harga', 'Suplayer'],
    ['BRG-099', 'Tinta Cyan 1L', 'Tinta Digital', 'Botol', 15, 3, 'Rp 185.000', 'CV Warna Indah'],
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');

  const parsed = parseMasterDatabaseWorkbook(wb);
  assert.equal(parsed.categories.length, 0);
  assert.equal(parsed.units.length, 0);
  assert.equal(parsed.suppliers.length, 0);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].categoryName, 'Tinta Digital');
  assert.equal(parsed.items[0].unitName, 'Botol');
  assert.equal(parsed.items[0].supplierName, 'CV Warna Indah');
  assert.equal(parsed.items[0].purchasePrice, 185000);
  assert.equal(parsed.items[0].active, true);
});

test('Helper functions generate non-colliding codes and parse numbers/statuses safely', () => {
  assert.equal(generateSequentialMasterCode('KAT', ['KAT-01', 'kat-02']), 'KAT-03');
  assert.equal(generateUnitCodeFromName('Botol', ['PCS', 'BOTOL']), 'BOTOL2');
  assert.equal(parseActiveStatus('Nonaktif'), false);
  assert.equal(parseActiveStatus('Aktif'), true);
  assert.equal(parseNumericCell('Rp 250,000'), 250000);
  assert.equal(parseNumericCell(42.5), 42.5);
});
