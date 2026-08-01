import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

export async function generateTicketPdf(data: {
  eventName: string;
  date: string;
  guestName: string;
  guestCount: number;
  tableName: string;
  qrCodeText: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]); // Ticket size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
  page.drawText(data.eventName, {
    x: 50,
    y: height - 150,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Datum: ${data.date}`, {
    x: 50,
    y: height - 180,
    size: 14,
    font,
  });

  page.drawText(`Gast: ${data.guestName}`, {
    x: 50,
    y: height - 210,
    size: 14,
    font,
  });

  page.drawText(`Personen: ${data.guestCount}`, {
    x: 50,
    y: height - 240,
    size: 14,
    font,
  });

  page.drawText(`Tisch: ${data.tableName}`, {
    x: 50,
    y: height - 270,
    size: 14,
    font: fontBold,
  });

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
  page.drawText(data.qrCodeText, {
    x: width - 190,
    y: height - 270,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
