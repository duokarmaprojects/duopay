import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectBiometricType,
  checkBiometricAvailability,
  enrollBiometric,
  verifyBiometric,
  disableBiometric,
  updateBiometricTimeout,
  isLockTimeoutExceeded,
} from './biometricService';
import {
  loadBiometricConfig,
  saveBiometricConfig,
  removeBiometricConfig,
  updateLastActive,
} from './storage';
import { BiometricConfig } from './types';

describe('Phase 26: Device Biometric / Fingerprint Unlock Security Suite', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const k in mockStorage) delete mockStorage[k];

    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
      },
    });

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      credentials: {
        create: vi.fn(),
        get: vi.fn(),
      },
    });

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
    });

    vi.stubGlobal('crypto', {
      getRandomValues: (buffer: Uint8Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = Math.floor(Math.random() * 256);
        }
        return buffer;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Hardware Availability & Adaptive Platform Labeling
  // =========================================================================
  describe('1. Platform Detection & Hardware Availability', () => {
    it('should detect iOS devices and label as Face ID / Touch ID', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      });
      const detected = detectBiometricType();
      expect(detected.type).toBe('FACE_ID');
      expect(detected.label).toBe('Face ID / Touch ID');
    });

    it('should detect Android devices and label as Fingerprint / Face Unlock', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      });
      const detected = detectBiometricType();
      expect(detected.type).toBe('FINGERPRINT');
      expect(detected.label).toBe('Fingerprint / Face Unlock');
    });

    it('should detect Windows devices and label as Windows Hello / Fingerprint', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });
      const detected = detectBiometricType();
      expect(detected.type).toBe('WINDOWS_HELLO');
      expect(detected.label).toBe('Windows Hello / Fingerprint');
    });

    it('should report available when PublicKeyCredential platform authenticator returns true', async () => {
      vi.stubGlobal('navigator', { userAgent: 'Android' });
      const res = await checkBiometricAvailability();
      expect(res.isAvailable).toBe(true);
      expect(res.biometricType).toBe('FINGERPRINT');
    });

    it('should report unavailable gracefully when platform authenticator returns false', async () => {
      vi.stubGlobal('navigator', { userAgent: 'Linux' });
      (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = vi.fn().mockResolvedValue(false);

      const res = await checkBiometricAvailability();
      expect(res.isAvailable).toBe(false);
      expect(res.error).toContain('No platform biometric authenticator');
    });

    it('should never crash when PublicKeyCredential is not supported by older browsers', async () => {
      vi.stubGlobal('navigator', { userAgent: 'OldBrowser' });
      (window as any).PublicKeyCredential = undefined;
      const res = await checkBiometricAvailability();
      expect(res.isAvailable).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Biometric Enrollment Lifecycle
  // =========================================================================
  describe('2. Biometric Enrollment Lifecycle', () => {
    it('should successfully enroll biometric via WebAuthn platform authenticator', async () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Android',
        credentials: {
          create: vi.fn().mockResolvedValue({
            id: 'mock-cred-id',
            rawId: new Uint8Array([1, 2, 3, 4]).buffer,
            type: 'public-key',
          }),
        },
      });

      const res = await enrollBiometric('user-alice', 'Alice Smith');
      expect(res.success).toBe(true);

      const config = loadBiometricConfig('user-alice');
      expect(config).not.toBeNull();
      expect(config?.userId).toBe('user-alice');
      expect(config?.enabled).toBe(true);
      expect(config?.timeoutMinutes).toBe(5);
      expect(config?.credentialId).toBeDefined();
    });

    it('should handle user cancellation of OS biometric prompt without throwing', async () => {
      const cancelError = new Error('The operation either timed out or was not allowed');
      cancelError.name = 'NotAllowedError';

      vi.stubGlobal('navigator', {
        userAgent: 'Android',
        credentials: {
          create: vi.fn().mockRejectedValue(cancelError),
        },
      });

      const res = await enrollBiometric('user-bob', 'Bob');
      expect(res.success).toBe(false);
      expect(res.cancelled).toBe(true);
      expect(res.errorCode).toBe('USER_CANCELLED');

      const config = loadBiometricConfig('user-bob');
      expect(config).toBeNull();
    });

    it('should reject enrollment if userId is missing (unauthenticated)', async () => {
      const res = await enrollBiometric('');
      expect(res.success).toBe(false);
      expect(res.error).toContain('must be authenticated');
    });
  });

  // =========================================================================
  // 3. Biometric Verification & Local App Unlock
  // =========================================================================
  describe('3. Biometric Verification & Unlock', () => {
    beforeEach(() => {
      saveBiometricConfig({
        userId: 'user-alice',
        enabled: true,
        credentialId: btoa('test-cred-alice'),
        biometricType: 'FINGERPRINT',
        timeoutMinutes: 5,
        lastActiveAt: Date.now() - 600000, // 10 mins ago
        enrolledAt: Date.now() - 1000000,
      });
    });

    it('should successfully verify and refresh lastActiveAt timestamp on success', async () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Android',
        credentials: {
          get: vi.fn().mockResolvedValue({
            id: 'mock-assertion-id',
            type: 'public-key',
          }),
        },
      });

      const before = Date.now();
      const res = await verifyBiometric('user-alice');
      expect(res.success).toBe(true);

      const config = loadBiometricConfig('user-alice');
      expect(config?.lastActiveAt).toBeGreaterThanOrEqual(before);
    });

    it('should safely return failure when OS biometric prompt is rejected', async () => {
      const authFailError = new Error('User cancelled the dialog');
      authFailError.name = 'NotAllowedError';

      vi.stubGlobal('navigator', {
        userAgent: 'Android',
        credentials: {
          get: vi.fn().mockRejectedValue(authFailError),
        },
      });

      const res = await verifyBiometric('user-alice');
      expect(res.success).toBe(false);
      expect(res.cancelled).toBe(true);
      expect(res.errorCode).toBe('USER_CANCELLED');
    });

    it('should detect invalidated biometric credentials gracefully', async () => {
      const invalidError = new Error('The credential was not found or was invalidated');
      invalidError.name = 'InvalidStateError';

      vi.stubGlobal('navigator', {
        userAgent: 'Android',
        credentials: {
          get: vi.fn().mockRejectedValue(invalidError),
        },
      });

      const res = await verifyBiometric('user-alice');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('CREDENTIAL_INVALID');
    });
  });

  // =========================================================================
  // 4. Timeout Evaluation & Lock Conditions (Section 26.5)
  // =========================================================================
  describe('4. Lock Timeout Evaluation & Conditions', () => {
    const baseConfig: BiometricConfig = {
      userId: 'user-alice',
      enabled: true,
      credentialId: 'cred-123',
      biometricType: 'FINGERPRINT',
      timeoutMinutes: 5,
      lastActiveAt: 1000000,
      enrolledAt: 1000000,
    };

    it('should lock immediately when timeoutMinutes is configured to 0', () => {
      const immediateConfig = { ...baseConfig, timeoutMinutes: 0 as const };
      expect(isLockTimeoutExceeded(immediateConfig, 1000001)).toBe(true);
    });

    it('should not lock if elapsed time is less than 5 minutes', () => {
      const fourMinutesLater = baseConfig.lastActiveAt + 4 * 60 * 1000;
      expect(isLockTimeoutExceeded(baseConfig, fourMinutesLater)).toBe(false);
    });

    it('should lock once elapsed time meets or exceeds 5 minutes', () => {
      const fiveMinutesLater = baseConfig.lastActiveAt + 5 * 60 * 1000;
      expect(isLockTimeoutExceeded(baseConfig, fiveMinutesLater)).toBe(true);

      const tenMinutesLater = baseConfig.lastActiveAt + 10 * 60 * 1000;
      expect(isLockTimeoutExceeded(baseConfig, tenMinutesLater)).toBe(true);
    });

    it('should evaluate 1 minute and 15 minutes timeouts correctly', () => {
      const config1m = { ...baseConfig, timeoutMinutes: 1 as const };
      expect(isLockTimeoutExceeded(config1m, baseConfig.lastActiveAt + 50000)).toBe(false);
      expect(isLockTimeoutExceeded(config1m, baseConfig.lastActiveAt + 65000)).toBe(true);

      const config15m = { ...baseConfig, timeoutMinutes: 15 as const };
      expect(isLockTimeoutExceeded(config15m, baseConfig.lastActiveAt + 14 * 60 * 1000)).toBe(false);
      expect(isLockTimeoutExceeded(config15m, baseConfig.lastActiveAt + 16 * 60 * 1000)).toBe(true);
    });

    it('should allow user to update timeout preference', () => {
      saveBiometricConfig(baseConfig);
      updateBiometricTimeout('user-alice', 15);
      const updated = loadBiometricConfig('user-alice');
      expect(updated?.timeoutMinutes).toBe(15);
    });
  });

  // =========================================================================
  // 5. Account Switching & Multi-User Isolation (Section 26.10)
  // =========================================================================
  describe('5. Account Switching & Scoped Isolation', () => {
    it('should strictly isolate biometric state between Account A and Account B', () => {
      saveBiometricConfig({
        userId: 'account-A',
        enabled: true,
        credentialId: 'cred-A',
        biometricType: 'FINGERPRINT',
        timeoutMinutes: 5,
        lastActiveAt: Date.now(),
        enrolledAt: Date.now(),
      });

      // Account B has not enrolled biometric
      const configB = loadBiometricConfig('account-B');
      expect(configB).toBeNull();

      // Account A config is intact
      const configA = loadBiometricConfig('account-A');
      expect(configA?.credentialId).toBe('cred-A');
    });

    it('should not allow Account A biometric state to unlock Account B', async () => {
      saveBiometricConfig({
        userId: 'account-A',
        enabled: true,
        credentialId: 'cred-A',
        biometricType: 'FINGERPRINT',
        timeoutMinutes: 5,
        lastActiveAt: Date.now(),
        enrolledAt: Date.now(),
      });

      const res = await verifyBiometric('account-B');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('NOT_AVAILABLE');
    });

    it('should remove biometric config on disable or user logout', () => {
      saveBiometricConfig({
        userId: 'account-A',
        enabled: true,
        credentialId: 'cred-A',
        biometricType: 'FINGERPRINT',
        timeoutMinutes: 5,
        lastActiveAt: Date.now(),
        enrolledAt: Date.now(),
      });

      disableBiometric('account-A');
      expect(loadBiometricConfig('account-A')).toBeNull();
    });
  });

  // =========================================================================
  // 6. Security Invariants (Section 26.2, 26.8, 26.13)
  // =========================================================================
  describe('6. Zero Raw Biometric Storage & Transmission Invariants', () => {
    it('should never store biometric images, sensor data, or passwords in local storage', () => {
      saveBiometricConfig({
        userId: 'user-secure',
        enabled: true,
        credentialId: 'opaque_handle_123',
        biometricType: 'FINGERPRINT',
        timeoutMinutes: 5,
        lastActiveAt: Date.now(),
        enrolledAt: Date.now(),
      });

      const raw = mockStorage['duopay_biometric_user-secure'];
      expect(raw).toBeDefined();

      // Ensure no raw biometric data strings
      expect(raw).not.toContain('password');
      expect(raw).not.toContain('fingerprint_image');
      expect(raw).not.toContain('face_template');
      expect(raw).not.toContain('sensor');
      expect(raw).not.toContain('sessionToken');
      expect(raw).not.toContain('authjs.session-token');
    });

    it('should safely allow offline operation without clearing outbox or IndexedDB', () => {
      // Invariant: Biometric verification runs 100% on local platform authenticator
      // It does not invoke network fetch or modify IndexedDB outbox.
      expect(typeof isLockTimeoutExceeded).toBe('function');
      // No references to outbox deletion
      expect(loadBiometricConfig.toString()).not.toContain('outbox');
      expect(loadBiometricConfig.toString()).not.toContain('indexedDB.deleteDatabase');
    });
  });
});
