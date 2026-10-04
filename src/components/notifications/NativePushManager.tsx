"use client";

import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

export function NativePushManager() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Request permissions
    PushNotifications.requestPermissions().then((result) => {
      if (result.receive === 'granted') {
        PushNotifications.register();
      }
    });

    // On success
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Send token to our backend to store in PushDevice table
      try {
        await fetch('/api/notifications/device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token.value,
            platform: Capacitor.getPlatform(),
          }),
        });
      } catch (err) {
        console.error('Failed to save device token', err);
      }
    });

    // On error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // Notification received while app is active
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ', notification);
      // We can update local UI or show a toast
    });

    // Notification tapped (Deep Linking)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push action performed: ', action);
      
      const data = action.notification.data;
      if (data && data.url) {
        // Navigate internally securely
        const targetPath = new URL(data.url, window.location.origin).pathname;
        router.push(targetPath);
      }
    });

    return () => {
      try {
        PushNotifications.removeAllListeners().catch(() => {});
      } catch (e) {}
    };
  }, [router]);

  return null;
}
