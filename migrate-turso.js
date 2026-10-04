const { createClient } = require('@libsql/client');
require('dotenv').config();
const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function migrate() {
  const queries = [
    'ALTER TABLE "Group" ADD COLUMN type TEXT DEFAULT "GROUP"',
    'ALTER TABLE "Group" ADD COLUMN destination TEXT',
    'ALTER TABLE "Group" ADD COLUMN startDate DATETIME',
    'ALTER TABLE "Group" ADD COLUMN endDate DATETIME',
    'ALTER TABLE "Group" ADD COLUMN targetAmount INTEGER',
    'ALTER TABLE "Group" ADD COLUMN deadline DATETIME',
    'ALTER TABLE "Group" ADD COLUMN poolOwnerId TEXT',
    'ALTER TABLE "Group" ADD COLUMN status TEXT DEFAULT "ACTIVE"',
    'ALTER TABLE Expense ADD COLUMN isPoolExpense BOOLEAN DEFAULT 0',
    'ALTER TABLE Expense ADD COLUMN priority TEXT DEFAULT "NORMAL"',
    'ALTER TABLE Expense ADD COLUMN dueDate DATETIME',
    'ALTER TABLE Expense ADD COLUMN reminderAt DATETIME',
    'ALTER TABLE Settlement ADD COLUMN isPoolContribution BOOLEAN DEFAULT 0'
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
