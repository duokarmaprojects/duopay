import {
  getCountries,
  getCountryCallingCode,
  AsYouType,
  parsePhoneNumberFromString,
  isPossiblePhoneNumber,
  CountryCode,
} from "libphonenumber-js"

export interface Country {
  iso: CountryCode
  name: string
  callingCode: string
  callingDigits: string
  flag: string
}

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return "🌐"
  return iso
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

const displayNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

export const ALL_COUNTRIES: Country[] = getCountries()
  .map((iso) => {
    const callingDigits = getCountryCallingCode(iso)
    const name = displayNames?.of(iso) || iso
    return {
      iso,
      name,
      callingCode: `+${callingDigits}`,
      callingDigits,
      flag: getFlagEmoji(iso),
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

// Countries sorted with longer calling codes first for accurate prefix matching
const COUNTRIES_BY_CODE_DESC = [...ALL_COUNTRIES].sort(
  (a, b) => b.callingDigits.length - a.callingDigits.length
)

const COUNTRY_MAP = new Map<string, Country>()
for (const country of ALL_COUNTRIES) {
  COUNTRY_MAP.set(country.iso.toUpperCase(), country)
}

export const DEFAULT_COUNTRY: Country =
  COUNTRY_MAP.get("IN") || {
    iso: "IN" as CountryCode,
    name: "India",
    callingCode: "+91",
    callingDigits: "91",
    flag: "🇮🇳",
  }

export const POPULAR_COUNTRY_CODES: CountryCode[] = [
  "IN",
  "US",
  "GB",
  "AE",
  "AU",
  "CA",
  "SG",
]

export function getCountryByIso(iso?: string | null): Country {
  if (!iso) return DEFAULT_COUNTRY
  return COUNTRY_MAP.get(iso.toUpperCase()) || DEFAULT_COUNTRY
}

export function searchCountries(query: string): Country[] {
  const q = query.trim().toLowerCase()
  if (!q) return ALL_COUNTRIES

  const cleanQueryCode = q.startsWith("+") ? q.slice(1) : q

  return ALL_COUNTRIES.filter((c) => {
    // 1. Name match
    if (c.name.toLowerCase().includes(q)) return true
    // 2. Calling code match (+91 or 91)
    if (c.callingDigits.startsWith(cleanQueryCode)) return true
    if (c.callingCode.toLowerCase().startsWith(q)) return true
    // 3. ISO code match (IN, US, etc.)
    if (c.iso.toLowerCase() === q) return true
    return false
  })
}

export function detectCountryFromPhone(
  rawInput: string
): { country: Country; nationalNumber: string } | null {
  const clean = rawInput.trim()
  if (!clean.startsWith("+")) return null

  // 1. Try authoritative parse from libphonenumber-js
  const parsed = parsePhoneNumberFromString(clean)
  if (parsed?.country) {
    const country = COUNTRY_MAP.get(parsed.country)
    if (country) {
      return {
        country,
        nationalNumber: parsed.nationalNumber,
      }
    }
  }

const PRIMARY_COUNTRY_FOR_CODE: Record<string, CountryCode> = {
  "1": "US",
  "44": "GB",
  "61": "AU",
  "7": "RU",
  "358": "FI",
  "47": "NO",
  "262": "RE",
  "212": "MA",
}

  // 2. Fallback prefix match for partial or unformatted inputs
  const digitsOnly = clean.slice(1).replace(/\D/g, "")
  const match = COUNTRIES_BY_CODE_DESC.find((c) =>
    digitsOnly.startsWith(c.callingDigits)
  )

  if (match) {
    const primaryIso = PRIMARY_COUNTRY_FOR_CODE[match.callingDigits]
    const resolvedCountry = primaryIso ? COUNTRY_MAP.get(primaryIso) || match : match
    return {
      country: resolvedCountry,
      nationalNumber: digitsOnly.slice(resolvedCountry.callingDigits.length),
    }
  }

  return null
}

export function formatPhoneWithCountry(
  country: Country,
  input: string
): {
  display: string
  digits: string
  e164: string
  isPossible: boolean
} {
  // Strip non-digits
  const digits = input.replace(/\D/g, "")
  if (!digits) {
    return {
      display: "",
      digits: "",
      e164: "",
      isPossible: false,
    }
  }

  const asYouType = new AsYouType(country.iso)
  const display = asYouType.input(digits)
  const e164 = `${country.callingCode}${digits}`

  const isPossible = isPossiblePhoneNumber(e164)

  return {
    display,
    digits,
    e164,
    isPossible,
  }
}
