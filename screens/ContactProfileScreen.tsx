import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RootStackParamList } from '../navigation/AuthNavigator';
import { getContactById } from '../services/contactsService';
import { auth } from '../services/firebase';
import { getInteractionsByContact } from '../services/interactionsService';
import { getHealthStatus } from '../services/relationshipUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactProfile'>;

const TIER_LABELS: Record<number, string> = { 1: 'T1', 2: 'T2', 3: 'T3', 4: 'T4' };
const TIER_NAMES: Record<number, string> = {
  1: 'Inner Circle',
  2: 'Close Circle',
  3: 'Warm Network',
  4: 'Loose Ties',
};
const TIER_COLORS: Record<number, string> = {
  1: '#7C3AED',
  2: '#2563EB',
  3: '#059669',
  4: '#D97706',
};
const HEALTH_COLORS: Record<string, string> = {
  green: '#22C55E',
  yellow: '#F59E0B',
  red: '#EF4444',
};
const HEALTH_LABELS: Record<string, string> = {
  green: 'On track',
  yellow: 'Due soon',
  red: 'Overdue',
};

const TYPE_LABELS: Record<string, string> = {
  call: '📞 Call',
  text: '💬 Text',
  'in-person': '🤝 In Person',
  'voice-note': '🎙 Voice Note',
  social: '📱 Social Media',
  other: '· Other',
};

const INITIATED_LABELS: Record<string, string> = {
  me: 'You initiated',
  them: 'They initiated',
  mutual: 'Mutual',
};

function toJsDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null) {
    if (typeof (value as any).toDate === 'function') return (value as any).toDate();
    if ((value as any).seconds !== undefined) return new Date((value as any).seconds * 1000);
  }
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value: unknown): string {
  const d = toJsDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ContactProfileScreen({ route, navigation }: Props) {
  const { contactId } = route.params;
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contactError, setContactError] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(true);
  const [interactionsError, setInteractionsError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadContact = useCallback(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    setLoading(true);
    setContactError(null);
    getContactById(userId, contactId).then((result) => {
      if (result.success && result.data) {
        setContact(result.data);
      } else if (!result.success) {
        setContactError("We couldn't load this contact. Check your connection and try again.");
      }
      setLoading(false);
    });
  }, [contactId]);

  const loadInteractions = useCallback(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    setInteractionsLoading(true);
    setInteractionsError(null);
    setShowAll(false);
    getInteractionsByContact(userId, contactId).then((result: any) => {
      if (result.success) {
        setInteractions(result.data);
      } else {
        setInteractionsError("Couldn't load interaction history.");
      }
      setInteractionsLoading(false);
    });
  }, [contactId]);

  useFocusEffect(loadContact);
  useFocusEffect(loadInteractions);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (contactError) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 36 }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorBody}>{contactError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadContact} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Contact not found.</Text>
      </View>
    );
  }

  const nextTouch = toJsDate(contact.nextTouchDate);
  const health = nextTouch ? getHealthStatus(nextTouch) : 'green';
  const tier = contact.tier as number;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.name}>{contact.name}</Text>
          <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[tier] ?? '#888' }]}>
            <Text style={styles.tierBadgeText}>{TIER_LABELS[tier] ?? '?'}</Text>
          </View>
        </View>
        {TIER_NAMES[tier] && <Text style={styles.tierName}>{TIER_NAMES[tier]}</Text>}

        {/* Health indicator */}
        <View style={styles.healthRow}>
          <View style={[styles.healthDot, { backgroundColor: HEALTH_COLORS[health] }]} />
          <Text style={[styles.healthLabel, { color: HEALTH_COLORS[health] }]}>
            {HEALTH_LABELS[health]}
          </Text>
          {nextTouch && (
            <Text style={styles.nextTouchText}>· Next touch: {formatDate(nextTouch)}</Text>
          )}
        </View>
      </View>

      {/* Contact fields */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Info</Text>
        <InfoRow label="Phone" value={contact.phone} />
        <InfoRow label="Email" value={contact.email} />
        <InfoRow label="Birthday" value={contact.birthday} />
        <InfoRow label="Last contacted" value={formatDate(contact.lastContactedDate)} />
      </View>

      {contact.lifeContext && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Life Context</Text>
          <Text style={styles.bodyText}>{contact.lifeContext}</Text>
        </View>
      )}

      {contact.followUpNote && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-Up Note</Text>
          <Text style={styles.bodyText}>{contact.followUpNote}</Text>
        </View>
      )}

      {contact.howWeMet && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How We Met</Text>
          <Text style={styles.bodyText}>{contact.howWeMet}</Text>
        </View>
      )}

      {contact.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.bodyText}>{contact.notes}</Text>
        </View>
      )}

      {/* Interaction History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interaction History</Text>
        {interactionsLoading ? (
          <ActivityIndicator size="small" color="#7C3AED" />
        ) : interactionsError ? (
          <View style={styles.inlineErrorBox}>
            <Text style={styles.inlineErrorText}>Couldn't load interaction history.</Text>
            <TouchableOpacity onPress={loadInteractions}>
              <Text style={styles.inlineRetryLink}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : interactions.length === 0 ? (
          <View style={styles.emptyInteractionsBox}>
            <Text style={styles.emptyInteractionsEmoji}>💬</Text>
            <Text style={styles.emptyInteractionsTitle}>No interactions yet</Text>
            <Text style={styles.emptyInteractionsBody}>
              {`Log your first interaction with ${contact.name} to start building your history together.`}
            </Text>
          </View>
        ) : (
          <>
            {(showAll ? interactions : interactions.slice(0, 5)).map((item) => (
              <InteractionRow key={item.id} item={item} />
            ))}
            {interactions.length > 5 && (
              <TouchableOpacity onPress={() => setShowAll((prev) => !prev)}>
                <Text style={styles.showAllLink}>
                  {showAll ? 'Show less' : `Show all ${interactions.length} interactions`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('LogInteraction', { contactId })}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Log Interaction</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('AddContact', { contactId })}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Edit Contact</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

function InteractionRow({ item }: { item: any }) {
  const label = TYPE_LABELS[item.type] ?? item.type;
  const initiatedLabel = item.initiatedBy ? (INITIATED_LABELS[item.initiatedBy] ?? item.initiatedBy) : null;
  const date = toJsDate(item.date);
  return (
    <View style={styles.interactionItem}>
      <View style={styles.interactionHeader}>
        <Text style={styles.interactionType}>{label}</Text>
        <Text style={styles.interactionDate}>{date ? formatDate(date) : '—'}</Text>
      </View>
      {initiatedLabel && (
        <Text style={styles.interactionMeta}>{initiatedLabel}</Text>
      )}
      {item.notes && (
        <Text style={styles.interactionNotes} numberOfLines={2}>{item.notes}</Text>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: '#9CA3AF' },

  header: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { fontSize: 24, fontWeight: '700', color: '#111827', flex: 1, marginRight: 10 },
  tierBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tierName: { fontSize: 13, color: '#6B7280' },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  healthDot: { width: 10, height: 10, borderRadius: 5 },
  healthLabel: { fontSize: 14, fontWeight: '600' },
  nextTouchText: { fontSize: 13, color: '#9CA3AF' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  bodyText: { fontSize: 15, color: '#374151', lineHeight: 22 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoLabel: { fontSize: 14, color: '#9CA3AF', flex: 1 },
  infoValue: { fontSize: 14, color: '#111827', flex: 2, textAlign: 'right' },

  interactionItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 3,
  },
  interactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  interactionType: { fontSize: 14, fontWeight: '600', color: '#111827' },
  interactionDate: { fontSize: 13, color: '#9CA3AF' },
  interactionMeta: { fontSize: 13, color: '#6B7280' },
  interactionNotes: { fontSize: 13, color: '#374151', lineHeight: 19 },
  errorIcon: { fontSize: 36, marginBottom: 12 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  errorBody: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 20, paddingHorizontal: 8 },
  retryButton: { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11 },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  inlineErrorBox: { paddingVertical: 12, alignItems: 'center', gap: 6 },
  inlineErrorText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  inlineRetryLink: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  emptyInteractions: { fontSize: 14, color: '#9CA3AF' },
  emptyInteractionsBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  emptyInteractionsEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  emptyInteractionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  emptyInteractionsBody: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  showAllLink: { fontSize: 14, fontWeight: '600', color: '#7C3AED', marginTop: 4 },

  actions: { gap: 12 },
  primaryButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: { color: '#374151', fontSize: 16, fontWeight: '600' },
});
