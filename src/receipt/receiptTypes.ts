export interface ReceiptItem {
  id: string;
  name: string;
  amountPaise: number;
}

export interface ExtractedReceipt {
  merchant: string | null;
  date: string | null;
  totalPaise: number | null;
  taxPaise: number | null;
  discountPaise: number | null;
  items: ReceiptItem[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface ReceiptExtractor {
  extract(file: File, mode?: 'scan' | 'screenshot'): Promise<ExtractedReceipt>;
}
