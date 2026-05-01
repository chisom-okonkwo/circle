import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { RootStackParamList } from '../navigation/AuthNavigator';
import { auth } from '../services/firebase';
import { createInteraction } from '../services/interactionsService';

type Props = NativeStackScreenProps<RootStackParamList, 'LogInteraction'>;

const INTERACTION_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'text', label: 'Text' },
  { value: 'in-person', label: 'In Person' },
  { value: 'voice-note', label: 'Voice Note' },
  { value: 'social', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

const INITIATED_BY = [
  { value: 'me', label: 'Me' },
  { value: 'them', label: 'Them' },
  { value: 'mutual', label: 'Mutual' },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function LogInteractionScreen({ route, navigation }: Props) {
  const { contactId } = route.params;

  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [type, setType] = useState('call');
  const [initiatedBy, setInitiatedBy] = useState('me');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function onDateChange(_event: any, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDate(startOfDay(selected));
  }

  async function handleSave() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setSaving(true);
    const result = await createInteraction(userId, contactId, {
      date,
      type,
      initiatedBy,
      notes: notes.trim() || null,
    });
    setSaving(false);

    if (!result.success) {
      Alert.alert('Error', result.error ?? 'Could not save interaction.');
      return;
    }

    Alert.alert('Logged!', 'Interaction saved.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Date ── */}
      <Text style={styles.label}>Date</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.dateButtonText}>{formatDate(date)}</Text>
      </TouchableOpacity>

      {/* iOS: inline picker; Android: dialog that appears on button press */}
      {(showPicker || Platform.OS === 'ios') && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={startOfDay(new Date())}
          onChange={onDateChange}
          style={styles.iosPicker}
        />
      )}

      {/* ── Type ── */}
      <Text style={[styles.label, styles.labelSpaced]}>Type</Text>
      <View style={styles.chipRow}>
        {INTERACTION_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.chip, type === t.value && styles.chipActive]}
            onPress={() => setType(t.value)}
          >
            <Text style={[styles.chipText, type === t.value && styles.chipTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Initiated By ── */}
      <Text style={[styles.label, styles.labelSpaced]}>Initiated by (optional)</Text>
      <View style={styles.chipRow}>
        {INITIATED_BY.map((i) => (
          <Pressable
            key={i.value}
            style={[styles.chip, initiatedBy === i.value && styles.chipActive]}
            onPress={() => setInitiatedBy(i.value)}
          >
            <Text style={[styles.chipText, initiatedBy === i.value && styles.chipTextActive]}>
              {i.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Notes ── */}
      <Text style={[styles.label, styles.labelSpaced]}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="What did you talk about?"
        placeholderTextColor="#9CA3AF"
        multiline
        textAlignVertical="top"
        returnKeyType="done"
        blurOnSubmit
      />

      {/* ── Save ── */}
      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Interaction</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 20,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateButtonText: {
    fontSize: 15,
    color: '#111827',
  },
  iosPicker: {
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#7C3AED',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    color: '#111827',
  },
  notesInput: {
    height: 110,
    paddingTop: Platform.OS === 'ios' ? 12 : 9,
  },
  saveButton: {
    marginTop: 32,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
