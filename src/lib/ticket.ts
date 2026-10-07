import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { robotoBase64 } from './robotoBase64';
import logo from './ticket-logo.json';

let cachedFontBytes: Uint8Array | null = null;

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) <= maxWidth) {
      line = line ? `${line} ${word}` : word;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    // Split even a single long word, without discarding any characters.
    for (const character of word) {
      if (line && font.widthOfTextAtSize(line + character, size) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function generateTicketPdf(data: {
  eventName: string;
  date: string;
  guestName: string;
  guestCount: number;
  tableName: string;
  qrCodeText: string;
  location?: string;
  time?: string | null;
}) {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    if (!cachedFontBytes) {
      const binaryString = atob(robotoBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      cachedFontBytes = bytes;
    }
    
    const font = await pdfDoc.embedFont(cachedFontBytes, { subset: true });
    const fontBold = font; // Using regular as fallback for bold to ensure all characters are supported

    // Keep the entire details column separate from the QR, including long names.
    const titleLines = wrapText(data.eventName, font, 24, 300);
    const details = [
      { label: 'DATUM & UHRZEIT', value: `${data.date}${data.time ? ` · ${data.time} Uhr` : ''}` },
      { label: 'RESERVIERT FÜR', value: data.guestName },
      { label: 'PERSONEN', value: `${data.guestCount} ${data.guestCount === 1 ? 'Person' : 'Personen'}` },
      { label: 'TISCH', value: data.tableName },
      ...(data.location ? [{ label: 'ORT', value: data.location }] : []),
    ].map(detail => ({ ...detail, lines: wrapText(detail.value, font, 14, 300) }));
    const contentHeight = titleLines.length * 28 + 20 + details.reduce((sum, detail) => sum + 31 + detail.lines.length * 18, 0);
    const page = pdfDoc.addPage([600, Math.max(490, 150 + contentHeight + 62)]);
    const { width, height } = page.getSize();

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.992, 0.984, 0.969),
  });

  const green = rgb(31 / 255, 87 / 255, 50 / 255);
  const gold = rgb(203 / 255, 121 / 255, 19 / 255);
  const muted = rgb(0.38, 0.42, 0.38);
  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: green });
  page.drawRectangle({ x: 24, y: 48, width: 552, height: height - 180, color: rgb(1, 1, 1) });
  for (const shape of logo.paths) {
    const rawHex = shape.color.slice(1);
    const hex = rawHex.length === 3 ? [...rawHex].map(character => character + character).join('') : rawHex;
    page.drawSvgPath(shape.path, { x: 32, y: height - 26, scale: 0.43,
      color: rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255) });
  }

  // Header
  page.drawText('MAURER EVENTS', {
    x: 152,
    y: height - 63,
    size: 25,
    font: fontBold,
    color: green,
  });

  page.drawText('Bayerische Gastfreundschaft. Gemeinsam feiern.', {
    x: 152,
    y: height - 85,
    size: 12,
    font,
    color: muted,
  });
  page.drawText('DEIN TICKET', { x: 36, y: height - 143, size: 10, font, color: gold });

  // Details
  let detailY = height - 179;
  for (const line of titleLines) {
    page.drawText(line, { x: 36, y: detailY, size: 24, font: fontBold, color: green });
    detailY -= 28;
  }
  detailY -= 14;
  for (const detail of details) {
    page.drawText(detail.label, { x: 36, y: detailY, size: 9, font, color: muted });
    detailY -= 20;
    for (const line of detail.lines) {
      page.drawText(line, { x: 36, y: detailY, size: 14, font, color: rgb(0.08, 0.1, 0.08) });
      detailY -= 18;
    }
    detailY -= 13;
  }

  // QR Code
  page.drawLine({ start: { x: 356, y: height - 154 }, end: { x: 356, y: 68 }, thickness: 1, color: rgb(0.88, 0.87, 0.84), dashArray: [3, 4] });
  page.drawText('BEIM EINLASS VORZEIGEN', { x: 386, y: height - 156, size: 9, font, color: green });
  const qrCodeDataUrl = await QRCode.toDataURL(data.qrCodeText, { margin: 4, scale: 8 });
  const qrCodeImage = await pdfDoc.embedPng(qrCodeDataUrl);
  
  page.drawImage(qrCodeImage, {
    x: 374,
    y: height - 360,
    width: 188,
    height: 188,
  });

  // Footer
  page.drawText('Ein Ticket für deine gesamte Buchung.', { x: 379, y: height - 382, size: 10, font, color: muted });
  page.drawText('QR-Code vollständig sichtbar halten.', { x: 385, y: height - 398, size: 10, font, color: muted });
  const codeSize = Math.min(7, 180 / font.widthOfTextAtSize(data.qrCodeText, 1));
  for (const [index, line] of wrapText(data.qrCodeText, font, codeSize, 180).entries()) {
    page.drawText(line, {
      x: 378,
      y: height - 420 - index * 10,
      size: codeSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
  page.drawText('Wir freuen uns auf dich!', { x: 36, y: 26, size: 11, font, color: green });
  page.drawText('MAURER EVENTS', { x: 478, y: 26, size: 9, font, color: muted });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("PDF Generation failed:", error);
    // Mark as failed for retry logic if used by webhook later
    return null;
  }
}
