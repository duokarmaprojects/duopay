import { ExtractedReceipt, ExtractedReceiptV2, ReceiptExtractor } from "./receiptTypes";
import { inrToPaise } from "@/domain/money";
import { reconcileReceipt } from "@/domain/receipt";

export async function generateFingerprint(file: File | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer;
  if (file instanceof ArrayBuffer) {
    buffer = file;
  } else if (file && typeof file.arrayBuffer === 'function') {
    buffer = await file.arrayBuffer();
  } else {
    return "0000000000000000";
  }

  // Sample up to first 64KB for speed and deterministic fingerprinting
  const slice = buffer.slice(0, 64 * 1024);
  const hashBuffer = await crypto.subtle.digest("SHA-256", slice);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class MockReceiptExtractor implements ReceiptExtractor {
  async extract(file: File, mode?: 'scan' | 'screenshot'): Promise<ExtractedReceipt> {
    const today = new Date().toISOString().split('T')[0];
    const fingerprint = file ? await generateFingerprint(file).catch(() => null) : null;

    if (mode === 'screenshot') {
      const total = inrToPaise(1245);
      const receipt: ExtractedReceiptV2 = {
        merchant: { value: "Swiggy UPI", confidence: 0.95, source: 'OCR' },
        transactionDate: { value: today, confidence: 0.9, source: 'OCR' },
        subtotalPaise: { value: total, confidence: 0.9, source: 'OCR' },
        taxPaise: { value: 0, confidence: 1.0, source: 'CALCULATED' },
        discountPaise: { value: 0, confidence: 1.0, source: 'CALCULATED' },
        tipPaise: { value: 0, confidence: 1.0, source: 'CALCULATED' },
        totalPaise: { value: total, confidence: 0.98, source: 'OCR' },
        lineItems: [
          {
            id: crypto.randomUUID(),
            name: { value: "Swiggy Order", confidence: 0.9, source: 'OCR' },
            quantity: { value: 1, confidence: 1.0, source: 'CALCULATED' },
            unitPricePaise: { value: total, confidence: 0.9, source: 'OCR' },
            lineTotalPaise: { value: total, confidence: 0.95, source: 'CALCULATED' },
            categorySuggestion: "Food"
          }
        ],
        overallConfidence: "HIGH",
        reconciliationWarning: null,
        currency: "INR",
        fingerprint,
        items: [
          { id: crypto.randomUUID(), name: "Swiggy Order", amountPaise: total }
        ]
      };
      return receipt;
    }

    // Default physical receipt scenario (Domino's Pizza)
    const items = [
      { id: crypto.randomUUID(), name: "Margherita Pizza", price: inrToPaise(800), cat: "Food" },
      { id: crypto.randomUUID(), name: "Pasta Italiano", price: inrToPaise(900), cat: "Food" },
      { id: crypto.randomUUID(), name: "Coke (2L)", price: inrToPaise(400), cat: "Drinks" },
      { id: crypto.randomUUID(), name: "Choco Lava Cake", price: inrToPaise(740), cat: "Food" }
    ];

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const tax = inrToPaise(340);
    const total = subtotal + tax; // 2840 + 340 = 3180 paise

    const receipt: ExtractedReceiptV2 = {
      merchant: { value: "Domino's Pizza", confidence: 0.85, source: 'OCR' },
      transactionDate: { value: today, confidence: 0.8, source: 'OCR' },
      subtotalPaise: { value: subtotal, confidence: 0.85, source: 'OCR' },
      taxPaise: { value: tax, confidence: 0.8, source: 'OCR' },
      discountPaise: { value: 0, confidence: 1.0, source: 'CALCULATED' },
      tipPaise: { value: 0, confidence: 1.0, source: 'CALCULATED' },
      totalPaise: { value: total, confidence: 0.85, source: 'OCR' },
      lineItems: items.map(item => ({
        id: item.id,
        name: { value: item.name, confidence: 0.85, source: 'OCR' },
        quantity: { value: 1, confidence: 1.0, source: 'CALCULATED' },
        unitPricePaise: { value: item.price, confidence: 0.85, source: 'OCR' },
        lineTotalPaise: { value: item.price, confidence: 0.85, source: 'CALCULATED' },
        categorySuggestion: item.cat
      })),
      overallConfidence: "MEDIUM",
      reconciliationWarning: null,
      currency: "INR",
      fingerprint,
      items: items.map(item => ({ id: item.id, name: item.name, amountPaise: item.price }))
    };

    const reconciliation = reconcileReceipt(receipt);
    receipt.reconciliationWarning = reconciliation.warning;

    return receipt;
  }
}

export const getReceiptExtractor = (): ReceiptExtractor => {
  return new MockReceiptExtractor();
};
