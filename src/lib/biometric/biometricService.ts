import { Capacitor } from '@capacitor/core';
import {
  BiometricType,
  BiometricAvailability,
  BiometricConfig,
  BiometricAuthResult,
  LockTimeoutMinutes,
} from './types';
import {
  loadBiometricConfig,
  saveBiometricConfig,
  removeBiometricConfig,
  updateLastActive,
} from './storage';

/**
 * Base64 conversion helpers for WebAuthn ArrayBuffers
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Detects device platform and returns the appropriate human-readable biometric label.
 * Adapts dynamically across iOS, Android, Windows, macOS, and Linux/Web.
 */
export function detectBiometricType(): { type: BiometricType; label: string } {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { type: 'BIOMETRIC', label: 'Biometric Unlock' };
  }

  // Capacitor native check
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      return { type: 'FACE_ID', label: 'Face ID / Touch ID' };
    }
    if (platform === 'android') {
      return { type: 'FINGERPRINT', label: 'Fingerprint / Face Unlock' };
    }
  }

  const userAgent = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isMac = /Macintosh/i.test(userAgent) && !isIOS;
  const isAndroid = /Android/i.test(userAgent);
  const isWindows = /Windows/i.test(userAgent);

  if (isIOS) {
    return { type: 'FACE_ID', label: 'Face ID / Touch ID' };
  }
  if (isAndroid) {
    return { type: 'FINGERPRINT', label: 'Fingerprint / Face Unlock' };
  }
  if (isMac) {
    return { type: 'TOUCH_ID', label: 'Touch ID' };
  }
  if (isWindows) {
    return { type: 'WINDOWS_HELLO', label: 'Windows Hello / Fingerprint' };
  }

  return { type: 'BIOMETRIC', label: 'Biometric Unlock' };
}

/**
 * Verifies whether the current device supports hardware biometric authentication
 * via WebAuthn platform authenticators (Windows Hello, Touch ID, Android Biometrics)
 * or native Capacitor biometric plugins.
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  const { type, label } = detectBiometricType();

  if (typeof window === 'undefined') {
    return { isAvailable: false, biometricType: type, label, error: 'Server environment' };
  }

  // 1. Check Capacitor native plugins if available on window
  const nativePlugin = (window as any).Capacitor?.Plugins?.BiometricAuth || (window as any).Capacitor?.Plugins?.Biometrics;
  if (Capacitor.isNativePlatform() && nativePlugin) {
    try {
      const res = await nativePlugin.isAvailable();
      return {
        isAvailable: Boolean(res?.has || res?.isAvailable),
        biometricType: type,
        label,
      };
    } catch (e: any) {
      console.warn('[Biometric] Native check error:', e);
    }
  }

  // 2. WebAuthn Platform Authenticator check (W3C standard supported across modern mobile & desktop)
  try {
    if (
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return {
        isAvailable: available,
        biometricType: type,
        label,
        error: available ? undefined : 'No platform biometric authenticator found on this device',
      };
    }
  } catch (err: any) {
    return {
      isAvailable: false,
      biometricType: type,
      label,
      error: err?.message || 'Biometrics not supported on this browser',
    };
  }

  return {
    isAvailable: false,
    biometricType: type,
    label,
    error: 'Biometric authentication is not supported on this browser or device',
  };
}

/**
 * Enrolls local device biometric authentication for the current authenticated user.
 * Prompts the operating system's native biometric prompt (Fingerprint / Face ID / Windows Hello).
 * DuoPay NEVER receives biometric sensor data or templates; only a platform credential handle.
 */
