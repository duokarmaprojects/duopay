# DuoPay Architecture Plan

## 1. Project Initialization & Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS (for design system & responsive UI)
- **Components**: Radix UI primitives or similar lightweight accessible components, built into a custom design system.
- **Database**: Turso (libSQL) via Prisma ORM or Drizzle ORM. We will use Prisma for type-safe database access, provided it supports libSQL well (or Drizzle if better compatibility with Turso serverless).
- **Authentication**: NextAuth.js (Auth.js) with Google Provider.
- **Validation**: Zod (for API, Forms, and Env variables).
- **PWA**: `next-pwa` or custom service worker integration for manifest, offline support, and caching.
- **State Management**: React Query (TanStack Query) for server state caching/mutations, or Server Actions + `useFormState` if fully leaning into App Router capabilities. Given PWA and offline considerations, React Query + local state might be more robust for optimistic updates and caching.

## 2. Database Schema (Draft)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite" // Or "libsql" if using specific driver, though Prisma uses sqlite driver for Turso with driver adapters
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  phone         String?   // Normalized E.164
  upiId         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  
  groupMembers  GroupMember[]
  expensesPaid  Expense[] // Expenses where this user is the payer
  expenseShares ExpenseParticipant[] // Shares in expenses
  
  settlementsPaid     Settlement[] @relation("SettlementsPaid")
  settlementsReceived Settlement[] @relation("SettlementsReceived")
}

// NextAuth standard models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Group {
  id          String   @id @default(cuid())
  name        String
  image       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members     GroupMember[]
  expenses    Expense[]
  settlements Settlement[]
}

model GroupMember {
  id        String   @id @default(cuid())
  groupId   String
  userId    String
  joinedAt  DateTime @default(now())

  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
}

model Expense {
  id          String   @id @default(cuid())
  groupId     String?  // Optional for P2P expenses if supported later, but V1 focuses on groups? Actually prompt says P2P is also there. Let's make it optional or require group.
  description String
  amount      Int      // In paise! (e.g., ₹100.50 = 10050)
  date        DateTime @default(now())
  payerId     String
  splitMethod String   @default("EQUAL") // V1 only EQUAL
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  idempotencyKey String? @unique

  group       Group?   @relation(fields: [groupId], references: [id], onDelete: Restrict)
  payer       User     @relation(fields: [payerId], references: [id], onDelete: Restrict)
  
  participants ExpenseParticipant[]
}

model ExpenseParticipant {
  id        String   @id @default(cuid())
  expenseId String
  userId    String
  share     Int      // In paise, exact calculated share. Sum of all shares = Expense.amount

  expense   Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([expenseId, userId])
}

model Settlement {
  id             String   @id @default(cuid())
  groupId        String?  // Optional, context for settlement
  payerId        String
  receiverId     String
  amount         Int      // In paise
  status         String   @default("COMPLETED") // V1: INITIATED, COMPLETED, CANCELLED
  note           String?
  reportedAt     DateTime @default(now())
  createdAt      DateTime @default(now())
  idempotencyKey String?  @unique

  group          Group?   @relation(fields: [groupId], references: [id], onDelete: Restrict)
  payer          User     @relation("SettlementsPaid", fields: [payerId], references: [id], onDelete: Restrict)
  receiver       User     @relation("SettlementsReceived", fields: [receiverId], references: [id], onDelete: Restrict)
}
```

## 3. Authentication Architecture
- NextAuth.js configured with Google OAuth.
- Session strategy: Database sessions or JWT (JWT preferred for edge scalability, but DB is fine for strong invalidation. Let's stick to DB sessions if using Prisma for simplicity in V1).
- Middleware: Protect all routes under `/app` (except `/login`, `/api/auth`, `/manifest`).
- First-time user hook: Check if `phone` and `upiId` are missing. If so, redirect to `/setup-profile`.

## 4. Domain Model (Calculations)
- **Money**: Always represented as an integer (paise). `type Paise = number`.
- **Equal Split Calculation**:
  - Input: `amount` (paise), `participantIds` (array of string)
  - Base share: `Math.floor(amount / participants.length)`
  - Remainder: `amount % participants.length`
  - Distribute remainder 1 paise at a time to the first N participants (sorted by ID to be deterministic).
- **Balance Engine**:
  - `calculateBalances(expenses, settlements, userId)` -> Net position of `userId` against all others.
  - Generates directed edges: `A owes B X paise`.

## 5. Navigation & UI Structure
- `/login` -> Google Auth
- `/setup-profile` -> Name, Phone, UPI ID
- `/(main)` -> Protected layout
  - `/` (Home) -> Summary balances, recent activity, quick actions.
  - `/groups` -> List of groups.
  - `/groups/[id]` -> Group details, expenses, balances inside group.
  - `/groups/create` -> Create new group.
  - `/expenses/add?groupId=...` -> Add expense.
  - `/settle?withUserId=...` -> Settlement flow (UPI intent).
  - `/friends` -> List of people you've split with.
  - `/profile` -> Settings, UPI ID updates, logout.

## 6. API / Service Boundaries
Using Server Actions or API routes (Next.js App Router).
- `actions/group.ts`: `createGroup`, `addMember`.
- `actions/expense.ts`: `createExpense` (transactional).
- `actions/settlement.ts`: `recordSettlement`.
- `actions/user.ts`: `updateProfile`, `searchUsersByPhone`.
- **Validation**: Every action receives Zod parsed input and verifies session/authorization before execution.

## 7. PWA Strategy
- `manifest.json` configured with theme colors, icons, standalone display.
- Service Worker caching static assets and basic API responses (Network First for data, Cache First for assets).
- Workbox integration (via `next-pwa` or custom setup) with proper `skipWaiting` strategy for non-intrusive updates.

## 8. Testing Strategy
- **Unit Tests** (Vitest/Jest): `calculateEqualSplit`, `calculateBalances`, `generateUpiIntent`.
- **Integration Tests**: Core database workflows (Expense creation with valid/invalid shares, Settlement creation).
- **E2E/Component**: Key flows (Login -> Home -> Add Expense).
