import { ExtractedReceipt, ReceiptExtractor } from "./receiptTypes";
import { inrToPaise } from "@/domain/money";

export class MockReceiptExtractor implements ReceiptExtractor {
  async extract(file: File, mode?: 'scan' | 'screenshot'): Promise<ExtractedReceipt> {
    // Simulate network delay and processing
    await new Promise(resolve => setTimeout(resolve, 2500));

    if (mode === 'screenshot') {
      return {
        merchant: "Swiggy UPI",
        date: new Date().toISOString().split('T')[0],
        totalPaise: inrToPaise(1245),
        taxPaise: null,
        discountPaise: null,
        items: [
          { id: crypto.randomUUID(), name: "Swiggy Order", amountPaise: inrToPaise(1245) },
        ],
        confidence: "HIGH" // UPI screenshots are usually clear
      };
    }

    // Return a realistic mock receipt
    return {
      merchant: "Domino's Pizza",
      date: new Date().toISOString().split('T')[0],
      totalPaise: inrToPaise(2840),
      taxPaise: inrToPaise(340),
      discountPaise: null,
      items: [
        { id: crypto.randomUUID(), name: "Margherita Pizza", amountPaise: inrToPaise(800) },
        { id: crypto.randomUUID(), name: "Pasta Italiano", amountPaise: inrToPaise(900) },
        { id: crypto.randomUUID(), name: "Coke (2L)", amountPaise: inrToPaise(400) },
        { id: crypto.randomUUID(), name: "Choco Lava Cake", amountPaise: inrToPaise(740) },
      ],
      confidence: "MEDIUM" // "MEDIUM" forces the UI to show uncertainty warnings
    };
  }
}

// In a real app, you would check env vars and instantiate GoogleVisionExtractor or similar.
export const getReceiptExtractor = (): ReceiptExtractor => {
  return new MockReceiptExtractor();
};
