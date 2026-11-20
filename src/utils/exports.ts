import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Category, DeliveryRecord, IncomingTransaction, InventoryItem, Supplier, Unit } from '../domain/types';
import {
  buildMasterDatabaseWorkbook,
  parseMasterDatabaseWorkbook,
  type ImportedItemRow,
  type ParsedMasterDatabase,
} from '../domain/masterExcel';

export function exportTableToExcel(
  filename: string,
  sheetName: string,
  columns: string[],
  rows: (string | number)[][]
): void {
  const wsData = [columns, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportTableToPdf(
  filename: string,
  title: string,
  subtitle: string,
  columns: string[],
  rows: (string | number)[][],
  companyName = 'INVENTORY MANAGEMENT SYSTEM'
): void {
  const pdf = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(companyName, 14, 15);
  pdf.setFontSize(11);
  pdf.text(title, 14, 22);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`${subtitle} · Dicetak ${new Date().toLocaleString('id-ID')}`, 14, 27);
  pdf.setTextColor(15, 23, 42);

  autoTable(pdf, {
    startY: 32,
    head: [columns],
    body: rows.map((r) => r.map((cell) => String(cell))),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  pdf.save(`${filename}.pdf`);
}

export function exportIncomingProofPdf(tx: IncomingTransaction, companyName: string): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(companyName, 14, 16);
  pdf.setFontSize(12);
  pdf.text('BUKTI TRANSAKSI BARANG MASUK', 14, 23);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(`No. Transaksi : ${tx.txNumber}`, 14, 33);
  pdf.text(`Tanggal       : ${tx.date}`, 14, 38);
  pdf.text(`Supplier      : ${tx.supplierName}`, 14, 43);
  pdf.text(`Status        : ${tx.status}`, 14, 48);
  pdf.text(`Petugas       : ${tx.createdByName}`, 120, 33);
  if (tx.confirmedByName) {
    pdf.text(`Dikonfirmasi  : ${tx.confirmedByName}`, 120, 38);
  }
  pdf.text(`Keterangan    : ${tx.notes || '-'}`, 14, 54);

  autoTable(pdf, {
    startY: 60,
    head: [['No', 'Kode', 'Nama Barang', 'Jumlah', 'Satuan', 'Harga Satuan', 'Subtotal']],
    body: tx.items.map((line, i) => [
      i + 1,
      line.itemCode,
      line.itemName,
      line.qty,
      line.unitName,
      `Rp ${line.price.toLocaleString('id-ID')}`,
      `Rp ${line.subtotal.toLocaleString('id-ID')}`,
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [153, 27, 27], textColor: 255 },
  });

  const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(`TOTAL NILAI: Rp ${tx.totalAmount.toLocaleString('id-ID')}`, 14, finalY + 10);

  pdf.save(`bukti-masuk-${tx.txNumber}.pdf`);
}

export function exportDeliveryProofPdf(delivery: DeliveryRecord, companyName: string): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(companyName, 14, 16);
  pdf.setFontSize(12);
  pdf.text('BUKTI PENYERAHAN & BARANG KELUAR', 14, 23);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(`No. Penyerahan : ${delivery.deliveryNumber}`, 14, 33);
  pdf.text(`No. Brg Keluar : ${delivery.stockOutNumber}`, 14, 38);
  pdf.text(`No. Permintaan : ${delivery.requestNumber}`, 14, 43);
  pdf.text(`Tanggal        : ${delivery.createdAt.slice(0, 10)}`, 14, 48);
  pdf.text(`Penerima (Prod): ${delivery.requesterName}`, 120, 33);
  pdf.text(`Diserahkan Oleh: ${delivery.deliveredByName}`, 120, 38);
  pdf.text(`Catatan        : ${delivery.notes || '-'}`, 14, 54);

  autoTable(pdf, {
    startY: 60,
    head: [['No', 'Kode Barang', 'Nama Barang', 'Jumlah Diserahkan', 'Satuan']],
    body: delivery.items.map((line, i) => [
      i + 1,
      line.itemCode,
      line.itemName,
      line.deliveredQty,
      line.unitName,
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;
  pdf.setFontSize(9);
  pdf.text('Diserahkan oleh Admin,', 20, finalY + 20);
  pdf.text('Diterima oleh Produksi,', 130, finalY + 20);
  pdf.text(`(${delivery.deliveredByName})`, 20, finalY + 38);
  pdf.text(`(${delivery.requesterName})`, 130, finalY + 38);

  pdf.save(`bukti-penyerahan-${delivery.deliveryNumber}.pdf`);
}

export type { ImportedItemRow, ParsedMasterDatabase };

export async function parseMasterDatabaseFromExcel(file: File): Promise<ParsedMasterDatabase> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return parseMasterDatabaseWorkbook(workbook);
}

export async function parseItemsFromExcel(file: File): Promise<ImportedItemRow[]> {
  const parsed = await parseMasterDatabaseFromExcel(file);
  return parsed.items;
}

export function exportItemsMasterExcel(
  items: InventoryItem[],
  categories: Category[],
  units: Unit[],
  suppliers: Supplier[],
  includePrice: boolean
): void {
  const wb = buildMasterDatabaseWorkbook({
    items,
    categories,
    units,
    suppliers,
    includePrice,
  });
  XLSX.writeFile(wb, `master-database-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
