# DuoPay — Batch 4 Migration Documentation
**Phases N–Q: Group Messages, Expense Comments, Attachments**

## Safe Additive DDL Statements
Executed against remote Turso database and local database on 2026-10-04.
All statements are strictly additive (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
Zero destructive changes; zero database resets.

```sql
-- Phase N: Group Chat Messages
CREATE TABLE IF NOT EXISTS "GroupMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" DATETIME,
  CONSTRAINT "GroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GroupMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");
CREATE INDEX IF NOT EXISTS "GroupMessage_senderId_createdAt_idx" ON "GroupMessage"("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_idempotencyKey_idx" ON "GroupMessage"("groupId", "idempotencyKey");

-- Phase O: Expense Comments
CREATE TABLE IF NOT EXISTS "ExpenseComment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expenseId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" DATETIME,
  CONSTRAINT "ExpenseComment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExpenseComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ExpenseComment_expenseId_createdAt_idx" ON "ExpenseComment"("expenseId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExpenseComment_authorId_createdAt_idx" ON "ExpenseComment"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExpenseComment_expenseId_idempotencyKey_idx" ON "ExpenseComment"("expenseId", "idempotencyKey");

-- Phase P: Attachments
CREATE TABLE IF NOT EXISTS "Attachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "groupId" TEXT,
  "expenseId" TEXT,
  "messageId" TEXT,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "sha256" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Attachment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Attachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GroupMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Attachment_ownerId_idx" ON "Attachment"("ownerId");
CREATE INDEX IF NOT EXISTS "Attachment_groupId_idx" ON "Attachment"("groupId");
CREATE INDEX IF NOT EXISTS "Attachment_expenseId_idx" ON "Attachment"("expenseId");
CREATE INDEX IF NOT EXISTS "Attachment_messageId_idx" ON "Attachment"("messageId");
CREATE INDEX IF NOT EXISTS "Attachment_sha256_idx" ON "Attachment"("sha256");
```
