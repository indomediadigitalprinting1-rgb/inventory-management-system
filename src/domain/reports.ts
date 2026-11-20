import type {
  DeliveryRecord,
  IncomingTransaction,
  InventoryItem,
  LedgerTxType,
  ReportType,
  StockLedgerEntry,
  StockRequest,
} from './types';
import { REQUEST_STATUS_LABELS } from './types';

export interface ReportFilter {
  reportType: ReportType;
  startDate?: string;
  endDate?: string;
  itemId?: string;
  categoryName?: string;
  userId?: string;
  txType?: LedgerTxType | 'ALL';
}

export interface ReportTableData {
  title: string;
  subtitle: string;
  columns: string[];
  rows: (string | number)[][];
}

function inDateRange(dateStr: string, start?: string, end?: string): boolean {
  const d = dateStr.slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

export function buildReportData(params: {
  filter: ReportFilter;
  items: InventoryItem[];
  incoming: IncomingTransaction[];
  deliveries: DeliveryRecord[];
  requests: StockRequest[];
  ledger: StockLedgerEntry[];
}): ReportTableData {
  const { filter, items, incoming, deliveries, requests, ledger } = params;
  const itemById = new Map(items.map((i) => [i.id, i]));

  switch (filter.reportType) {
    case 'STOK': {
      const filtered = items.filter((i) => {
        if (filter.itemId && i.id !== filter.itemId) return false;
        if (filter.categoryName && i.categoryName !== filter.categoryName) return false;
        return true;
      });
      return {
        title: 'Laporan Stok Keseluruhan',
        subtitle: `Total ${filtered.length} barang terdaftar`,
        columns: ['Kode', 'Barcode', 'Nama Barang', 'Kategori', 'Satuan', 'Stok Saat Ini', 'Stok Min', 'Status'],
        rows: filtered.map((i) => [
          i.code,
          i.barcode,
          i.name,
          i.categoryName,
          i.unitName,
          i.currentStock,
          i.minStock,
          i.currentStock <= 0 ? 'Habis' : i.currentStock <= i.minStock ? 'Minimum' : 'Aman',
        ]),
      };
    }

    case 'STOK_MINIMUM': {
      const filtered = items.filter(
        (i) =>
          i.active &&
          i.currentStock > 0 &&
          i.currentStock <= i.minStock &&
          (!filter.categoryName || i.categoryName === filter.categoryName)
      );
      return {
        title: 'Laporan Stok Minimum',
        subtitle: `${filtered.length} barang mendekati batas minimum`,
        columns: ['Kode', 'Nama Barang', 'Kategori', 'Stok Saat Ini', 'Stok Min', 'Supplier'],
        rows: filtered.map((i) => [
          i.code,
          i.name,
          i.categoryName,
          `${i.currentStock} ${i.unitName}`,
          `${i.minStock} ${i.unitName}`,
          i.supplierName,
        ]),
      };
    }

    case 'STOK_HABIS': {
      const filtered = items.filter(
        (i) =>
          i.active &&
          i.currentStock <= 0 &&
          (!filter.categoryName || i.categoryName === filter.categoryName)
      );
      return {
        title: 'Laporan Stok Habis',
        subtitle: `${filtered.length} barang dengan saldo 0`,
        columns: ['Kode', 'Barcode', 'Nama Barang', 'Kategori', 'Stok Min', 'Supplier Utama'],
        rows: filtered.map((i) => [
          i.code,
          i.barcode,
          i.name,
          i.categoryName,
          `${i.minStock} ${i.unitName}`,
          i.supplierName,
        ]),
      };
    }

    case 'BARANG_MASUK': {
      const filtered = incoming.filter((tx) => {
        if (!inDateRange(tx.date, filter.startDate, filter.endDate)) return false;
        if (filter.userId && tx.createdByUid !== filter.userId) return false;
        if (filter.itemId && !tx.items.some((l) => l.itemId === filter.itemId)) return false;
        return true;
      });
      return {
        title: 'Laporan Barang Masuk',
        subtitle: `${filtered.length} transaksi barang masuk`,
        columns: ['No. Transaksi', 'Tanggal', 'Supplier', 'Item', 'Total Nilai', 'Status', 'Pengguna'],
        rows: filtered.map((tx) => [
          tx.txNumber,
          tx.date,
          tx.supplierName,
          tx.items.map((l) => `${l.itemName} (${l.qty} ${l.unitName})`).join(', '),
          tx.totalAmount,
          tx.status,
          tx.createdByName,
        ]),
      };
    }

    case 'BARANG_KELUAR': {
      const filtered = deliveries.filter((d) => {
        if (!inDateRange(d.createdAt, filter.startDate, filter.endDate)) return false;
        if (filter.userId && d.deliveredByUid !== filter.userId) return false;
        if (filter.itemId && !d.items.some((l) => l.itemId === filter.itemId)) return false;
        return true;
      });
      return {
        title: 'Laporan Barang Keluar',
        subtitle: `${filtered.length} transaksi penyerahan keluar`,
        columns: ['No. Keluar', 'No. Penyerahan', 'Tanggal', 'Ref Permintaan', 'Penerima', 'Item', 'Admin'],
        rows: filtered.map((d) => [
          d.stockOutNumber,
          d.deliveryNumber,
          d.createdAt.slice(0, 10),
          d.requestNumber,
          d.requesterName,
          d.items.map((l) => `${l.itemName} (${l.deliveredQty} ${l.unitName})`).join(', '),
          d.deliveredByName,
        ]),
      };
    }

    case 'PENGGUNAAN_PRODUKSI': {
      const usageMap = new Map<
        string,
        { requesterName: string; itemCode: string; itemName: string; unitName: string; totalQty: number }
      >();
      for (const d of deliveries) {
        if (!inDateRange(d.createdAt, filter.startDate, filter.endDate)) continue;
        if (filter.userId && d.requesterUid !== filter.userId) continue;
        for (const line of d.items) {
          if (filter.itemId && line.itemId !== filter.itemId) continue;
          const item = itemById.get(line.itemId);
          if (filter.categoryName && item?.categoryName !== filter.categoryName) continue;
          const key = `${d.requesterUid}_${line.itemId}`;
          const prev = usageMap.get(key) ?? {
            requesterName: d.requesterName,
            itemCode: line.itemCode,
            itemName: line.itemName,
            unitName: line.unitName,
            totalQty: 0,
          };
          prev.totalQty += line.deliveredQty;
          usageMap.set(key, prev);
        }
      }
      const rows = Array.from(usageMap.values());
      return {
        title: 'Laporan Penggunaan Bahan Produksi',
        subtitle: `Rekap pemakaian material oleh staf produksi`,
        columns: ['Staf Produksi', 'Kode Barang', 'Nama Barang', 'Total Diambil', 'Satuan'],
        rows: rows.map((r) => [r.requesterName, r.itemCode, r.itemName, r.totalQty, r.unitName]),
      };
    }

    case 'TRANSAKSI_PENGGUNA':
    case 'PERIODE':
    case 'KARTU_STOK': {
      const filtered = ledger.filter((l) => {
        if (!inDateRange(l.date, filter.startDate, filter.endDate)) return false;
        if (filter.itemId && l.itemId !== filter.itemId) return false;
        if (filter.categoryName && l.categoryName !== filter.categoryName) return false;
        if (filter.userId && l.userId !== filter.userId) return false;
        if (filter.txType && filter.txType !== 'ALL' && l.txType !== filter.txType) return false;
        return true;
      });
      const titles: Record<string, string> = {
        TRANSAKSI_PENGGUNA: 'Laporan Transaksi Berdasarkan Pengguna',
        PERIODE: 'Laporan Pergerakan Stok Berdasarkan Periode',
        KARTU_STOK: 'Laporan Kartu Stok Barang',
      };
      return {
        title: titles[filter.reportType],
        subtitle: `${filtered.length} baris mutasi tercatat`,
        columns: ['Tanggal', 'No. Transaksi', 'Jenis', 'Kode', 'Barang', 'Masuk', 'Keluar', 'Saldo', 'Pengguna'],
        rows: filtered.map((l) => [
          l.date,
          l.txNumber,
          l.txType,
          l.itemCode,
          l.itemName,
          l.qtyIn,
          l.qtyOut,
          l.balanceAfter,
          l.userName,
        ]),
      };
    }

    case 'PERMINTAAN_BARANG': {
      const filtered = requests.filter((r) => {
        if (!inDateRange(r.createdAt, filter.startDate, filter.endDate)) return false;
        if (filter.userId && r.requesterUid !== filter.userId) return false;
        if (filter.itemId && !r.items.some((l) => l.itemId === filter.itemId)) return false;
        return true;
      });
      return {
        title: 'Laporan Permintaan Barang',
        subtitle: `${filtered.length} permintaan material produksi`,
        columns: ['No. Permintaan', 'Tanggal', 'Pemohon', 'Departemen', 'Status', 'Ringkasan Item'],
        rows: filtered.map((r) => [
          r.requestNumber,
          r.createdAt.slice(0, 10),
          r.requesterName,
          r.department,
          REQUEST_STATUS_LABELS[r.status],
          r.items.map((l) => `${l.itemName} (${l.deliveredQty}/${l.approvedQty || l.requestedQty})`).join(', '),
        ]),
      };
    }
  }
}