export async function enrollBiometric(
  userId: string,
  userName: string = 'DuoPay User'
): Promise<BiometricAuthResult> {
  if (!userId) {
    return { success: false, error: 'User must be authenticated', errorCode: 'NOT_AVAILABLE' };
  }

  const availability = await checkBiometricAvailability();
  if (!availability.isAvailable) {
    return {
      success: false,
      error: availability.error || 'Biometric hardware unavailable',
      errorCode: 'NOT_AVAILABLE',
    };
  }

  // Check Capacitor native plugin first
  const nativePlugin = (window as any).Capacitor?.Plugins?.BiometricAuth || (window as any).Capacitor?.Plugins?.Biometrics;
  if (Capacitor.isNativePlatform() && nativePlugin) {
    try {
      await nativePlugin.verify({
        reason: 'Enroll device biometric for DuoPay',
        title: 'DuoPay Biometric Setup',
      });
      // Save local config
      saveBiometricConfig({
        userId,
        enabled: true,
        credentialId: 'native_enrolled_' + Date.now(),
        biometricType: availability.biometricType,
        timeoutMinutes: 5,
        lastActiveAt: Date.now(),
        enrolledAt: Date.now(),
      });
      return { success: true };
    } catch (err: any) {
      const isCancelled = err?.message?.toLowerCase().includes('cancel') || err?.code === 'USER_CANCELLED';
      return {
        success: false,
        cancelled: isCancelled,
        error: err?.message || 'Biometric enrollment failed',
        errorCode: isCancelled ? 'USER_CANCELLED' : 'FAILED',
      };
    }
  }

  // WebAuthn enrollment
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userBuffer = new TextEncoder().encode(userId);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'DuoPay',
        id: window.location.hostname,
      },
      user: {
        id: userBuffer,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: 'No credential returned', errorCode: 'FAILED' };
    }

    const credentialId = bufferToBase64(credential.rawId);

    saveBiometricConfig({
      userId,
      enabled: true,
      credentialId,
      biometricType: availability.biometricType,
      timeoutMinutes: 5,
      lastActiveAt: Date.now(),
      enrolledAt: Date.now(),
    });

    return { success: true };
  } catch (err: any) {
    console.warn('[Biometric Enrollment] Error:', err);
    const isCancelled =
      err?.name === 'NotAllowedError' ||
      err?.name === 'AbortError' ||
      err?.message?.toLowerCase().includes('cancel');

    return {
      success: false,
      cancelled: isCancelled,
      error: isCancelled ? 'Biometric setup was cancelled' : err?.message || 'Biometric setup failed',
      errorCode: isCancelled ? 'USER_CANCELLED' : 'FAILED',
    };
  }
}

/**
 * Prompts the device OS to verify the user's biometric identity to unlock the app locally.
 */
export async function verifyBiometric(userId: string): Promise<BiometricAuthResult> {
  const config = loadBiometricConfig(userId);
  if (!config || !config.enabled) {
    return { success: false, error: 'Biometric unlock is not enabled', errorCode: 'NOT_AVAILABLE' };
  }

  // Check Capacitor native plugin
  const nativePlugin = (window as any).Capacitor?.Plugins?.BiometricAuth || (window as any).Capacitor?.Plugins?.Biometrics;
  if (Capacitor.isNativePlatform() && nativePlugin) {
    try {
      await nativePlugin.verify({
        reason: 'Unlock DuoPay',
        title: 'DuoPay Biometric Unlock',
      });
      updateLastActive(userId, Date.now());
      return { success: true };
    } catch (err: any) {
      const isCancelled = err?.message?.toLowerCase().includes('cancel') || err?.code === 'USER_CANCELLED';
      return {
        success: false,
        cancelled: isCancelled,
        error: isCancelled ? 'Unlock cancelled' : err?.message || 'Biometric verification failed',
        errorCode: isCancelled ? 'USER_CANCELLED' : 'FAILED',
      };
    }
  }

  // WebAuthn verification
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credentialIdBuffer = base64ToBuffer(config.credentialId);

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: credentialIdBuffer,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential;

    if (assertion) {
      updateLastActive(userId, Date.now());
      return { success: true };
    }

    return { success: false, error: 'Verification failed', errorCode: 'FAILED' };
  } catch (err: any) {
    console.warn('[Biometric Verification] Error:', err);
    const isCancelled =
      err?.name === 'NotAllowedError' ||
      err?.name === 'AbortError' ||
      err?.message?.toLowerCase().includes('cancel');

    const isInvalid =
      err?.name === 'InvalidStateError' ||
      err?.message?.toLowerCase().includes('not found') ||
      err?.message?.toLowerCase().includes('credential');

    return {
      success: false,
      cancelled: isCancelled,
      error: isCancelled ? 'Biometric prompt was cancelled' : err?.message || 'Biometric authentication failed',
      errorCode: isCancelled ? 'USER_CANCELLED' : isInvalid ? 'CREDENTIAL_INVALID' : 'FAILED',
    };
  }
}

/**
 * Disables local biometric unlock for the user.
 */
export function disableBiometric(userId: string): void {
  removeBiometricConfig(userId);
}

/**
 * Updates lock timeout preference (0 = immediately, 1 min, 5 min, 15 min).
 */
export function updateBiometricTimeout(userId: string, timeoutMinutes: LockTimeoutMinutes): void {
  const config = loadBiometricConfig(userId);
  if (config) {
    config.timeoutMinutes = timeoutMinutes;
    saveBiometricConfig(config);
  }
}

/**
 * Checks whether the app has exceeded the lock timeout since last active.
 */
export function isLockTimeoutExceeded(config: BiometricConfig, currentTime: number = Date.now()): boolean {
  if (!config.enabled) return false;
  if (config.timeoutMinutes === 0) return true; // Lock immediately on background/resume
  const elapsedMs = currentTime - config.lastActiveAt;
  const timeoutMs = config.timeoutMinutes * 60 * 1000;
  return elapsedMs >= timeoutMs;
}
