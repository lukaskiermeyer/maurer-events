import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { robotoBase64 } from './robotoBase64';

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
    
    const font = await pdfDoc.embedFont(cachedFontBytes);
    const fontBold = font; // Using regular as fallback for bold to ensure all characters are supported

    // Keep the entire details column separate from the QR, including long names.
    const titleLines = wrapText(data.eventName, font, 20, 320);
    const details = [
      `Datum: ${data.date}`,
      `Gast: ${data.guestName}`,
      `Personen: ${data.guestCount}`,
      `Tisch: ${data.tableName}`,
    ].map(text => wrapText(text, font, 14, 320));
    const extraHeight = (titleLines.length - 1) * 24 + details.reduce((sum, lines) => sum + (lines.length - 1) * 18, 0);
    const page = pdfDoc.addPage([600, 400 + extraHeight]);
    const { width, height } = page.getSize();

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.95, 0.95, 0.95),
  });

  // Header
  page.drawText('MAURER EVENTS', {
    x: 50,
    y: height - 60,
    size: 24,
    font: fontBold,
    color: rgb(0, 0.5, 0.2), // Accent green roughly
  });

  page.drawText('OFFIZIELLES TICKET', {
    x: 50,
    y: height - 85,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Details
  let detailY = height - 150;
  for (const line of titleLines) {
    page.drawText(line, { x: 50, y: detailY, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    detailY -= 24;
  }
  detailY -= 6;
  for (const lines of details) {
    for (const line of lines) {
      page.drawText(line, { x: 50, y: detailY, size: 14, font });
      detailY -= 18;
    }
    detailY -= 12;
  }

  // QR Code
  const qrCodeDataUrl = await QRCode.toDataURL(data.qrCodeText, { margin: 1 });
  const qrCodeImage = await pdfDoc.embedPng(qrCodeDataUrl);
  
  page.drawImage(qrCodeImage, {
    x: width - 200,
    y: height - 250,
    width: 150,
    height: 150,
  });

  // Footer
  const codeSize = Math.min(8, 150 / font.widthOfTextAtSize(data.qrCodeText, 1));
  for (const [index, line] of wrapText(data.qrCodeText, font, codeSize, 150).entries()) {
    page.drawText(line, {
      x: width - 200,
      y: height - 270 - index * 12,
      size: codeSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("PDF Generation failed:", error);
    // Mark as failed for retry logic if used by webhook later
    return null;
  }
}
