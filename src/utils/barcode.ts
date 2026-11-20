import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import type { InventoryItem } from '../domain/types';

export function renderCode128ToSvg(svgElement: SVGSVGElement, value: string): void {
  if (!value.trim()) return;
  JsBarcode(svgElement, value.trim(), {
    format: 'CODE128',
    lineColor: '#0f172a',
    width: 1.8,
    height: 48,
    displayValue: true,
    fontSize: 12,
    font: 'monospace',
    margin: 6,
    background: '#ffffff',
  });
}

export function renderCode128DataUrl(value: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, value.trim(), {
    format: 'CODE128',
    lineColor: '#0f172a',
    width: 2,
    height: 54,
    displayValue: true,
    fontSize: 13,
    font: 'monospace',
    margin: 8,
    background: '#ffffff',
  });
  return canvas.toDataURL('image/png');
}

export function exportBarcodeLabelsPdf(
  labels: Array<{ item: InventoryItem; qty: number }>,
  layout: 'A4_GRID' | 'THERMAL_50X30'
): void {
  const expanded: InventoryItem[] = [];
  for (const entry of labels) {
    const count = Math.max(1, Math.min(200, Math.floor(entry.qty)));
    for (let i = 0; i < count; i++) {
      expanded.push(entry.item);
    }
  }
  if (expanded.length === 0) return;

  if (layout === 'THERMAL_50X30') {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] });
    expanded.forEach((item, idx) => {
      if (idx > 0) pdf.addPage([50, 30], 'landscape');
      const imgData = renderCode128DataUrl(item.barcode);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text(item.name.slice(0, 30), 25, 4.5, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.text(item.code, 25, 8, { align: 'center' });
      pdf.addImage(imgData, 'PNG', 4, 9.5, 42, 18);
    });
    pdf.save(`label-thermal-${Date.now()}.pdf`);
    return;
  }

  // Standard A4 3x8 label grid (24 labels per page)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cols = 3;
  const rows = 8;
  const marginX = 10;
  const marginY = 12;
  const cellW = 63;
  const cellH = 33.5;

  expanded.forEach((item, idx) => {
    const posInPage = idx % (cols * rows);
    if (idx > 0 && posInPage === 0) pdf.addPage();
    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);
    const x = marginX + col * cellW;
    const y = marginY + row * cellH;

    pdf.setDrawColor(203, 213, 225);
    pdf.rect(x + 1, y + 1, cellW - 2, cellH - 2);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(item.name.slice(0, 30), x + cellW / 2, y + 6, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(`Kode: ${item.code} · ${item.unitName}`, x + cellW / 2, y + 10, { align: 'center' });
    const imgData = renderCode128DataUrl(item.barcode);
    pdf.addImage(imgData, 'PNG', x + 5, y + 11.5, cellW - 10, 19);
  });

  pdf.save(`label-barcode-a4-${Date.now()}.pdf`);
}
