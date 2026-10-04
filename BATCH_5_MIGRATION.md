# DuoPay — Batch 5 Migration Documentation
**Phases R–V: Budgets, True Spend, and Analytics Indexes**

## Safe Additive DDL Statements
Executed against remote Turso database and local database on 2026-10-04.
All statements are strictly additive (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
Zero destructive changes; zero database resets; zero production data loss.

```sql
-- Phase T: Budgets
CREATE TABLE IF NOT EXISTS "Budget" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "category" TEXT,
  "amountPaise" INTEGER NOT NULL,
  "period" TEXT NOT NULL DEFAULT 'MONTHLY',
  "startDate" DATETIME,
  "endDate" DATETIME,
  "warningPercent" INTEGER NOT NULL DEFAULT 80,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Budget_userId_active_idx" ON "Budget"("userId", "active");
CREATE INDEX IF NOT EXISTS "Budget_userId_category_idx" ON "Budget"("userId", "category");
CREATE INDEX IF NOT EXISTS "Budget_userId_idempotencyKey_idx" ON "Budget"("userId", "idempotencyKey");

-- Performance Indexes for True Spend & Analytics Queries
CREATE INDEX IF NOT EXISTS "Expense_status_createdAt_idx" ON "Expense"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense"("category");
CREATE INDEX IF NOT EXISTS "ExpenseParticipant_userId_idx" ON "ExpenseParticipant"("userId");
```

## Verification
- Remote Turso execution completed successfully.
- Local SQLite synchronized via `prisma db push --skip-generate`.
- Prisma client generated with `Budget` model and new relations on `User`.
- Zero data loss or breaking changes.
