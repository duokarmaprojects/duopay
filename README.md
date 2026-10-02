# DuoPay

Split. Simplify. Get to ₹0.

DuoPay is a mobile-first PWA for expense splitting and settlement using Indian UPI.

## Architecture

See `ARCHITECTURE.md` for full details.
- Framework: Next.js (App Router)
- Database: Turso (libSQL) via Prisma
- Auth: NextAuth (Google OAuth)
- Styling: Tailwind CSS

## Getting Started

1. Copy `.env.example` to `.env` and fill in Google OAuth credentials.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Push database schema:
   ```bash
   npx prisma db push
   ```
4. Run development server:
   ```bash
   npm run dev
   ```

## Production Deployment (Vercel)

1. Create a Turso Database and get the `libsql://...` URL and Auth Token.
2. In Vercel, import this repository.
3. Set the Environment Variables:
   - `DATABASE_URL` (libsql string with token)
   - `AUTH_SECRET` (generate using `npx auth secret`)
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
4. Deploy!

The application is fully PWA compliant. Users can "Add to Home Screen" on iOS and Android for a full native-like experience.

## Testing
Run unit tests for domain logic (money calculations, balances, etc):
```bash
npx vitest run
```
