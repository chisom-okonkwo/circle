import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getContacts } from './contactsService';
import type { NotifTime } from './userSettingsService';

// AsyncStorage key per contact: circle_bday_{contactId} → JSON string[]  of notif IDs
const storageKey = (contactId: string) => `circle_bday_${contactId}`;

/** Parse MM-DD into { month: 1-12, day: 1-31 } or null. */
function parseBirthday(birthday: string | null | undefined): { month: number; day: number } | null {
  if (!birthday) return null;
  const match = birthday.match(/^(\d{2})-(\d{2})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

/**
 * Returns the Date for the birthday at the given hour:minute local time.
 * If today is already past that time, returns next year's occurrence.
 */
function nextBirthdayAtTime(month: number, day: number, hour: number, minute: number): Date {
  const now = new Date();
  const year = now.getFullYear();

  const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (candidate > now) return candidate;

  // Already passed this year — use next year.
  return new Date(year + 1, month - 1, day, hour, minute, 0, 0);
}

/** Cancel all stored notification IDs for a specific contact. */
export async function cancelBirthdayNotifications(contactId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(contactId));
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    await AsyncStorage.removeItem(storageKey(contactId));
  } catch (err) {
    console.error(`[BirthdayNotifs] Failed to cancel for contact ${contactId}:`, err);
  }
}

/** Schedule birthday notifications for one contact. Cancels any existing ones first. */
async function scheduleForContact(contact: any, notifTime: NotifTime = { hour: 8, minute: 0 }): Promise<void> {
  const parsed = parseBirthday(contact.birthday);
  if (!parsed) return;

  // Cancel existing notifications for this contact before rescheduling.
  await cancelBirthdayNotifications(contact.id);

  const birthdayAt8am = nextBirthdayAtTime(parsed.month, parsed.day, notifTime.hour, notifTime.minute);
  const reminderAt8am = new Date(birthdayAt8am.getTime() - 3 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const scheduledIds: string[] = [];

  // 3-day reminder (only if still in the future).
  if (reminderAt8am > now) {
    const reminderId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${contact.name}'s birthday is in 3 days 🎂`,
        body: 'Now is a great time to reach out or plan something.',
        data: { contactId: contact.id, type: 'birthday_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderAt8am,
      },
    });
    scheduledIds.push(reminderId);
  }

  // Birthday day notification.
  if (birthdayAt8am > now) {
    const birthdayId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Today is ${contact.name}'s birthday! 🎉`,
        body: 'Wish them a happy birthday.',
        data: { contactId: contact.id, type: 'birthday_day' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: birthdayAt8am,
      },
    });
    scheduledIds.push(birthdayId);
  }

  if (scheduledIds.length > 0) {
    await AsyncStorage.setItem(storageKey(contact.id), JSON.stringify(scheduledIds));
  }
}

/**
 * Fetches all contacts for a user and schedules birthday notifications for each
 * contact that has a birthday set. Safe to call on every login — cancels and
 * reschedules so dates are always correct.
 * @param notifTime Optional time of day for notifications. Defaults to 08:00.
 */
export async function scheduleBirthdayNotifications(
  userId: string,
  notifTime?: NotifTime
): Promise<void> {
  // Verify permission before doing any work.
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const result = await getContacts(userId) as any;
  if (!result.success) {
    console.error('[BirthdayNotifs] Failed to fetch contacts:', result.error);
    return;
  }

  const contacts: any[] = result.data;
  const withBirthdays = contacts.filter((c) => c.birthday);

  // Process sequentially to avoid hammering the scheduler.
  for (const contact of withBirthdays) {
    try {
      await scheduleForContact(contact, notifTime);
    } catch (err) {
      console.error(`[BirthdayNotifs] Failed to schedule for ${contact.name}:`, err);
    }
  }
}

/**
 * Cancel ALL birthday notifications across all contacts.
 * Used when the user disables all notifications.
 */
export async function cancelAllBirthdayNotifications(userId: string): Promise<void> {
  const result = await getContacts(userId) as any;
  if (!result.success) return;
  const contacts: any[] = result.data;
  for (const contact of contacts) {
    try {
      await cancelBirthdayNotifications(contact.id);
    } catch { /* best effort */ }
  }
}
