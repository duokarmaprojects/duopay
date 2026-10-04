# DuoPay Feature Gap Matrix

## 0. General Platform Architecture
- Next.js / React (EXISTS -> KEEP)
- Prisma / Turso Database (EXISTS -> KEEP)
- Tailwind CSS / Radix / Lucide (EXISTS -> KEEP)
- PWA / Service Worker (EXISTS -> KEEP)
- Capacitor Native App Shell (EXISTS -> KEEP)
- IndexedDB Offline Sync Engine (EXISTS -> KEEP)
- Pusher Real-time Events (EXISTS -> KEEP)

## 1. Smart Expense Capture (Phase A)
- Manual Expense Creation (EXISTS -> IMPROVE)
- Receipt OCR / Photo Parsing (MISSING -> BUILD)
- Share-to-DuoPay (Native Share Target) (MISSING -> BUILD)
- Payment Screenshot Parsing (MISSING -> BUILD)
- Cash Expenses (PARTIAL -> COMPLETE)

## 2. Shared Finance & Trips (Phase B)
- Groups (EXISTS -> IMPROVE)
- Trips (Specialized Groups) (MISSING -> BUILD)
- Trip Pools / Group Funds (MISSING -> BUILD)
- Collections (Fundraising) (MISSING -> BUILD)
- Priority / Important Bills (MISSING -> BUILD)

## 3. Automation & Intelligence (Phase C)
- Recurring Expenses (EXISTS -> IMPROVE to 2.0)
- Automation Rules (IF -> THEN) (MISSING -> BUILD)
- Merchant Intelligence / Normalization (MISSING -> BUILD)
- Auto-Categorization (MISSING -> BUILD)

## 4. Communication & Social (Phase D)
- Friends (EXISTS -> KEEP)
- Group Chat & Social Feed (MISSING -> BUILD)
- Expense Comments & Notes (MISSING -> BUILD)
- Photo Attachments (MISSING -> BUILD)
- Move Expense Between Groups (MISSING -> BUILD)

## 5. Analytics & Forecasting (Phase E)
- Personal True Spend Analytics (PARTIAL -> COMPLETE)
- Analytics Dashboard 2.0 (MISSING -> BUILD)
- Spending Forecasts (MISSING -> BUILD)
- Budgets (Monthly, Category, Trip) (MISSING -> BUILD)

## 6. Integrations & Portability (Phase F)
- Import from Splitwise/CSV (MISSING -> BUILD)
- Export to CSV/PDF (MISSING -> BUILD)
- Smart Bill / Order Import (Swiggy, Zomato, etc.) (MISSING -> BUILD)

## 7. Native Mobile Depth (Phase G)
- Push Notifications (EXISTS -> IMPROVE)
- Background Sync (PARTIAL -> COMPLETE)
- Deep Links (EXISTS -> KEEP)
- Android SMS Transaction Import (Opt-in) (MISSING -> BUILD)

## 8. Smart Assistant (Phase H)
- AI Balance Assistant (PARTIAL -> COMPLETE)
- NLP Queries (Who owes me, what did I spend) (MISSING -> BUILD)
- AI Action Drafts (MISSING -> BUILD)

## 9. Payments, Rewards & Security
- Server-authoritative payments (EXISTS -> KEEP)
- Zero-trust settlement engine (EXISTS -> KEEP)
- HMAC / Webhook verification (EXISTS -> KEEP)
- Referral ledger (EXISTS -> KEEP)
- Cashback (EXISTS -> KEEP)
- Smart Split / Settlement algorithms (EXISTS -> KEEP)
- Privacy Controls (PARTIAL -> COMPLETE)
