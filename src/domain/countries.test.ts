import { describe, it, expect } from "vitest"
import {
  ALL_COUNTRIES,
  DEFAULT_COUNTRY,
  getCountryByIso,
  searchCountries,
  detectCountryFromPhone,
  formatPhoneWithCountry,
} from "./countries"

describe("Country Selector & Phone Parsing Utilities", () => {
  it("provides an authoritative dataset of all 245+ countries", () => {
    expect(ALL_COUNTRIES.length).toBeGreaterThan(240)
    expect(DEFAULT_COUNTRY.iso).toBe("IN")
    expect(DEFAULT_COUNTRY.callingCode).toBe("+91")
  })

  it("retrieves country by ISO code", () => {
    expect(getCountryByIso("IN").name).toBe("India")
    expect(getCountryByIso("in").callingCode).toBe("+91")
    expect(getCountryByIso("US").callingCode).toBe("+1")
    expect(getCountryByIso("GB").callingCode).toBe("+44")
    expect(getCountryByIso("AE").callingCode).toBe("+971")
    expect(getCountryByIso("AU").callingCode).toBe("+61")
    expect(getCountryByIso("UNKNOWN").iso).toBe("IN")
  })

  it("searches countries by name, dialing code, and ISO code", () => {
    // 1. Name query
    const indiaSearch = searchCountries("india")
    expect(indiaSearch.some((c) => c.iso === "IN")).toBe(true)

    // 2. Calling code with and without '+'
    const plus91 = searchCountries("+91")
    expect(plus91.some((c) => c.iso === "IN")).toBe(true)

    const raw971 = searchCountries("971")
    expect(raw971.some((c) => c.iso === "AE")).toBe(true)

    // 3. Multi-match query
    const unitedSearch = searchCountries("united")
    expect(unitedSearch.some((c) => c.iso === "US")).toBe(true)
    expect(unitedSearch.some((c) => c.iso === "GB")).toBe(true)
    expect(unitedSearch.some((c) => c.iso === "AE")).toBe(true)

    // 4. ISO code query
    const auSearch = searchCountries("au")
    expect(auSearch.some((c) => c.iso === "AU")).toBe(true)
  })

  it("automatically detects country and national number from pasted international numbers", () => {
    // India
    const inRes = detectCountryFromPhone("+91 98765 43210")
    expect(inRes?.country.iso).toBe("IN")
    expect(inRes?.nationalNumber).toBe("9876543210")

    // United States
    const usRes = detectCountryFromPhone("+1 (415) 555-1234")
    expect(usRes?.country.iso).toBe("US")
    expect(usRes?.nationalNumber).toBe("4155551234")

    // United Kingdom
    const gbRes = detectCountryFromPhone("+44 7700 900123")
    expect(gbRes?.country.iso).toBe("GB")
    expect(gbRes?.nationalNumber).toBe("7700900123")

    // UAE
    const aeRes = detectCountryFromPhone("+971 50 123 4567")
    expect(aeRes?.country.iso).toBe("AE")
    expect(aeRes?.nationalNumber).toBe("501234567")

    // Australia
    const auRes = detectCountryFromPhone("+61 412 345 678")
    expect(auRes?.country.iso).toBe("AU")
    expect(auRes?.nationalNumber).toBe("412345678")

    // Non-international input
    expect(detectCountryFromPhone("9876543210")).toBeNull()
  })

  it("formats numbers per country and produces valid E.164 strings", () => {
    const india = getCountryByIso("IN")
    const formattedIn = formatPhoneWithCountry(india, "9876543210")
    expect(formattedIn.display).toBe("98765 43210")
    expect(formattedIn.e164).toBe("+919876543210")
    expect(formattedIn.isPossible).toBe(true)

    const us = getCountryByIso("US")
    const formattedUs = formatPhoneWithCountry(us, "4155551234")
    expect(formattedUs.display).toBe("(415) 555-1234")
    expect(formattedUs.e164).toBe("+14155551234")
    expect(formattedUs.isPossible).toBe(true)

    const uk = getCountryByIso("GB")
    const formattedUk = formatPhoneWithCountry(uk, "7700900123")
    expect(formattedUk.e164).toBe("+447700900123")
    expect(formattedUk.isPossible).toBe(true)

    const uae = getCountryByIso("AE")
    const formattedUae = formatPhoneWithCountry(uae, "501234567")
    expect(formattedUae.e164).toBe("+971501234567")
    expect(formattedUae.isPossible).toBe(true)

    const au = getCountryByIso("AU")
    const formattedAu = formatPhoneWithCountry(au, "412345678")
    expect(formattedAu.e164).toBe("+61412345678")
    expect(formattedAu.isPossible).toBe(true)
  })
})
