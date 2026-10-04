# Batch 2 Implementation Plan

## Subagent 1: Recurring Expenses 2.0 (Phase F)
Goal: Never silently create financial obligations.
1. prisma/schema.prisma has been updated with status String @default("FINAL") on Expense. FINAL means it counts towards balances. UPCOMING means it's due soon but not verified. SKIPPED means the user skipped it.
2. Update src/actions/recurring.ts. Currently it automatically generates FINAL expenses. Change it so that generateRecurringExpenses() creates Expense objects with status: "UPCOMING" and sets their dueDate and eminderAt.
3. Add a new server action confirmUpcomingExpense(expenseId) to change an UPCOMING expense to FINAL (after user review).
4. Add a new server action skipUpcomingExpense(expenseId) to change it to SKIPPED.
5. Update src/app/bills/page.tsx (created in Phase B) to show these UPCOMING expenses and provide "Confirm" and "Skip" buttons.
6. Support DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM in the Zod schemas in ecurring.ts.

## Subagent 2: Automation & Merchant Intelligence (Phase G, H, I)
1. prisma/schema.prisma has been updated with AutomationRule, Merchant, and MerchantAlias.
2. Create src/actions/automation.ts to CRUD AutomationRules.
3. Update src/actions/expense.ts (the ddExpense function): Before creating the expense, look at the merchant (which is stored in description or metadata). Run it through the AutomationRules to auto-set the category!
4. Create a UI at src/app/settings/automations/page.tsx for the user to manage their rules.
5. Create a background task or action to normalize merchants using the Merchant model.

