import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { RootStackParamList } from '../navigation/AuthNavigator';
import { getContacts } from '../services/contactsService';
import { auth } from '../services/firebase';
import { getHealthStatus } from '../services/relationshipUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const TIER_LABELS: Record<number, string> = { 1: 'T1', 2: 'T2', 3: 'T3', 4: 'T4' };
const TIER_COLORS: Record<number, string> = {
  1: '#7C3AED',
  2: '#2563EB',
  3: '#059669',
  4: '#D97706',
};
const HEALTH_COLORS = { green: '#22C55E', yellow: '#F59E0B', red: '#EF4444' };

function toJsDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  return new Date(value);
}

function toStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Parse a stored MM-DD birthday string into { month: 1-12, day: 1-31 } */
function parseBirthday(birthday: string | null | undefined): { month: number; day: number } | null {
  if (!birthday) return null;
  const match = birthday.match(/^(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { month: parseInt(match[1], 10), day: parseInt(match[2], 10) };
}

/** Days from today (start-of-day) until a future birthday occurrence (0–3). Returns null if not in window. */
function daysUntilBirthday(birthday: string | null | undefined, today: Date): number | null {
  const parsed = parseBirthday(birthday);
  if (!parsed) return null;
  const todayNorm = toStartOfDay(today);
  for (let offset = 0; offset <= 3; offset++) {
    const candidate = new Date(todayNorm);
    candidate.setDate(candidate.getDate() + offset);
    if (candidate.getMonth() + 1 === parsed.month && candidate.getDate() === parsed.day) {
      return offset;
    }
  }
  return null;
}

export default function HomeScreen({ navigation }: Props) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      setLoading(true);
      getContacts(userId).then((result: any) => {
        if (result.success) setContacts(result.data);
        setLoading(false);
      });
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const today = new Date();
  const todayNorm = toStartOfDay(today);

  // --- Section 1: Today's Birthdays (within next 3 days) ---
  const birthdayContacts = contacts
    .map((c) => ({ contact: c, daysAway: daysUntilBirthday(c.birthday, today) }))
    .filter((x) => x.daysAway !== null)
    .sort((a, b) => (a.daysAway as number) - (b.daysAway as number));

  // --- Section 2: Overdue contacts ---
  const overdueContacts = contacts
    .filter((c) => {
      const nextTouch = toJsDate(c.nextTouchDate);
      if (!nextTouch) return false;
      return toStartOfDay(nextTouch) < todayNorm;
    })
    .map((c) => {
      const nextTouch = toStartOfDay(toJsDate(c.nextTouchDate)!);
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysOverdue = Math.round((todayNorm.getTime() - nextTouch.getTime()) / msPerDay);
      return { contact: c, daysOverdue };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // --- Section 3: Health summary counts ---
  const healthCounts = { green: 0, yellow: 0, red: 0 };
  contacts.forEach((c) => {
    const nextTouch = toJsDate(c.nextTouchDate);
    if (!nextTouch) { healthCounts.green++; return; }
    try {
      const status = getHealthStatus(nextTouch) as 'green' | 'yellow' | 'red';
      healthCounts[status]++;
    } catch {
      healthCounts.green++;
    }
  });

  const goToProfile = (contactId: string) =>
    navigation.navigate('ContactProfile', { contactId });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Section 1: Birthdays ── */}
      <Text style={styles.sectionTitle}>🎂 Upcoming Birthdays</Text>
      {birthdayContacts.length === 0 ? (
        <Text style={styles.emptyText}>No birthdays in the next 3 days.</Text>
      ) : (
        birthdayContacts.map(({ contact, daysAway }) => (
          <Pressable
            key={contact.id}
            style={styles.card}
            onPress={() => goToProfile(contact.id)}
            android_ripple={{ color: '#f0f0f0' }}
          >
            <Text style={styles.cardName}>{contact.name}</Text>
            <Text style={styles.cardMeta}>
              {daysAway === 0 ? 'Today 🎉' : daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`}
            </Text>
          </Pressable>
        ))
      )}

      {/* ── Section 2: Overdue ── */}
      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>🔴 Overdue</Text>
      {overdueContacts.length === 0 ? (
        <Text style={styles.emptyText}>You're all caught up!</Text>
      ) : (
        overdueContacts.map(({ contact, daysOverdue }) => (
          <Pressable
            key={contact.id}
            style={styles.card}
            onPress={() => goToProfile(contact.id)}
            android_ripple={{ color: '#f0f0f0' }}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardName}>{contact.name}</Text>
              <View
                style={[
                  styles.tierBadge,
                  { backgroundColor: TIER_COLORS[contact.tier] ?? '#888' },
                ]}
              >
                <Text style={styles.tierBadgeText}>{TIER_LABELS[contact.tier] ?? '?'}</Text>
              </View>
            </View>
            <Text style={styles.overdueLabel}>
              {daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`}
            </Text>
          </Pressable>
        ))
      )}

      {/* ── Section 3: Network Health ── */}
      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>📊 Network Health</Text>
      <View style={styles.healthRow}>
        {(['green', 'yellow', 'red'] as const).map((status) => (
          <View key={status} style={styles.healthCard}>
            <View style={[styles.healthDot, { backgroundColor: HEALTH_COLORS[status] }]} />
            <Text style={styles.healthCount}>{healthCounts[status]}</Text>
            <Text style={styles.healthLabel}>
              {status === 'green' ? 'On track' : status === 'yellow' ? 'Due soon' : 'Overdue'}
            </Text>
          </View>
        ))}
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
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  sectionSpacing: {
    marginTop: 28,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  cardMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  overdueLabel: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  tierBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  healthRow: {
    flexDirection: 'row',
    gap: 10,
  },
  healthCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  healthDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  healthCount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  healthLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
