import { BiometricConfig, LockTimeoutMinutes } from './types';

const STORAGE_PREFIX = 'duopay_biometric_';

/**
 * Loads biometric config strictly scoped to the given userId.
 * Prevents Account A from accessing or unlocking Account B.
 */
export function loadBiometricConfig(userId: string): BiometricConfig | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.userId === userId && typeof parsed.enabled === 'boolean') {
      return parsed as BiometricConfig;
    }
  } catch (e) {
    console.error('[Biometric Storage] Error loading config:', e);
  }
  return null;
}

/**
 * Saves minimal biometric configuration locally.
 * Invariant: Never stores raw biometric data, sensor data, or session credentials.
 */
export function saveBiometricConfig(config: BiometricConfig): void {
  if (typeof window === 'undefined' || !config.userId) return;
  try {
    const safeData: BiometricConfig = {
      userId: config.userId,
      enabled: Boolean(config.enabled),
      credentialId: String(config.credentialId),
      biometricType: config.biometricType,
      timeoutMinutes: (config.timeoutMinutes ?? 5) as LockTimeoutMinutes,
      lastActiveAt: Number(config.lastActiveAt) || Date.now(),
      enrolledAt: Number(config.enrolledAt) || Date.now(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}${config.userId}`, JSON.stringify(safeData));
  } catch (e) {
    console.error('[Biometric Storage] Error saving config:', e);
  }
}

/**
 * Removes local biometric configuration for a user (e.g. on disable or logout).
 */
export function removeBiometricConfig(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch (e) {
    console.error('[Biometric Storage] Error removing config:', e);
  }
}

/**
 * Updates last active timestamp for timeout calculation.
 */
export function updateLastActive(userId: string, timestamp: number = Date.now()): void {
  if (typeof window === 'undefined' || !userId) return;
  const config = loadBiometricConfig(userId);
  if (config) {
    config.lastActiveAt = timestamp;
    saveBiometricConfig(config);
  }
}
