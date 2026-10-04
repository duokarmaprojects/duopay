# DuoPay — Device Biometric / Fingerprint Unlock Security Architecture
**Phase 26 Production Implementation Report**
**Date:** October 4, 2026  
**Status:** Implemented & Verified

---

## 1. Executive Summary & Security Philosophy

DuoPay Phase 26 introduces **Device Biometric / Fingerprint Unlock** as a local app protection layer.

### Core Security Invariants
1. **Local Unlock Mechanism Only:** Device biometric unlock is strictly a local barrier safeguarding app access and preventing sensitive financial information (balances, expenses, groups, settlements, UPI ID) from being exposed on an unlocked phone.
2. **Server-Authoritative Identity:** Biometric authentication **never replaces server authentication**. The server remains authoritative. All financial transactions, invitations, settlements, and ledger operations continue to be cryptographically validated and authorized server-side via NextAuth JWT session cookies with HttpOnly, Secure, and SameSite enforcement.
3. **Zero Raw Biometric Data:** DuoPay **never** receives, handles, transmits, or stores:
   - Fingerprint images
   - Face ID scans or depth maps
   - Biometric mathematical templates
   - Raw biometric sensor data
   Authentication is performed entirely by the device operating system (Android BiometricPrompt, Apple Secure Enclave / LocalAuthentication, Windows Hello). The app receives only a cryptographic success or failure outcome.
4. **No Raw Secrets in LocalStorage:** DuoPay stores only minimal non-sensitive configuration scoped strictly to the authenticated `userId`:
   - `userId`: the user's account ID
   - `enabled`: boolean toggle state
   - `credentialId`: opaque public credential ID handle
   - `biometricType`: adaptive type (`FINGERPRINT` | `FACE_ID` | `TOUCH_ID` | `WINDOWS_HELLO` | `BIOMETRIC`)
   - `timeoutMinutes`: lock timeout period (`0` | `1` | `5` | `15` minutes)
   - `lastActiveAt`: timestamp of last user interaction
5. **Session Expiry & Account Switching Safety:**
   - When the user explicitly logs out (`signOut`), the local lock state is disengaged.
   - If User A logs out and User B logs in, User A's biometric configuration **cannot** unlock or access User B's account (strict `userId` scoping).
   - If the server session expires or is revoked, biometric unlock **cannot** magically fabricate a session; the user is redirected to normal login.
6. **Zero Disruption to Startup:** If device biometrics are unavailable, unsupported, or thrown with an OS permission error, DuoPay still starts cleanly without blocking startup.

---

## 2. Multi-Platform Support Strategy (Section 26.1 & 26.7)

| Platform | Primary Authentication API | UI Label Adapted Dynamically |
| :--- | :--- | :--- |
| **Capacitor Native (Android)** | Android BiometricPrompt via Capacitor Plugin bridge | `Fingerprint / Face Unlock` |
| **Capacitor Native (iOS)** | LocalAuthentication (Face ID / Touch ID) via Capacitor Plugin bridge | `Face ID / Touch ID` |
| **Web PWA (Android / Chrome)** | W3C WebAuthn Platform Authenticator (`PublicKeyCredential`) | `Fingerprint / Face Unlock` |
| **Web PWA (iOS / Safari)** | W3C WebAuthn Platform Authenticator (Secure Enclave Face ID/Touch ID) | `Face ID / Touch ID` |
| **Desktop (Windows Edge/Chrome)** | Windows Hello Platform Authenticator | `Windows Hello / Fingerprint` |
| **Desktop (macOS Safari/Chrome)** | Touch ID Platform Authenticator | `Touch ID` |
| **Unsupported Browsers** | Graceful fallback (shows "Biometric unlock isn't available on this device") | `Biometric Unlock` |

---

## 3. App Lock Lifecycle & Privacy Shield (Section 26.4, 26.5 & 26.6)

