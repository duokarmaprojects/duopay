/**
 * DuoPay Biometric Security Types
 * Local device biometric unlock model (WebAuthn / Platform Authenticator & Native)
 */

export type BiometricType = 
  | 'FINGERPRINT' 
  | 'FACE_ID' 
  | 'TOUCH_ID' 
  | 'WINDOWS_HELLO' 
  | 'BIOMETRIC';

export type LockTimeoutMinutes = 0 | 1 | 5 | 15;

export interface BiometricAvailability {
  isAvailable: boolean;
  biometricType: BiometricType;
  label: string; // e.g. "Fingerprint / Face Unlock", "Face ID / Touch ID", "Windows Hello"
  error?: string;
}

export interface BiometricConfig {
  userId: string;
  enabled: boolean;
  credentialId: string; // Base64 opaque platform credential ID
  biometricType: BiometricType;
  timeoutMinutes: LockTimeoutMinutes;
  lastActiveAt: number;
  enrolledAt: number;
}

export interface BiometricAuthResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  errorCode?: 
    | 'NOT_AVAILABLE' 
    | 'USER_CANCELLED' 
    | 'FAILED' 
    | 'CREDENTIAL_INVALID' 
    | 'LOCKOUT' 
    | 'UNKNOWN';
}
