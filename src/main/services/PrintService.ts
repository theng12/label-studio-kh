// Direct OS printing. Renders labels into a hidden BrowserWindow and uses
// Electron's webContents.print() — which routes through whatever printer
// macOS/Windows knows about, including thermal/roll label printers (Zebra,
// Dymo, Brother, Xprinter, …) that have an installed driver. No ZPL/EPL
// needed for v1: the OS driver handles the device language.
//
// Why a BrowserWindow instead of the existing Puppeteer pipeline: only an
// Electron webContents can talk to the OS print subsystem + enumerate
// installed printers. Puppeteer's headless Chromium can't print to a
// physical device. The HTML we load is the SAME markup the export path
// renders (renderLabelsForPrint reuses renderElement), so printed output
// matches PDF/PNG export pixel-for-pixel.

import { BrowserWindow } from 'electron';
import { renderLabelsForPrint, renderSheet } from './StickerRenderer';
import type { Template } from '@shared/types/template';
import type { Brand } from '@shared/types/brand';
import type { SheetLayout } from '@shared/sheetLayout';

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  status: number;
}

export interface PrintLabelsInput {
  template: Template;
  brand: Brand | null;
  rows: Record<string, string>[];
  /** OS printer device name (PrinterInfo.name). Required when silent. */
  deviceName?: string;
  /** Copies of the whole set. Clamped 1–999. */
  copies?: number;
  /** When true, print straight to `deviceName` with no OS dialog ("press
   *  print"). When false, show the native print dialog and let the user
   *  pick / confirm. */
  silent?: boolean;
  /** When provided, tile labels N-up onto A4/Letter sheets (office sheet
   *  printers). When omitted, one label per page (thermal/roll printers). */
  sheet?: SheetLayout | null;
}

export interface PrintResult {
  printed: number; // label count sent (before copies)
  copies: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Enumerate installed printers. Needs a transient webContents — Electron
 *  exposes getPrintersAsync only on a BrowserWindow's webContents. */
export async function listPrinters(): Promise<PrinterInfo[]> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false },
  });
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || '',
      isDefault: p.isDefault,
      status: p.status,
    }));
  } finally {
    win.destroy();
  }
}

/** Render the labels and print them. Resolves when the job is handed to
 *  the OS spooler (or the user confirms the dialog); rejects on failure
 *  or user cancel. */
export async function printLabels(input: PrintLabelsInput): Promise<PrintResult> {
  const { template, brand, rows } = input;
  if (rows.length === 0) {
    throw new Error('Nothing to print — no rows selected.');
  }
  const copies = Math.min(Math.max(1, Math.round(input.copies ?? 1)), 999);

  // Sheet (N-up) vs one-per-page. Sheet mode returns the resolved page
  // dimensions so we set the physical page to the full sheet, not the label.
  let doc: string;
  let pageWmm: number;
  let pageHmm: number;
  if (input.sheet) {
    const sheet = await renderSheet(template, brand, rows, input.sheet);
    doc = sheet.html;
    pageWmm = sheet.pageWmm;
    pageHmm = sheet.pageHmm;
  } else {
    doc = await renderLabelsForPrint(template, brand, rows);
    pageWmm = template.width_mm;
    pageHmm = template.height_mm;
  }

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false },
  });

  try {
    await win.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(doc),
    );
    // Give fonts + barcodes/QR (inline SVG/data-URIs) a beat to settle so
    // the first page isn't captured mid-layout. networkidle isn't available
    // on a data: URL, so a short fixed wait is the pragmatic choice.
    await delay(450);

    // Page size in MICRONS (Electron's unit). 1mm = 1000 microns.
    const pageWidth = Math.round(pageWmm * 1000);
    const pageHeight = Math.round(pageHmm * 1000);

    return await new Promise<PrintResult>((resolve, reject) => {
      win.webContents.print(
        {
          silent: !!input.silent,
          // deviceName only meaningful when silent; harmless otherwise.
          deviceName: input.silent ? input.deviceName : undefined,
          copies,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: { width: pageWidth, height: pageHeight },
        },
        (success, failureReason) => {
          // print() callback fires once the job is spooled or cancelled.
          if (success) {
            resolve({ printed: rows.length, copies });
          } else {
            // failureReason === 'cancelled' when the user dismisses the
            // dialog — surface a friendly message, not a scary error.
            reject(
              new Error(
                failureReason === 'cancelled'
                  ? 'Print cancelled.'
                  : `Print failed: ${failureReason || 'unknown error'}`,
              ),
            );
          }
        },
      );
    });
  } finally {
    // Defer destroy slightly so the print job fully detaches from the
    // webContents before we tear it down (avoids rare spooler races).
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy();
    }, 1500);
  }
}
