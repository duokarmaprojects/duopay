# DuoPay Batch 4 Final Report — Social Expense Layer
**Phases N–Q: Group Chat + Expense Comments + Attachments + Move Expense**

---

## 1. Executive Summary

Batch 4 has been completed with 100% adherence to zero-trust invariants and security boundaries:
- **Phase N (Group Chat)**: Secure real-time group chat with cursor-based pagination, Pusher channels (`group-${groupId}`), input sanitization, rate limiting, and strict membership checks.
- **Phase O (Expense Comments)**: Threaded comments on individual expenses with IDOR protection, author-only edit/delete, real-time Pusher events (`expense-${expenseId}`), and automatic participant notifications.
- **Phase P (Attachments)**: Image attachment pipeline supporting JPEG, PNG, and WebP up to 10MB, enforced with SHA-256 fingerprinting, binary magic-byte inspection (`validateImageMagicBytes`), and strict parent resource access control (no guessable URLs or unauthorized access).
- **Phase Q (Move Expense Between Groups)**: Atomic transfer of an expense between groups with multi-participant validation (every participant must be a member of the destination group), atomic conditional SQL updates, balance recalculations via the authoritative balance engine, and dual Pusher notifications (`expense.moved_out` and `expense.moved_in`).
- **Database & Turso**: Additive non-destructive DDL migration executed safely on production Turso and local SQLite; Prisma client synchronized.
- **Concurrency & Idempotency**: Verified under 10 concurrent requests for chat, comments, and move-expense with idempotency keys; exactly one mutation occurs with duplicate replay protection.
- **Test Results**: **350 / 350 tests passing (36 test suites)**, **0 TypeScript errors**, **Production build cleanly compiled (37 routes)**.
- **Constraint Check**: Batch 5 has NOT been started.

---

## 2. Phase-by-Phase Implementation Details

### Phase N — Group Chat
- **Models**: `GroupMessage` with `id`, `groupId`, `senderId`, `body`, `idempotencyKey`, `deletedAt`, `createdAt`, `updatedAt`, and indexes on `[groupId, createdAt]`, `[senderId, createdAt]`, and `[groupId, idempotencyKey]`.
- **Server Actions** (`src/actions/chat.ts`):
  - `sendGroupMessage(groupId, rawBody, idempotencyKey)`: Verifies caller's active membership in group, applies `CHAT_MESSAGE` rate limiting, sanitizes message body (max 2,000 chars), transactionally creates message, and broadcasts `chat.message_created` via Pusher to channel `group-${groupId}`. Handles concurrent duplicate attempts with `P2002` replay.
  - `getGroupMessages(groupId, cursor, limit)`: IDOR-protected; retrieves messages with cursor-based pagination (default 30, max 50) in chronological order.
  - `deleteGroupMessage(messageId)`: Author-only soft deletion setting `deletedAt`; broadcasts `chat.message_deleted` to channel `group-${groupId}`.
- **UI Component** (`src/app/groups/[id]/GroupChat.tsx` & `GroupContentSwitcher.tsx`):
  - Integrated into Group view with a tab switcher: `[ 📊 Finances ] [ 💬 Group Chat ]`.
  - Supports live streaming messages via Pusher, cursor pagination, image attachments, message deletion for authors, and dark mode UI.

