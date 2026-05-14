import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// AsyncStorage key per contact: circle_followup_{contactId} → notif ID string
const storageKey = (contactId: string) => `circle_followup_${contactId}`;

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
 * Schedules a 48-hour follow-up reminder for a newly added Tier 4 contact.
 * Only schedules if the device has notification permission.
 * Cancels any previous follow-up notification for the same contact first.
 */
export async function scheduleFollowUpNotification(
  contactId: string,
  contactName: string
): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Cancel any existing follow-up for this contact before scheduling.
  await cancelFollowUpNotification(contactId);

  const fireAt = new Date(Date.now() + FORTY_EIGHT_HOURS_MS);

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Follow up with ${contactName} 👋`,
      body: "You added them 2 days ago. Have you had a chance to reach out yet?",
      data: { contactId, type: 'follow_up_48h' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });

  await AsyncStorage.setItem(storageKey(contactId), notifId);
}

/**
 * Cancels a pending 48-hour follow-up notification for a contact.
 * Call this when the user logs an interaction with the contact.
 */
export async function cancelFollowUpNotification(contactId: string): Promise<void> {
  try {
    const notifId = await AsyncStorage.getItem(storageKey(contactId));
    if (!notifId) return;
    await Notifications.cancelScheduledNotificationAsync(notifId);
    await AsyncStorage.removeItem(storageKey(contactId));
  } catch (err) {
    console.error(`[FollowUpNotif] Failed to cancel for contact ${contactId}:`, err);
  }
}
