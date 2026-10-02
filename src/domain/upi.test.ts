import { describe, it, expect } from "vitest"
import { normalizeUpiId, validateUpiFormat, generateUpiIntent, validateAndGenerateUpiIntent } from "./upi"

describe("UPI Format Validation & Normalization", () => {
  describe("normalizeUpiId", () => {
    it("should normalize valid uppercase and mixed-case UPI IDs to lowercase", () => {
      expect(normalizeUpiId("MOIZ@OKSBI")).toBe("moiz@oksbi")
      expect(normalizeUpiId("  Rahul.Sharma@Paytm  ")).toBe("rahul.sharma@paytm")
      expect(normalizeUpiId("9876543210@YBL")).toBe("9876543210@ybl")
    })

    it("should reject input containing whitespace inside", () => {
      expect(normalizeUpiId("moiz @oksbi")).toBeNull()
      expect(normalizeUpiId("moiz@ oksbi")).toBeNull()
      expect(normalizeUpiId("mo iz@oksbi")).toBeNull()
    })

    it("should reject non-string or empty inputs", () => {
      expect(normalizeUpiId("")).toBeNull()
      expect(normalizeUpiId("   ")).toBeNull()
      expect(normalizeUpiId(null)).toBeNull()
      expect(normalizeUpiId(undefined)).toBeNull()
      expect(normalizeUpiId(12345)).toBeNull()
    })
  })

  describe("validateUpiFormat", () => {
    it("should accept valid standard UPI IDs", () => {
      const validCases = [
        "moiz@oksbi",
        "rahul.kumar@okhdfcbank",
        "john_doe@paytm",
        "alice-99@ybl",
        "9876543210@axl",
        "merchant.store@icici",
        "first.middle.last@axisbank",
      ]

      for (const vpa of validCases) {
        const result = validateUpiFormat(vpa)
        expect(result.valid, `Expected "${vpa}" to be valid`).toBe(true)
        expect(result.normalized).toBe(vpa.toLowerCase())
      }
    })

    it("should reject VPAs missing '@'", () => {
      const result = validateUpiFormat("moizoksbi")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("must contain an '@' symbol")
    })

    it("should reject VPAs with multiple '@' symbols", () => {
      const result1 = validateUpiFormat("moiz@@oksbi")
      expect(result1.valid).toBe(false)
      expect(result1.error).toContain("multiple '@' symbols")

      const result2 = validateUpiFormat("moiz@bank@psp")
      expect(result2.valid).toBe(false)
      expect(result2.error).toContain("multiple '@' symbols")
    })

    it("should reject VPAs with spaces", () => {
      const result = validateUpiFormat("moiz @oksbi")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("spaces")
    })

    it("should reject empty or missing username", () => {
      const result = validateUpiFormat("@oksbi")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("missing the username")
    })

    it("should reject single character username", () => {
      const result = validateUpiFormat("m@oksbi")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("at least 2 characters")
    })

    it("should reject username starting or ending with special characters", () => {
      expect(validateUpiFormat(".moiz@oksbi").valid).toBe(false)
      expect(validateUpiFormat("moiz.@oksbi").valid).toBe(false)
      expect(validateUpiFormat("-moiz@oksbi").valid).toBe(false)
      expect(validateUpiFormat("moiz-@oksbi").valid).toBe(false)
      expect(validateUpiFormat("_moiz@oksbi").valid).toBe(false)
      expect(validateUpiFormat("moiz_@oksbi").valid).toBe(false)
    })

    it("should reject username with consecutive dots", () => {
      const result = validateUpiFormat("mo..iz@oksbi")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("consecutive dots")
    })

    it("should reject invalid characters in username", () => {
      expect(validateUpiFormat("moiz$@oksbi").valid).toBe(false)
      expect(validateUpiFormat("moiz%dheela@oksbi").valid).toBe(false)
      expect(validateUpiFormat("moiz!@oksbi").valid).toBe(false)
      expect(validateUpiFormat("moiz?@oksbi").valid).toBe(false)
      expect(validateUpiFormat("moiz/admin@oksbi").valid).toBe(false)
    })

    it("should reject empty or missing handle", () => {
      const result = validateUpiFormat("moiz@")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("missing the bank handle")
    })

    it("should reject single character handle", () => {
      const result = validateUpiFormat("moiz@s")
      expect(result.valid).toBe(false)
      expect(result.error).toContain("at least 2 characters")
    })

    it("should reject excessively long inputs", () => {
      const longUsername = "a".repeat(65)
      expect(validateUpiFormat(`${longUsername}@oksbi`).valid).toBe(false)

      const totalLong = "a".repeat(50) + "@" + "b".repeat(30)
      expect(validateUpiFormat(totalLong).valid).toBe(false)
    })
  })

  describe("validateAndGenerateUpiIntent & generateUpiIntent", () => {
    it("1. Valid UPI ID + valid amount generates clean NPCI URI with literal @ and %20 spaces", () => {
      const uri = generateUpiIntent("8758457909@upi", "Hatim Suttar", 5000, "Dinner split")
      expect(uri).toBe("upi://pay?pa=8758457909@upi&pn=Hatim%20Suttar&am=50.00&cu=INR&tn=Dinner%20split")
      // Crucial: Must NOT contain %40 in pa!
      expect(uri).not.toContain("8758457909%40upi")
      expect(uri).toContain("pa=8758457909@upi")
      // Crucial: Must NOT contain '+' for spaces
      expect(uri).not.toContain("+")
    })

    it("2. Invalid UPI ID is rejected", () => {
      expect(() => generateUpiIntent("invalid-vpa", "Rahul", 1000)).toThrow(/Invalid recipient UPI ID|must contain an '@'/)
    })

    it("3. Zero amount is rejected", () => {
      expect(() => generateUpiIntent("rahul@okaxis", "Rahul", 0)).toThrow(/positive integer in paise/)
    })

    it("4. Negative amount is rejected", () => {
      expect(() => generateUpiIntent("rahul@okaxis", "Rahul", -5000)).toThrow(/positive integer in paise/)
    })

    it("5. Decimal amount is formatted to exact 2 decimal places (no floating-point garbage)", () => {
      const uri = generateUpiIntent("rahul@okaxis", "Rahul", 9950)
      expect(uri).toContain("&am=99.50&")

      const uri2 = generateUpiIntent("rahul@okaxis", "Rahul", 10000)
      expect(uri2).toContain("&am=100.00&")
    })

    it("6. Special characters in recipient name are sanitized safely", () => {
      const uri = generateUpiIntent("rahul@okaxis", "Rahul & Co. 🎉", 5000)
      // Emojis stripped, '&' converted/sanitized, spaces encoded as %20
      expect(uri).not.toContain("🎉")
      expect(uri).toContain("pn=Rahul%20Co.")
      expect(uri).not.toContain("+")
    })

    it("7. Special characters in transaction note are sanitized safely", () => {
      const uri = generateUpiIntent("rahul@okaxis", "Rahul", 5000, "Dinner & Drinks 🎉")
      expect(uri).not.toContain("🎉")
      expect(uri).toContain("tn=Dinner%20Drinks")
    })

    it("8. Missing recipient is rejected", () => {
      expect(() => generateUpiIntent("", "Rahul", 5000)).toThrow()
    })

    it("9. Missing/NaN amount is rejected", () => {
      expect(() => generateUpiIntent("rahul@okaxis", "Rahul", NaN as any)).toThrow()
    })

    it("10. Correct URI encoding: standard parameters only, no unsupported tr, tid, mc", () => {
      const uri = generateUpiIntent("moiz@oksbi", "Moiz Dheela", 10050)
      expect(uri.startsWith("upi://pay?")).toBe(true)
      expect(uri).not.toContain("tr=")
      expect(uri).not.toContain("tid=")
      expect(uri).not.toContain("mc=")
      expect(uri).toContain("&cu=INR&")
    })
  })
})

