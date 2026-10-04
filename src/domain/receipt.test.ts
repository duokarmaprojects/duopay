import { describe, it, expect } from "vitest";
import { reconcileReceipt } from "./receipt";
import { ExtractedReceiptV2 } from "../receipt/receiptTypes";

function createMockReceipt(
  total: number | null,
  items: number[],
  tax: number | null = null,
  discount: number | null = null,
  tip: number | null = null
): ExtractedReceiptV2 {
  return {
    merchant: { value: "Test", confidence: 1, source: "OCR" },
    transactionDate: { value: "2023-10-10", confidence: 1, source: "OCR" },
    subtotalPaise: { value: null, confidence: 0, source: "OCR" },
    taxPaise: { value: tax, confidence: 1, source: "OCR" },
    discountPaise: { value: discount, confidence: 1, source: "OCR" },
    tipPaise: { value: tip, confidence: 1, source: "OCR" },
    totalPaise: { value: total, confidence: 1, source: "OCR" },
    lineItems: items.map((amount, idx) => ({
      id: `item-${idx}`,
      name: { value: `Item ${idx}`, confidence: 1, source: "OCR" },
      quantity: { value: 1, confidence: 1, source: "OCR" },
      unitPricePaise: { value: amount, confidence: 1, source: "OCR" },
      lineTotalPaise: { value: amount, confidence: 1, source: "OCR" },
      categorySuggestion: null,
    })),
    overallConfidence: "HIGH",
    reconciliationWarning: null,
    currency: "INR",
    fingerprint: null,
  };
}

describe("reconcileReceipt", () => {
  it("returns balanced for a perfectly matching receipt", () => {
    const receipt = createMockReceipt(1000, [400, 600]);
    const result = reconcileReceipt(receipt);
    expect(result.isBalanced).toBe(true);
    expect(result.computedTotal).toBe(1000);
    expect(result.delta).toBe(0);
    expect(result.warning).toBeNull();
  });

  it("returns balanced for a receipt with rounding (delta <= 2)", () => {
    const receipt = createMockReceipt(1001, [400, 600]);
    const result = reconcileReceipt(receipt);
    expect(result.isBalanced).toBe(true);
    expect(result.computedTotal).toBe(1000);
    expect(result.delta).toBe(1);
    expect(result.warning).toBeNull();
  });

  it("returns unbalanced for a receipt with delta > 2", () => {
    const receipt = createMockReceipt(1100, [400, 600]);
    const result = reconcileReceipt(receipt);
    expect(result.isBalanced).toBe(false);
    expect(result.computedTotal).toBe(1000);
    expect(result.delta).toBe(100);
    expect(result.warning).toBe("Receipt total ₹11.00 does not match computed sum ₹10.00 (delta: ₹1.00)");
  });

  it("handles receipt with no line items", () => {
    const receipt = createMockReceipt(100, [], 100);
    const result = reconcileReceipt(receipt);
    expect(result.isBalanced).toBe(true);
    expect(result.computedTotal).toBe(100);
  });

  it("handles receipt with discount and tax", () => {
    // Items: 500 + 500 = 1000. Tax = 100. Discount = 200. Tip = 50.
    // Total = 1000 + 100 + 50 - 200 = 950.
    const receipt = createMockReceipt(950, [500, 500], 100, 200, 50);
    const result = reconcileReceipt(receipt);
    expect(result.isBalanced).toBe(true);
    expect(result.computedTotal).toBe(950);
    expect(result.delta).toBe(0);
  });
});
