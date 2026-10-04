import { ExtractedReceiptV2 } from "../receipt/receiptTypes";

export interface ReconcileResult {
  isBalanced: boolean;
  computedTotal: number;
  delta: number;
  warning: string | null;
}

export function reconcileReceipt(receipt: ExtractedReceiptV2): ReconcileResult {
  let computedTotal = 0;

  for (const item of receipt.lineItems) {
    if (item.lineTotalPaise.value !== null) {
      computedTotal += Math.round(item.lineTotalPaise.value);
    }
  }

  if (receipt.taxPaise.value !== null) {
    computedTotal += Math.round(receipt.taxPaise.value);
  }

  if (receipt.tipPaise.value !== null) {
    computedTotal += Math.round(receipt.tipPaise.value);
  }

  if (receipt.discountPaise.value !== null) {
    computedTotal -= Math.round(receipt.discountPaise.value);
  }

  const statedTotal = receipt.totalPaise.value !== null ? Math.round(receipt.totalPaise.value) : 0;
  const delta = statedTotal - computedTotal;
  const absDelta = Math.abs(delta);

  const isBalanced = absDelta <= 2;

  let warning: string | null = null;
  if (!isBalanced) {
    const statedRupees = (statedTotal / 100).toFixed(2);
    const computedRupees = (computedTotal / 100).toFixed(2);
    const deltaRupees = (absDelta / 100).toFixed(2);
    warning = `Receipt total ₹${statedRupees} does not match computed sum ₹${computedRupees} (delta: ₹${deltaRupees})`;
  }

  return {
    isBalanced,
    computedTotal,
    delta,
    warning
  };
}

/**
 * Validates magic bytes of an uploaded image buffer.
 */
export function validateImageMagicBytes(buffer: ArrayBuffer | Uint8Array, mimeType: string): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes.length < 12) return false

  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }

  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  }

  if (mimeType === "image/webp") {
    const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    return isRiff && isWebp
  }

  return false
}

