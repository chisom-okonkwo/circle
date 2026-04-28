import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { RootStackParamList } from '../navigation/AuthNavigator';
import { getContacts } from '../services/contactsService';
import { auth } from '../services/firebase';
import { getHealthStatus } from '../services/relationshipUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactList'>;

const TIER_LABELS = { 1: 'T1', 2: 'T2', 3: 'T3', 4: 'T4' };
const TIER_COLORS = { 1: '#7C3AED', 2: '#2563EB', 3: '#059669', 4: '#D97706' };
const HEALTH_COLORS = { green: '#22C55E', yellow: '#F59E0B', red: '#EF4444' };
const TIER_TABS = [0, 1, 2, 3, 4]; // 0 = All

function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  // Firestore Timestamp shape
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  return new Date(value);
}

export default function ContactListScreen({ navigation }: Props) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTier, setActiveTier] = useState(0);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    getContacts(userId).then((result) => {
      if (result.success) {
        setContacts(result.data);
      }
      setLoading(false);
    });
  }, []);

  const filtered = contacts.filter((contact) => {
    const matchesTier = activeTier === 0 || contact.tier === activeTier;
    const matchesSearch = contact.name?.toLowerCase().includes(search.toLowerCase());
    return matchesTier && matchesSearch;
  });

  function getContactHealth(contact) {
    const nextTouch = toJsDate(contact.nextTouchDate);
    if (!nextTouch) return 'green';
    try {
      return getHealthStatus(nextTouch);
    } catch {
      return 'green';
    }
  }

  function renderContact({ item }) {
    const health = getContactHealth(item);
    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('ContactProfile', { contactId: item.id })}
        android_ripple={{ color: '#f0f0f0' }}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.healthDot, { backgroundColor: HEALTH_COLORS[health] }]} />
          <View>
            <Text style={styles.contactName}>{item.name}</Text>
          </View>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[item.tier] ?? '#888' }]}>
          <Text style={styles.tierBadgeText}>{TIER_LABELS[item.tier] ?? '?'}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Tier filter tabs */}
      <View style={styles.tabs}>
        {TIER_TABS.map((tier) => (
          <Pressable
            key={tier}
            style={[styles.tab, activeTier === tier && styles.tabActive]}
            onPress={() => setActiveTier(tier)}
          >
            <Text style={[styles.tabText, activeTier === tier && styles.tabTextActive]}>
              {tier === 0 ? 'All' : `T${tier}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Contact list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {contacts.length === 0 ? 'No contacts yet. Add your first one.' : 'No contacts match your search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddContact')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#111827',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  tabActive: {
    backgroundColor: '#7C3AED',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  tierBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
});
