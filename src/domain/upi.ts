import { Paise, paiseToInr } from "./money"

export function generateUpiIntent(
  upiId: string,
  name: string,
  amountPaise: Paise,
  note?: string
): string {
  const amount = paiseToInr(amountPaise).toFixed(2)
  const encodedUpiId = encodeURIComponent(upiId)
  const encodedName = encodeURIComponent(name)
  const encodedNote = note ? encodeURIComponent(note) : encodeURIComponent('DuoPay Settlement')
  
  return `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}`
}