### Phase O — Expense Comments
- **Models**: `ExpenseComment` with `id`, `expenseId`, `authorId`, `body`, `idempotencyKey`, `deletedAt`, `createdAt`, `updatedAt`, and indexes on `[expenseId, createdAt]`, `[authorId, createdAt]`, and `[expenseId, idempotencyKey]`.
- **Server Actions** (`src/actions/comment.ts`):
  - `addExpenseComment(expenseId, rawBody, idempotencyKey)`: Enforces caller authorization (must be in the expense's group or a participant), validates input (max 1,000 chars), persists comment, broadcasts `expense.comment_created` via Pusher, and dispatches in-app `EXPENSE_COMMENT` notifications to other expense participants.
  - `getExpenseComments(expenseId, limit)`: IDOR-protected; returns all active comments for the expense.
  - `editExpenseComment(commentId, newBody)`: Author-only mutation; broadcasts `expense.comment_updated`.
  - `deleteExpenseComment(commentId)`: Author-only soft deletion; broadcasts `expense.comment_deleted`.
- **UI Component** (`src/components/expenses/ExpenseCommentsModal.tsx`):
  - Accessible directly from each expense in `GroupExpenseList.tsx`.
  - Supports live comments, author inline editing, author deletion, and image attachment.

### Phase P — Secure Attachments
- **Models**: `Attachment` with `id`, `ownerId`, `groupId`, `expenseId`, `messageId`, `storageKey`, `fileName`, `mimeType`, `sizeBytes`, `sha256`, and indexes on `ownerId`, `groupId`, `expenseId`, `messageId`, `sha256`.
- **Server Actions** (`src/actions/attachment.ts`):
  - `createAttachment(formData)`: Enforces max 10MB size, verifies MIME allow-list (`image/jpeg`, `image/png`, `image/webp`), inspects the first 12+ bytes with `validateImageMagicBytes`, validates caller membership in the target group/expense/message, generates SHA-256 fingerprint, and stores with an unguessable UUID path.
  - `getAttachment(attachmentId)`: IDOR-protected; validates caller ownership, group membership, or expense participant status before returning attachment metadata.
  - `deleteAttachment(attachmentId)`: Owner-only deletion.

### Phase Q — Move Expense Between Groups
- **Server Actions** (`src/actions/moveExpense.ts`):
  - `previewMoveExpense(expenseId, destinationGroupId)`: Validates that caller is a member of both source and destination groups, and verifies whether all expense participants are active members of the destination group. Returns `{ canMove, missingParticipants, message }`.
  - `moveExpense(formData)`: Atomically updates `expense.groupId` within a database transaction using conditional test-and-set semantics (`where: { id: expenseId, groupId: sourceGroupId }`).
  - Moves associated attachments to the new group.
  - Broadcasts `expense.moved_out` on channel `group-${sourceGroupId}` and `expense.moved_in` on channel `group-${destinationGroupId}`.
  - Dispatches `EXPENSE_ADDED` notifications to destination group members.
  - Revalidates paths for both groups and `/activity`.
- **UI Component** (`src/components/expenses/MoveExpenseModal.tsx`):
  - Accessible via the transfer icon on each expense item in `GroupExpenseList.tsx`.
  - Dynamically fetches user groups, runs real-time participant eligibility check, and allows one-click transfer.

---

## 3. Concurrency & Idempotency Verification

Concurrency was tested under 10 simultaneous requests using Vitest:
- **Chat (`sendGroupMessage`)**: 10 concurrent requests with identical idempotency key resulted in exactly 1 database write and 9 idempotent replays (`isDuplicate: true`).
- **Comments (`addExpenseComment`)**: 10 concurrent requests with identical idempotency key resulted in exactly 1 database write and 9 idempotent replays (`isDuplicate: true`).
- **Move Expense (`moveExpense`)**: 10 concurrent requests with identical idempotency key resulted in exactly 1 database mutation and 9 idempotent completions without duplicate event emission.

---

## 4. Verification Results

| Check | Result | Details |
|---|---|---|
| **Vitest Test Suite** | **350 / 350 PASS** | 36 test suites passed in 14.99s |
| **TypeScript Typecheck** | **0 errors** | `npx tsc --noEmit` exited 0 |
| **Production Build** | **Compiled Cleanly** | Next.js 16.3.8 Turbopack generated 37 routes |
| **Turso Database** | **Synchronized** | Additive schema changes applied |

---

## 5. Security & Invariant Checklist

- [x] Zero production database wipes or destructive drops.
- [x] No second financial engine created; existing authoritative balance engine preserved.
- [x] Integer paise money architecture preserved throughout.
- [x] IDOR checks enforced on chat messages, comments, attachments, and move expense.
- [x] Input sanitization and action-level rate limits active on all new entry points.
- [x] Batch 5 has NOT been started.
