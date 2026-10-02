import { ExtractedReceipt, ReceiptExtractor } from "./receiptTypes";
import { inrToPaise } from "@/domain/money";

export class MockReceiptExtractor implements ReceiptExtractor {
  async extract(file: File): Promise<ExtractedReceipt> {
    // Simulate network delay and processing
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Return a realistic mock receipt (Domino's example from the prompt)
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
        { id: crypto.randomUUID(), name: "Choco Lava Cake", amountPaise: inrToPaise(740) }, // 800+900+400+740 = 2840
      ],
      confidence: "MEDIUM" // "MEDIUM" forces the UI to show uncertainty warnings
    };
  }
}

// In a real app, you would check env vars and instantiate GoogleVisionExtractor or similar.
export const getReceiptExtractor = (): ReceiptExtractor => {
  return new MockReceiptExtractor();
};