### Lock Conditions
1. **Cold Start:** If biometric unlock is enabled for the active user session, the app initializes in a **locked state**. The `BiometricLockScreen` renders instead of the application DOM, ensuring **no balances, expenses, groups, settlements, or UPI details are rendered** until verification succeeds.
2. **App Resume after Inactivity:**
   - Configurable timeout options: `Immediately` (0 min), `1 minute`, `5 minutes` (default), `15 minutes`.
   - Measured locally using `visibilitychange`, `pagehide`, `focus`, and `blur` events.
   - If `Date.now() - lastActiveAt >= timeoutMinutes * 60 * 1000`, the app transitions to locked state on resume.
3. **No Interruption During Active Usage:**
   - Active user events (`pointerdown`, `keydown`, `touchstart`) throttle-refresh `lastActiveAt` every 10 seconds.
   - Moving between tabs or in-app routes **does not** trigger redundant biometric prompts while actively using the app.

### Background / App Switcher Privacy Shield (Section 26.6)
- When the user switches away from DuoPay or opens the OS multitasking carousel (`visibilitychange` === `hidden` or `blur`):
  - `AppSwitcherPrivacyShield` renders at `z-index: 999999` with an opaque DuoPay privacy screen.
  - This prevents Android and iOS multitasking switcher screenshots from capturing private financial amounts or account numbers.
  - When the app returns to the foreground, the privacy shield lifts. If the timeout was exceeded, the secure lock screen displays immediately.

---

## 4. Offline & Data Preservation Safety (Section 26.12)

- Biometric authentication operates completely offline using the device's local platform authenticator.
- No network requests are required to verify the local biometric credential.
- **IndexedDB & Outbox Safety:** Biometric lock and cache operations **never** touch or delete the local SQLite / IndexedDB (`duopay-local`) outbox. Pending offline transactions remain intact and sync automatically when network connectivity resumes.

---

## 5. Settings UI (Section 26.3 & 26.14)

- Located at **Settings → Security & Biometrics** (`/settings/security`) and linked from **Profile → Security**.
- Features:
  - Adaptive hardware label
  - Toggle switch `[ Enable / Disable ]`
  - "Lock After" dropdown (`Immediately`, `1 minute`, `5 minutes`, `15 minutes`)
  - "Lock Now" preview button
  - Defense-in-depth zero-trust architecture notice

---

## 6. Manual Real-Device Testing Walkthrough (Section 26.16)

For quality assurance on physical Android and iOS hardware:

### Android Physical Device Test Plan
1. **Login & Enrollment:**
   - Open installed DuoPay PWA or Capacitor app on Android device.
   - Navigate to **Profile → Security & Login** (or **Biometric Unlock**).
   - Tap **Enable**.
   - Observe the native Android system BiometricPrompt dialog appearing.
   - Touch enrolled fingerprint sensor.
   - Confirm status badge switches to green `Active`.
2. **App Cold Start:**
   - Swipe away DuoPay from Recent Apps (close process).
   - Reopen DuoPay.
   - Verify: Lock screen appears with `Unlock DuoPay` and `[ Use Fingerprint / Face Unlock ]`.
   - Verify: No financial figures, balances, or transactions are visible behind the lock.
   - Tap `[ Use Fingerprint / Face Unlock ]` and authenticate.
   - Verify: Instant transition into dashboard.
3. **Timeout & Multitasking:**
   - With timeout set to `1 minute`, minimize DuoPay to home screen.
   - Wait 65 seconds.
   - Reopen DuoPay.
   - Verify: Prompt appears before showing dashboard.
4. **Offline Mode:**
   - Turn on Airplane Mode.
   - Close and reopen app.
   - Authenticate with fingerprint.
   - Verify: Dashboard opens with offline-cached data.
   - Create a local expense.
   - Turn off Airplane Mode.
   - Verify: Expense syncs cleanly once online.

### iOS Physical Device Test Plan
1. Open installed DuoPay on iPhone (iOS 16+).
2. Go to Profile → Security → Enable Face ID / Touch ID.
3. Verify Apple Face ID / Touch ID system sheet prompts for biometric approval.
4. Test backgrounding app: verify multitasking carousel does not leak financial balances.
5. Test session fallback: tap `Use Normal DuoPay Login` and confirm redirect to standard phone login.
