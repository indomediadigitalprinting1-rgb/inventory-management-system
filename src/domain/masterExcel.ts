import * as XLSX from 'xlsx';
import { generateNextSequentialCode, sortItemsByCode } from './rules';
import type { Category, InventoryItem, Supplier, Unit } from './types';

export interface ImportedCategoryRow {
  code: string;
  name: string;
  description: string;
  active: boolean;
}

export interface ImportedUnitRow {
  code: string;
  name: string;
  description: string;
  active: boolean;
}

export interface ImportedSupplierRow {
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

export interface ImportedItemRow {
  code: string;
  barcode: string;
  name: string;
  categoryCode: string;
  categoryName: string;
  specification: string;
  unitCode: string;
  unitName: string;
  initialStock: number;
  minStock: number;
  purchasePrice: number;
  supplierCode: string;
  supplierName: string;
  active: boolean;
}

export interface ParsedMasterDatabase {
  items: ImportedItemRow[];
  categories: ImportedCategoryRow[];
  units: ImportedUnitRow[];
  suppliers: ImportedSupplierRow[];
}

export interface MasterDatabaseImportSummary {
  itemsCreated: number;
  itemsUpdated: number;
  categoriesCreated: number;
  categoriesUpdated: number;
  unitsCreated: number;
  unitsUpdated: number;
  suppliersCreated: number;
  suppliersUpdated: number;
  skipped: string[];
}

export function parseActiveStatus(raw: string): boolean {
  const val = raw.trim().toLowerCase();
  if (!val) return true;
  if (['nonaktif', 'tidak aktif', 'inactive', 'false', '0', 'no', 'tidak'].includes(val)) {
    return false;
  }
  return true;
}

export function parseNumericCell(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const str = String(raw ?? '')
    .replace(/rp/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!str) return 0;
  // Handle formatted integer thousands like 120,000 or 120.000 only when clearly grouping 3 digits
  const normalized = /^\d{1,3}(,\d{3})+$/.test(str)
    ? str.replace(/,/g, '')
    : /^\d{1,3}(\.\d{3})+$/.test(str)
      ? str.replace(/\./g, '')
      : str.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function getRowString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
    if (found !== undefined && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
}

function getRowRaw(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
    if (found !== undefined && String(row[found]).trim() !== '') {
      return row[found];
    }
  }
  return '';
}

function findSheetByAliases(workbook: XLSX.WorkBook, aliases: string[]): XLSX.WorkSheet | null {
  const lowerAliases = new Set(aliases.map((a) => a.toLowerCase()));
  const matchedName = workbook.SheetNames.find((name) => lowerAliases.has(name.trim().toLowerCase()));
  return matchedName ? workbook.Sheets[matchedName] : null;
}

export function buildMasterDatabaseWorkbook(params: {
  items: InventoryItem[];
  categories: Category[];
  units: Unit[];
  suppliers: Supplier[];
  includePrice: boolean;
}): XLSX.WorkBook {
  const catById = new Map(params.categories.map((c) => [c.id, c]));
  const unitById = new Map(params.units.map((u) => [u.id, u]));
  const supById = new Map(params.suppliers.map((s) => [s.id, s]));

  const itemColumns = [
    'Kode Barang',
    'Barcode',
    'Nama Barang',
    'Kode Kategori',
    'Kategori',
    'Spesifikasi',
    'Kode Satuan',
    'Satuan',
    'Stok Awal',
    'Stok Saat Ini',
    'Stok Minimum',
    ...(params.includePrice ? ['Harga Pembelian'] : []),
    'Kode Supplier',
    'Supplier Utama',
    'Status',
  ];

  const itemRows = sortItemsByCode(params.items).map((item) => {
    const cat = catById.get(item.categoryId);
    const unit = unitById.get(item.unitId);
    const sup = supById.get(item.supplierId);
    return [
      item.code,
      item.barcode,
      item.name,
      cat?.code ?? '',
      cat?.name ?? item.categoryName,
      item.specification,
      unit?.code ?? '',
      unit?.name ?? item.unitName,
      item.initialStock,
      item.currentStock,
      item.minStock,
      ...(params.includePrice ? [item.purchasePrice] : []),
      sup?.code ?? '',
      sup?.name ?? item.supplierName,
      item.active ? 'Aktif' : 'Nonaktif',
    ];
  });

  const catColumns = ['Kode Kategori', 'Nama Kategori', 'Deskripsi', 'Status'];
  const catRows = params.categories.map((c) => [
    c.code,
    c.name,
    c.description,
    c.active ? 'Aktif' : 'Nonaktif',
  ]);

  const unitColumns = ['Kode Satuan', 'Nama Satuan', 'Deskripsi', 'Status'];
  const unitRows = params.units.map((u) => [
    u.code,
    u.name,
    u.description,
    u.active ? 'Aktif' : 'Nonaktif',
  ]);

  const supColumns = ['Kode Supplier', 'Nama Supplier', 'Kontak PIC', 'No. Telepon', 'Email', 'Alamat', 'Status'];
  const supRows = params.suppliers.map((s) => [
    s.code,
    s.name,
    s.contactPerson,
    s.phone,
    s.email,
    s.address,
    s.active ? 'Aktif' : 'Nonaktif',
  ]);

  const wb = XLSX.utils.book_new();

  const itemsWs = XLSX.utils.aoa_to_sheet([itemColumns, ...itemRows]);
  itemsWs['!cols'] = itemColumns.map((col) => ({ wch: Math.max(col.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, itemsWs, 'Master Barang');

  const catsWs = XLSX.utils.aoa_to_sheet([catColumns, ...catRows]);
  catsWs['!cols'] = [{ wch: 16 }, { wch: 26 }, { wch: 36 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, catsWs, 'Kategori');

  const unitsWs = XLSX.utils.aoa_to_sheet([unitColumns, ...unitRows]);
  unitsWs['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 36 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, unitsWs, 'Satuan');

  const supsWs = XLSX.utils.aoa_to_sheet([supColumns, ...supRows]);
  supsWs['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 26 }, { wch: 36 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, supsWs, 'Supplier');

  return wb;
}

export function parseMasterDatabaseWorkbook(workbook: XLSX.WorkBook): ParsedMasterDatabase {
  const catSheet = findSheetByAliases(workbook, ['Kategori', 'Category', 'Categories']);
  const unitSheet = findSheetByAliases(workbook, ['Satuan', 'Unit', 'Units']);
  const supSheet = findSheetByAliases(workbook, ['Supplier', 'Suppliers', 'Suplayer', 'Pemasok']);
  let itemSheet = findSheetByAliases(workbook, ['Master Barang', 'Barang', 'Items', 'Item', 'Master']);

  if (!itemSheet && workbook.SheetNames.length > 0) {
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    if (firstSheet !== catSheet && firstSheet !== unitSheet && firstSheet !== supSheet) {
      itemSheet = firstSheet;
    }
  }

  const categories: ImportedCategoryRow[] = catSheet
    ? XLSX.utils
        .sheet_to_json<Record<string, unknown>>(catSheet, { defval: '' })
        .map((row) => ({
          code: getRowString(row, ['Kode Kategori', 'Kode', 'code']),
          name: getRowString(row, ['Nama Kategori', 'Kategori', 'Nama', 'name']),
          description: getRowString(row, ['Deskripsi', 'Keterangan', 'description']),
          active: parseActiveStatus(getRowString(row, ['Status', 'active'])),
        }))
        .filter((r) => r.name.length > 0)
    : [];

  const units: ImportedUnitRow[] = unitSheet
    ? XLSX.utils
        .sheet_to_json<Record<string, unknown>>(unitSheet, { defval: '' })
        .map((row) => ({
          code: getRowString(row, ['Kode Satuan', 'Kode', 'code']),
          name: getRowString(row, ['Nama Satuan', 'Satuan', 'Nama', 'name']),
          description: getRowString(row, ['Deskripsi', 'Keterangan', 'description']),
          active: parseActiveStatus(getRowString(row, ['Status', 'active'])),
        }))
        .filter((r) => r.name.length > 0)
    : [];

  const suppliers: ImportedSupplierRow[] = supSheet
    ? XLSX.utils
        .sheet_to_json<Record<string, unknown>>(supSheet, { defval: '' })
        .map((row) => ({
          code: getRowString(row, ['Kode Supplier', 'Kode Suplayer', 'Kode', 'code']),
          name: getRowString(row, ['Nama Supplier', 'Nama Suplayer', 'Supplier', 'Suplayer', 'Nama', 'name']),
          contactPerson: getRowString(row, ['Kontak PIC', 'PIC', 'Kontak', 'contactPerson']),
          phone: getRowString(row, ['No. Telepon', 'No Telepon', 'Telepon', 'No. HP', 'No HP', 'HP', 'phone']),
          email: getRowString(row, ['Email', 'email']),
          address: getRowString(row, ['Alamat', 'address']),
          active: parseActiveStatus(getRowString(row, ['Status', 'active'])),
        }))
        .filter((r) => r.name.length > 0)
    : [];

  const items: ImportedItemRow[] = itemSheet
    ? XLSX.utils
        .sheet_to_json<Record<string, unknown>>(itemSheet, { defval: '' })
        .map((row) => ({
          code: getRowString(row, ['Kode Barang', 'Kode', 'code']),
          barcode: getRowString(row, ['Barcode', 'barcode']),
          name: getRowString(row, ['Nama Barang', 'Nama', 'name']),
          categoryCode: getRowString(row, ['Kode Kategori', 'categoryCode']),
          categoryName: getRowString(row, ['Kategori', 'Nama Kategori', 'category', 'categoryName']),
          specification: getRowString(row, ['Spesifikasi', 'specification']),
          unitCode: getRowString(row, ['Kode Satuan', 'unitCode']),
          unitName: getRowString(row, ['Satuan', 'Nama Satuan', 'unit', 'unitName']),
          initialStock: parseNumericCell(getRowRaw(row, ['Stok Awal', 'Stok', 'initialStock'])),
          minStock: parseNumericCell(getRowRaw(row, ['Stok Minimum', 'Min Stok', 'minStock'])),
          purchasePrice: parseNumericCell(
            getRowRaw(row, ['Harga Pembelian', 'Harga Beli', 'Harga', 'purchasePrice'])
          ),
          supplierCode: getRowString(row, ['Kode Supplier', 'Kode Suplayer', 'supplierCode']),
          supplierName: getRowString(row, [
            'Supplier Utama',
            'Supplier',
            'Suplayer',
            'Nama Supplier',
            'Nama Suplayer',
            'supplierName',
          ]),
          active: parseActiveStatus(getRowString(row, ['Status', 'active'])),
        }))
        .filter((r) => r.code.length > 0 && r.name.length > 0)
    : [];

  return { items, categories, units, suppliers };
}

export function generateSequentialMasterCode(prefix: string, existingCodes: string[]): string {
  return generateNextSequentialCode(prefix, existingCodes, 2);
}

export function generateUnitCodeFromName(name: string, existingCodes: string[]): string {
  const taken = new Set(existingCodes.map((c) => c.trim().toUpperCase()));
  const base =
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12) || 'UNIT';
  if (!taken.has(base)) return base;
  let seq = 2;
  while (seq < 1000) {
    const candidate = `${base.slice(0, 18)}${seq}`;
    if (!taken.has(candidate)) return candidate;
    seq++;
  }
  return `U${Date.now().toString().slice(-5)}`;
}
