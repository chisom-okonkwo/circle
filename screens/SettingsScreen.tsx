import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { signOut } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    cancelAllBirthdayNotifications,
    scheduleBirthdayNotifications,
} from '../services/birthdayNotifications';
import { auth } from '../services/firebase';
import {
    NotifTime,
    UserSettings,
    getUserSettings,
    updateUserSettings,
} from '../services/userSettingsService';

type ActivePicker = 'digest' | 'quietStart' | 'quietEnd' | null;

function formatTime({ hour, minute }: NotifTime): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

function notifTimeToDate({ hour, minute }: NotifTime): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function dateToNotifTime(d: Date): NotifTime {
  return { hour: d.getHours(), minute: d.getMinutes() };
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingNotifs, setTogglingNotifs] = useState(false);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [draftTime, setDraftTime] = useState<Date | null>(null);

  const userId = auth.currentUser?.uid;
  const email = auth.currentUser?.email ?? '—';

  const loadSettings = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    getUserSettings(userId)
      .then((s) => {
        setSettings(s);
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't load your settings. Check your connection and try again.");
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ── Notifications toggle ───────────────────────────────────────────────

  async function handleNotificationsToggle(enabled: boolean) {
    if (!userId || !settings) return;

    // Optimistic update.
    setSettings((prev) => (prev ? { ...prev, notificationsEnabled: enabled } : prev));
    setTogglingNotifs(true);

    try {
      await updateUserSettings(userId, { notificationsEnabled: enabled });

      if (enabled) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Notifications blocked',
            'Please enable notifications for Circle in your device Settings, then try again.',
          );
          // Revert.
          setSettings((prev) => (prev ? { ...prev, notificationsEnabled: false } : prev));
          await updateUserSettings(userId, { notificationsEnabled: false });
          return;
        }
        await scheduleBirthdayNotifications(userId, settings.digestTime);
      } else {
        // Cancel all OS-level notifications, then clean up AsyncStorage keys.
        await Notifications.cancelAllScheduledNotificationsAsync();
        await cancelAllBirthdayNotifications(userId);
      }
    } catch (err) {
      console.error('[Settings] notifications toggle error:', err);
    } finally {
      setTogglingNotifs(false);
    }
  }

  // ── Time picker helpers ────────────────────────────────────────────────

  function openPicker(which: ActivePicker) {
    if (!which || !settings) return;
    const current =
      which === 'digest'
        ? settings.digestTime
        : which === 'quietStart'
        ? settings.quietHoursStart
        : settings.quietHoursEnd;
    setDraftTime(notifTimeToDate(current));
    setActivePicker(which);
  }

  function onPickerChange(_event: any, selected?: Date) {
    if (Platform.OS === 'android') {
      // Android picker fires once on confirm/dismiss.
      setActivePicker(null);
      if (selected && activePicker) {
        commitTime(activePicker, dateToNotifTime(selected));
      }
    } else {
      // iOS spinner fires on every scroll tick — only update local draft.
      if (selected) setDraftTime(selected);
    }
  }

  // iOS only: called when user taps "Done" below the spinner.
  function handlePickerDone() {
    if (draftTime && activePicker) {
      commitTime(activePicker, dateToNotifTime(draftTime));
    }
    setActivePicker(null);
    setDraftTime(null);
  }

  async function commitTime(which: ActivePicker, newTime: NotifTime) {
    if (!userId || !settings || !which) return;

    const fieldKey =
      which === 'digest'
        ? 'digestTime'
        : which === 'quietStart'
        ? 'quietHoursStart'
        : 'quietHoursEnd';

    const updated: UserSettings = { ...settings, [fieldKey]: newTime };
    setSettings(updated);

    try {
      await updateUserSettings(userId, { [fieldKey]: newTime });

      // Reschedule birthday notifications at the (potentially new) digest time.
      // Quiet-hour changes are saved to Firestore for the Cloud Function
      // but do not alter local notification timing.
      if (settings.notificationsEnabled) {
        const digestTime = which === 'digest' ? newTime : settings.digestTime;
        await scheduleBirthdayNotifications(userId, digestTime);
      }
    } catch (err) {
      console.error('[Settings] time commit error:', err);
    }
  }

  // ── Sign out ───────────────────────────────────────────────────────────

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () =>
          signOut(auth).catch(() => Alert.alert('Error', 'Could not sign out. Try again.')),
      },
    ]);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (error || !settings) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 36 }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Couldn't load settings</Text>
        <Text style={styles.errorBody}>
          Check your connection and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSettings} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const notifDisabled = !settings.notificationsEnabled;
  const pickerValue = draftTime ?? new Date();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Notifications section ── */}
      <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
      <View style={styles.card}>

        {/* Enable toggle */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Enable notifications</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: '#D1D5DB', true: '#7C3AED' }}
            thumbColor="#fff"
            disabled={togglingNotifs}
          />
        </View>

        <View style={styles.divider} />

        {/* Daily digest time */}
        <Pressable
          style={[styles.row, notifDisabled && styles.rowDisabled]}
          onPress={() => !notifDisabled && openPicker(activePicker === 'digest' ? null : 'digest')}
          disabled={notifDisabled}
        >
          <Text style={[styles.rowLabel, notifDisabled && styles.textMuted]}>
            Daily digest time
          </Text>
          <Text style={[styles.rowValue, notifDisabled && styles.textMuted]}>
            {formatTime(settings.digestTime)}
          </Text>
        </Pressable>
        {activePicker === 'digest' && Platform.OS === 'ios' && (
          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={pickerValue}
              mode="time"
              display="spinner"
              onChange={onPickerChange}
              style={styles.picker}
            />
            <TouchableOpacity style={styles.doneButton} onPress={handlePickerDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider} />

        {/* Quiet hours start */}
        <Pressable
          style={[styles.row, notifDisabled && styles.rowDisabled]}
          onPress={() => !notifDisabled && openPicker(activePicker === 'quietStart' ? null : 'quietStart')}
          disabled={notifDisabled}
        >
          <View style={styles.rowLabelGroup}>
            <Text style={[styles.rowLabel, notifDisabled && styles.textMuted]}>
              Quiet hours start
            </Text>
            <Text style={[styles.rowHint, notifDisabled && styles.textMuted]}>
              No notifications during this window
            </Text>
          </View>
          <Text style={[styles.rowValue, notifDisabled && styles.textMuted]}>
            {formatTime(settings.quietHoursStart)}
          </Text>
        </Pressable>
        {activePicker === 'quietStart' && Platform.OS === 'ios' && (
          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={pickerValue}
              mode="time"
              display="spinner"
              onChange={onPickerChange}
              style={styles.picker}
            />
            <TouchableOpacity style={styles.doneButton} onPress={handlePickerDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider} />

        {/* Quiet hours end */}
        <Pressable
          style={[styles.row, notifDisabled && styles.rowDisabled]}
          onPress={() => !notifDisabled && openPicker(activePicker === 'quietEnd' ? null : 'quietEnd')}
          disabled={notifDisabled}
        >
          <View style={styles.rowLabelGroup}>
            <Text style={[styles.rowLabel, notifDisabled && styles.textMuted]}>
              Quiet hours end
            </Text>
            <Text style={[styles.rowHint, notifDisabled && styles.textMuted]}>
              Notifications resume after this time
            </Text>
          </View>
          <Text style={[styles.rowValue, notifDisabled && styles.textMuted]}>
            {formatTime(settings.quietHoursEnd)}
          </Text>
        </Pressable>
        {activePicker === 'quietEnd' && Platform.OS === 'ios' && (
          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={pickerValue}
              mode="time"
              display="spinner"
              onChange={onPickerChange}
              style={styles.picker}
            />
            <TouchableOpacity style={styles.doneButton} onPress={handlePickerDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Android: single modal picker rendered outside the card */}
      {Platform.OS === 'android' && activePicker !== null && (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          display="default"
          onChange={onPickerChange}
        />
      )}

      {/* ── Account section ── */}
      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>ACCOUNT</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={[styles.rowValue, styles.emailValue]} numberOfLines={1}>
            {email}
          </Text>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionSpacing: {
    marginTop: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowLabelGroup: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  rowHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  textMuted: {
    color: '#9CA3AF',
  },
  rowValue: {
    fontSize: 15,
    color: '#7C3AED',
    fontWeight: '500',
  },
  emailValue: {
    color: '#374151',
    fontWeight: '400',
    flexShrink: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginLeft: 16,
  },
  pickerWrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  picker: {
    marginHorizontal: 8,
  },
  doneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7C3AED',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#EF4444',
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
