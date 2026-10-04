"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  BiometricType,
  LockTimeoutMinutes,
  BiometricConfig,
  BiometricAuthResult,
} from "@/lib/biometric/types";
import {
  checkBiometricAvailability,
  detectBiometricType,
  enrollBiometric,
  verifyBiometric,
  disableBiometric,
  updateBiometricTimeout,
  isLockTimeoutExceeded,
} from "@/lib/biometric/biometricService";
import {
  loadBiometricConfig,
  updateLastActive,
} from "@/lib/biometric/storage";
import { BiometricLockScreen } from "./BiometricLockScreen";
import { AppSwitcherPrivacyShield } from "./AppSwitcherPrivacyShield";

export interface BiometricContextValue {
  isBiometricAvailable: boolean;
  biometricType: BiometricType;
  label: string;
  isEnabled: boolean;
  isLocked: boolean;
  timeoutMinutes: LockTimeoutMinutes;
  enableBiometric: (userName?: string) => Promise<BiometricAuthResult>;
  disableBiometric: () => void;
  setTimeoutMinutes: (minutes: LockTimeoutMinutes) => void;
  lockAppNow: () => void;
  unlockWithBiometric: () => Promise<boolean>;
}

const BiometricContext = createContext<BiometricContextValue | null>(null);

export function useBiometricLock() {
  const ctx = useContext(BiometricContext);
  if (!ctx) {
    throw new Error("useBiometricLock must be used within BiometricLockProvider");
  }
  return ctx;
}

interface BiometricLockProviderProps {
  userId?: string;
  children: React.ReactNode;
}

export function BiometricLockProvider({
  userId,
  children,
}: BiometricLockProviderProps) {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("BIOMETRIC");
  const [label, setLabel] = useState<string>("Biometric Unlock");
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [timeoutMinutes, setTimeoutState] = useState<LockTimeoutMinutes>(5);
  const [isAppInBackground, setIsAppInBackground] = useState<boolean>(false);

  const lastActiveThrottleRef = useRef<number>(Date.now());
  const initialLockCheckedRef = useRef<boolean>(false);

  // 1. Initial hardware availability and label detection
  useEffect(() => {
    try {
      const detected = detectBiometricType();
      setBiometricType(detected.type);
      setLabel(detected.label);

      checkBiometricAvailability()
        .then((res) => {
          setIsAvailable(res.isAvailable);
          if (res.label) setLabel(res.label);
        })
        .catch((err) => {
          console.warn("[Biometric] Availability check non-blocking error:", err);
          setIsAvailable(false);
        });
    } catch (e) {
      // Non-blocking: DuoPay must always start
      console.warn("[Biometric] Init check error:", e);
    }
  }, []);

  // 2. User config check & Cold Start Lock enforcement
  useEffect(() => {
    if (!userId) {
      setIsEnabled(false);
      setIsLocked(false);
      return;
    }

    try {
      const config = loadBiometricConfig(userId);
      if (config && config.enabled) {
        setIsEnabled(true);
        setTimeoutState(config.timeoutMinutes);

        // Cold start lock: Lock on initial load if biometric is active
        if (!initialLockCheckedRef.current) {
          initialLockCheckedRef.current = true;
          setIsLocked(true);
        }
      } else {
        setIsEnabled(false);
        setIsLocked(false);
      }
    } catch (err) {
      console.warn("[Biometric] Non-blocking config load error:", err);
      setIsLocked(false);
    }
  }, [userId]);

  // 3. User interaction listener (refreshes lastActive without interrupting user)
  useEffect(() => {
    if (!userId || !isEnabled || isLocked) return;

    const handleUserInteraction = () => {
      const now = Date.now();
      // Throttle to once every 10 seconds
      if (now - lastActiveThrottleRef.current > 10000) {
        lastActiveThrottleRef.current = now;
        updateLastActive(userId, now);
      }
    };

    window.addEventListener("pointerdown", handleUserInteraction, { passive: true });
    window.addEventListener("keydown", handleUserInteraction, { passive: true });
    window.addEventListener("touchstart", handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
    };
  }, [userId, isEnabled, isLocked]);

  // 4. Background / App Switcher & Resume Timeout Handler
  useEffect(() => {
    if (!userId || !isEnabled) return;

    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;

      if (document.visibilityState === "hidden") {
        // App moving to background: show privacy shield immediately & record time
        setIsAppInBackground(true);
        const now = Date.now();
        lastActiveThrottleRef.current = now;
        updateLastActive(userId, now);
      } else if (document.visibilityState === "visible") {
        // App returning to foreground: remove privacy shield and check lock timeout
        setIsAppInBackground(false);
        const config = loadBiometricConfig(userId);
        if (config && isLockTimeoutExceeded(config, Date.now())) {
          setIsLocked(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, isEnabled]);

  // 5. Verification Handler
  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    try {
      const res = await verifyBiometric(userId);
      if (res.success) {
        setIsLocked(false);
        lastActiveThrottleRef.current = Date.now();
        return true;
      }
      return false;
    } catch (e) {
      console.warn("[Biometric] Unlock error:", e);
      return false;
    }
  }, [userId]);

  // 6. Enrollment Handler
  const handleEnableBiometric = useCallback(
    async (userName: string = "DuoPay User"): Promise<BiometricAuthResult> => {
      if (!userId) {
        return { success: false, error: "Authentication required", errorCode: "NOT_AVAILABLE" };
      }
      const res = await enrollBiometric(userId, userName);
      if (res.success) {
        setIsEnabled(true);
        setIsLocked(false);
        const conf = loadBiometricConfig(userId);
        if (conf) setTimeoutState(conf.timeoutMinutes);
      }
      return res;
    },
    [userId]
  );

  // 7. Disable Handler
  const handleDisableBiometric = useCallback(() => {
    if (!userId) return;
    disableBiometric(userId);
    setIsEnabled(false);
    setIsLocked(false);
  }, [userId]);

  // 8. Timeout Update Handler
  const handleSetTimeoutMinutes = useCallback(
    (minutes: LockTimeoutMinutes) => {
      if (!userId) return;
      updateBiometricTimeout(userId, minutes);
      setTimeoutState(minutes);
    },
    [userId]
  );

  // 9. Manual Lock Handler
  const handleLockNow = useCallback(() => {
    if (isEnabled) {
      setIsLocked(true);
    }
  }, [isEnabled]);

  // 10. Fallback Login Handler
  const handleFallbackLogin = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/login?fallback=biometric";
    }
  }, []);

  const value: BiometricContextValue = {
    isBiometricAvailable: isAvailable,
    biometricType,
    label,
    isEnabled,
    isLocked,
    timeoutMinutes,
    enableBiometric: handleEnableBiometric,
    disableBiometric: handleDisableBiometric,
    setTimeoutMinutes: handleSetTimeoutMinutes,
    lockAppNow: handleLockNow,
    unlockWithBiometric,
  };

  return (
    <BiometricContext.Provider value={value}>
      {/* Background / App Switcher Privacy Shield (hides financial data in OS multitasking) */}
      {isEnabled && isAppInBackground && <AppSwitcherPrivacyShield />}

      {/* Lock Screen: Renders INSTEAD of children when locked to guarantee no sensitive data leaks */}
      {isEnabled && isLocked ? (
        <BiometricLockScreen
          label={label}
          onUnlock={unlockWithBiometric}
          onFallbackLogin={handleFallbackLogin}
        />
      ) : (
        children
      )}
    </BiometricContext.Provider>
  );
}
