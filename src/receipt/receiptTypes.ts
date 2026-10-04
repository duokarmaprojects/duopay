export interface ReceiptItem {
  id: string;
  name: string;
  amountPaise: number;
}

export interface ConfidenceField<T> {
  value: T | null;
  confidence: number; // 0.0-1.0
  source: 'OCR' | 'CALCULATED' | 'USER';
}

export interface ExtractedLineItem {
  id: string;
  name: ConfidenceField<string>;
  quantity: ConfidenceField<number>;
  unitPricePaise: ConfidenceField<number>;
  lineTotalPaise: ConfidenceField<number>;
  categorySuggestion: string | null;
}

export interface ExtractedReceiptV2 {
  merchant: ConfidenceField<string>;
  transactionDate: ConfidenceField<string>;
  subtotalPaise: ConfidenceField<number>;
  taxPaise: ConfidenceField<number>;
  discountPaise: ConfidenceField<number>;
  tipPaise: ConfidenceField<number>;
  totalPaise: ConfidenceField<number>;
  lineItems: ExtractedLineItem[];
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  reconciliationWarning: string | null; // non-null if sum(items)+tax-discount != total
  currency: string;
  fingerprint: string | null;
  items?: ReceiptItem[];
}

export type ExtractedReceipt = ExtractedReceiptV2;

export interface ReceiptExtractor {
  extract(file: File, mode?: 'scan' | 'screenshot'): Promise<ExtractedReceipt>;
}
