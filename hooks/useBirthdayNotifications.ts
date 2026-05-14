import { useEffect } from 'react';
import { scheduleBirthdayNotifications } from '../services/birthdayNotifications';

/**
 * Schedules (or reschedules) birthday notifications for all contacts
 * whenever the user logs in. Safe to call on every login — existing
 * notifications are cancelled before rescheduling.
 */
export function useBirthdayNotifications(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    scheduleBirthdayNotifications(userId).catch((err) =>
      console.error('[useBirthdayNotifications]', err)
    );
  }, [userId]);
}
