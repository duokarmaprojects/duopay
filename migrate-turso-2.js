const { createClient } = require('@libsql/client');
require('dotenv').config();
const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function migrate() {
  const queries = [
    'CREATE TABLE "AutomationRule" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "priority" INTEGER NOT NULL DEFAULT 0, "merchantName" TEXT, "minAmount" INTEGER, "maxAmount" INTEGER, "source" TEXT, "groupId" TEXT, "setCategory" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "AutomationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)',
    'CREATE TABLE "Merchant" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL, "defaultCategory" TEXT, "icon" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)',
    'CREATE UNIQUE INDEX "Merchant_name_key" ON "Merchant"("name")',
    'CREATE TABLE "MerchantAlias" ("id" TEXT NOT NULL PRIMARY KEY, "merchantId" TEXT NOT NULL, "alias" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "MerchantAlias_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE CASCADE ON UPDATE CASCADE)',
    'CREATE UNIQUE INDEX "MerchantAlias_alias_key" ON "MerchantAlias"("alias")',
    'ALTER TABLE "Expense" ADD COLUMN "status" TEXT NOT NULL DEFAULT ''FINAL'''
  ];

  for (const q of queries) {
    try {
      await client.execute(q);
      console.log('Success:', q);
    } catch (e) {
      console.log('Skipped/Error:', q, e.message);
    }
  }
}
migrate();
