import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface NotifTime {
  hour: number;
  minute: number;
}

export interface UserSettings {
  notificationsEnabled: boolean;
  pushToken: string | null;
  digestTime: NotifTime;
  quietHoursStart: NotifTime;
  quietHoursEnd: NotifTime;
  onboardingComplete: boolean;
}

export const DEFAULT_DIGEST_TIME: NotifTime = { hour: 8, minute: 0 };
export const DEFAULT_QUIET_START: NotifTime = { hour: 22, minute: 0 };
export const DEFAULT_QUIET_END: NotifTime = { hour: 7, minute: 0 };

/** Load settings for a user. Returns defaults for any field not yet set in Firestore. */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const snap = await getDoc(doc(db, 'userSettings', userId));
  const data = snap.exists() ? snap.data() : {};
  return {
    notificationsEnabled: data.notificationsEnabled ?? true,
    pushToken: data.pushToken ?? null,
    digestTime: data.digestTime ?? DEFAULT_DIGEST_TIME,
    quietHoursStart: data.quietHoursStart ?? DEFAULT_QUIET_START,
    quietHoursEnd: data.quietHoursEnd ?? DEFAULT_QUIET_END,
    onboardingComplete: data.onboardingComplete ?? false,
  };
}

/** Merge-update specific fields in userSettings/{userId}. */
export async function updateUserSettings(
  userId: string,
  partial: Partial<Omit<UserSettings, 'pushToken'>>
): Promise<void> {
  await setDoc(
    doc(db, 'userSettings', userId),
    { ...partial, updatedAt: new Date() },
    { merge: true }
  );
}
