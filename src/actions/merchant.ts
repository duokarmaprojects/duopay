"use server"

import { prisma } from "@/lib/db"

export async function normalizeMerchantName(rawName: string): Promise<{ normalizedName: string, category: string | null }> {
  if (!rawName || rawName.trim() === "") {
    return { normalizedName: rawName, category: null }
  }

  console.log('PRISMA:', typeof prisma, typeof prisma?.merchantAlias); const searchName = rawName.trim().toLowerCase()

  // First check if it matches an alias
  const aliasMatch = await prisma.merchantAlias.findUnique({
    where: { alias: searchName },
    include: { merchant: true }
  })

  if (aliasMatch) {
    return {
      normalizedName: aliasMatch.merchant.normalizedName,
      category: aliasMatch.merchant.defaultCategory
    }
  }

  // Then check if it matches a merchant directly
  const merchantMatch = await prisma.merchant.findFirst({
    where: {
      OR: [
        { name: searchName },
        { normalizedName: { equals: searchName } } // Case-insensitive conceptually, though sqlite might need extra care depending on collation
      ]
    }
  })

  if (merchantMatch) {
    // Add it as an alias for future quick lookups if it's not exact match?
    // Let's just return it for now
    return {
      normalizedName: merchantMatch.normalizedName,
      category: merchantMatch.defaultCategory
    }
  }

  // If entirely new, we might create a new Merchant entry, or just return the raw name.
  // The instructions said: "creating a new Merchant entry if it's completely new".
  // Note: we'll create it with the raw name as both name and normalizedName
  try {
    const newMerchant = await prisma.merchant.create({
      data: {
        name: searchName,
        normalizedName: rawName.trim(), // Keep original capitalization for display
      }
    })
    return {
      normalizedName: newMerchant.normalizedName,
      category: null
    }
  } catch (error) {
    // Unique constraint violation in case of race condition
    const existing = await prisma.merchant.findUnique({ where: { name: searchName } })
    if (existing) {
      return {
        normalizedName: existing.normalizedName,
        category: existing.defaultCategory
      }
    }
    return { normalizedName: rawName.trim(), category: null }
  }
}
