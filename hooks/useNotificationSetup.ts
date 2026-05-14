import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { db } from '../services/firebase';

const PROMPTED_KEY = 'circle_notif_prompted';

/**
 * Requests notification permission once per install (tracked via AsyncStorage).
 * On grant: fetches the Expo push token and stores it to userSettings/{userId}.
 * On denial: shows a non-blocking alert explaining what the user will miss.
 *
 * Call this from the root navigator after the user is confirmed logged in.
 */
export function useNotificationSetup(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    async function setup() {
      // Only prompt once per app install.
      const alreadyPrompted = await AsyncStorage.getItem(PROMPTED_KEY);
      if (alreadyPrompted) return;

      // Check existing permission status before requesting.
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // Mark as prompted so we never ask again.
      await AsyncStorage.setItem(PROMPTED_KEY, 'true');

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Notifications are off',
          "You won't receive daily check-in reminders, birthday alerts, or overdue contact nudges. You can enable notifications in your device Settings at any time.",
          [{ text: 'Got it' }]
        );
        await setDoc(
          doc(db, 'userSettings', userId),
          { notificationsEnabled: false, pushToken: null, updatedAt: new Date() },
          { merge: true }
        );
        return;
      }

      // Fetch the Expo push token. Requires a projectId from EAS config.
      let pushToken: string | null = null;
      try {
        const projectId =
          Constants.easConfig?.projectId ??
          (Constants.expoConfig?.extra as any)?.eas?.projectId;

        if (projectId) {
          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
          pushToken = tokenData.data;
        } else {
          // Running in local dev without EAS — permission is recorded but no token yet.
          console.log('[Notifications] No EAS projectId found; push token skipped.');
        }
      } catch (err) {
        console.error('[Notifications] Failed to get push token:', err);
      }

      // Persist permission state + token to Firestore.
      await setDoc(
        doc(db, 'userSettings', userId),
        {
          notificationsEnabled: true,
          pushToken,
          platform: Platform.OS,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    setup().catch((err) => console.error('[Notifications] setup error:', err));
  }, [userId]);
}
