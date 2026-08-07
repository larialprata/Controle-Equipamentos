import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { buildMovementQrUrl, buildQrDataUrlWithLogo } from './qr';

export type EquipmentQrPdfItem = {
  qrValue: string;
  ativoPlaca: string;
  equipmentName?: string;
  companyName?: string;
  contractName?: string;
  /** Pasta de obra no ZIP (ex.: "Obra 242") */
  obraName?: string;
};

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

/** Etiqueta ocupa ~1/3 da folha A4 (largura), alinhada ao topo para impressão/recorte. */
const LABEL_WIDTH_MM = PAGE_WIDTH_MM / 3;
const LABEL_HEIGHT_MM = PAGE_HEIGHT_MM / 3;
const LABEL_TOP_MM = 12;
const QR_SIZE_MM = 38;
const CONTENT_MAX_WIDTH = LABEL_WIDTH_MM - 8;

async function drawEquipmentQrPage(doc: jsPDF, item: EquipmentQrPdfItem, pageIndex: number): Promise<void> {
  if (pageIndex > 0) {
    doc.addPage('a4', 'portrait');
  }

  const qrDataUrl = await buildQrDataUrlWithLogo(buildMovementQrUrl(item.qrValue), {
    width: 400,
    margin: 1,
  });

  const centerX = PAGE_WIDTH_MM / 2;
  let y = LABEL_TOP_MM + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text('DIMENSIONAL ENGENHARIA', centerX, y, { align: 'center' });
  y += 5;

  doc.setTextColor(0);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('QR — movimentações', centerX, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const ativoLines = doc.splitTextToSize(item.ativoPlaca || '—', CONTENT_MAX_WIDTH);
  doc.text(ativoLines, centerX, y, { align: 'center' });
  y += ativoLines.length * 5 + 2;

  if (item.equipmentName?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const nameLines = doc.splitTextToSize(item.equipmentName.trim(), CONTENT_MAX_WIDTH);
    doc.text(nameLines, centerX, y, { align: 'center' });
    y += nameLines.length * 4 + 2;
  }

  const metaLines: string[] = [];
  if (item.companyName?.trim()) metaLines.push(`Empresa: ${item.companyName.trim()}`);
  if (item.contractName?.trim()) metaLines.push(`Contrato: ${item.contractName.trim()}`);

  if (metaLines.length > 0) {
    doc.setFontSize(6.5);
    doc.setTextColor(70);
    metaLines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, CONTENT_MAX_WIDTH);
      doc.text(wrapped, centerX, y, { align: 'center' });
      y += wrapped.length * 3.5 + 1;
    });
    doc.setTextColor(0);
    y += 2;
  }

  const qrX = (PAGE_WIDTH_MM - QR_SIZE_MM) / 2;
  doc.addImage(qrDataUrl, 'PNG', qrX, y, QR_SIZE_MM, QR_SIZE_MM);
  y += QR_SIZE_MM + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('Escaneie para abertura/fechamento', centerX, y, {
    align: 'center',
    maxWidth: CONTENT_MAX_WIDTH,
  });
  y += 4;

  doc.setFontSize(5);
  doc.setTextColor(110);
  const codeLines = doc.splitTextToSize(`Cód.: ${item.qrValue}`, CONTENT_MAX_WIDTH);
  doc.text(codeLines, centerX, y, { align: 'center' });
  doc.setTextColor(0);
}

function safePdfFilename(base: string): string {
  const cleaned = base.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'equipamento';
}

function safePathSegment(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim();
  return cleaned || 'Sem nome';
}

function resolveObraFolder(item: EquipmentQrPdfItem): string {
  if (item.obraName?.trim()) return safePathSegment(item.obraName.trim());
  if (item.contractName?.trim()) return safePathSegment(item.contractName.trim());
  return 'Sem obra';
}

function resolveCompanyFolder(item: EquipmentQrPdfItem): string {
  if (item.companyName?.trim()) return safePathSegment(item.companyName.trim());
  return 'Sem empresa';
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function buildEquipmentQrPdfBlob(item: EquipmentQrPdfItem): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  await drawEquipmentQrPage(doc, item, 0);
  return doc.output('blob');
}

export async function downloadEquipmentQrPdf(item: EquipmentQrPdfItem): Promise<void> {
  const blob = await buildEquipmentQrPdfBlob(item);
  triggerBlobDownload(blob, `QR-${safePdfFilename(item.ativoPlaca)}.pdf`);
}

export async function downloadEquipmentQrPdfBatch(
  items: EquipmentQrPdfItem[],
  filename?: string,
): Promise<void> {
  if (items.length === 0) {
    throw new Error('Nenhum equipamento para gerar PDF.');
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  for (let i = 0; i < items.length; i++) {
    await drawEquipmentQrPage(doc, items[i], i);
  }

  const defaultName =
    items.length === 1
      ? `QR-${safePdfFilename(items[0].ativoPlaca)}.pdf`
      : `QR-equipamentos-${items.length}-${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(filename ?? defaultName);
}

/** ZIP: Obra / Empresa / {ativo}.pdf */
export async function downloadEquipmentQrPdfZip(items: EquipmentQrPdfItem[]): Promise<void> {
  if (items.length === 0) {
    throw new Error('Nenhum equipamento para gerar PDF.');
  }

  const zip = new JSZip();
  const usedPaths = new Set<string>();

  for (const item of items) {
    const pdfBlob = await buildEquipmentQrPdfBlob(item);
    const obraFolder = resolveObraFolder(item);
    const companyFolder = resolveCompanyFolder(item);
    const ativoFile = safePdfFilename(item.ativoPlaca);

    let zipPath = `${obraFolder}/${companyFolder}/${ativoFile}.pdf`;
    let suffix = 2;
    while (usedPaths.has(zipPath)) {
      zipPath = `${obraFolder}/${companyFolder}/${ativoFile}_${suffix}.pdf`;
      suffix += 1;
    }
    usedPaths.add(zipPath);
    zip.file(zipPath, pdfBlob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipName = `QR-equipamentos-${items.length}-${new Date().toISOString().slice(0, 10)}.zip`;
  triggerBlobDownload(zipBlob, zipName);
}
