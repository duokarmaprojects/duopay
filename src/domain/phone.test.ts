import { describe, it, expect } from "vitest";
import { normalizePhoneNumber, formatPhoneForDisplay } from "./phone";

describe("Phone Normalization", () => {
  it("normalizes standard 10-digit Indian numbers", () => {
    expect(normalizePhoneNumber("9876543210")).toBe("+919876543210");
    expect(normalizePhoneNumber("7000123456")).toBe("+917000123456");
  });

  it("normalizes numbers with leading 0", () => {
    expect(normalizePhoneNumber("09876543210")).toBe("+919876543210");
  });

  it("normalizes numbers with +91 country code and whitespace/dashes", () => {
    expect(normalizePhoneNumber("+91 9876543210")).toBe("+919876543210");
    expect(normalizePhoneNumber("+91-98765-43210")).toBe("+919876543210");
    expect(normalizePhoneNumber("+91 (98765) 43210")).toBe("+919876543210");
    expect(normalizePhoneNumber("+919876543210")).toBe("+919876543210");
  });

  it("normalizes numbers with 91 prefix without plus", () => {
    expect(normalizePhoneNumber("919876543210")).toBe("+919876543210");
  });

  it("normalizes international numbers with 00 prefix", () => {
    expect(normalizePhoneNumber("00919876543210")).toBe("+919876543210");
    expect(normalizePhoneNumber("0014155552671")).toBe("+14155552671");
  });

  it("rejects invalid, empty, or partial numbers", () => {
    expect(normalizePhoneNumber("")).toBeNull();
    expect(normalizePhoneNumber("123")).toBeNull();
    expect(normalizePhoneNumber("abc")).toBeNull();
    expect(normalizePhoneNumber("98765")).toBeNull();
  });

  it("formats numbers nicely for display", () => {
    expect(formatPhoneForDisplay("9876543210")).toBe("+91 98765 43210");
    expect(formatPhoneForDisplay("+919876543210")).toBe("+91 98765 43210");
  });
});
