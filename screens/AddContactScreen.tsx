import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useState } from 'react';
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
import { createContact, getContactById, updateContact } from '../services/contactsService';
import { auth } from '../services/firebase';
import { computeNextTouchDate } from '../services/relationshipUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'AddContact'>;

const TIERS = [
  { value: 1, label: 'T1 — Inner Circle', description: 'Closest people. Touch base every 2 weeks.' },
  { value: 2, label: 'T2 — Close Circle', description: 'Good friends. Stay in touch monthly.' },
  { value: 3, label: 'T3 — Warm Network', description: 'Valued connections. Check in quarterly.' },
  { value: 4, label: 'T4 — Loose Ties', description: 'Wider network. Reach out every 6 months.' },
];

const BIRTHDAY_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  birthday: '',
  tier: 0,
  howWeMet: '',
  lifeContext: '',
  followUpNote: '',
  notes: '',
};

export default function AddContactScreen({ route, navigation }: Props) {
  const contactId = route.params?.contactId;
  const isEditing = Boolean(contactId);

  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingContact, setLoadingContact] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Contact' : 'Add Contact' });
  }, [isEditing, navigation]);

  useEffect(() => {
    if (!isEditing || !contactId) return;
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    getContactById(userId, contactId).then((result) => {
      if (result.success && result.data) {
        const c = result.data;
        setForm({
          name: c.name ?? '',
          phone: c.phone ?? '',
          email: c.email ?? '',
          birthday: c.birthday ?? '',
          tier: c.tier ?? 0,
          howWeMet: c.howWeMet ?? '',
          lifeContext: c.lifeContext ?? '',
          followUpNote: c.followUpNote ?? '',
          notes: c.notes ?? '',
        });
      }
      setLoadingContact(false);
    });
  }, [isEditing, contactId]);

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string | null {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.tier) return 'Please select a tier.';
    if (form.birthday && !BIRTHDAY_REGEX.test(form.birthday)) {
      return 'Birthday must be in MM-DD format (e.g. 09-14).';
    }
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Missing information', validationError);
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'Not logged in.');
      return;
    }

    setSaving(true);

    const today = new Date();
    const nextTouchDate = computeNextTouchDate(form.tier, today);

    const contactPayload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      birthday: form.birthday.trim() || null,
      tier: form.tier,
      howWeMet: form.howWeMet.trim() || null,
      lifeContext: form.lifeContext.trim() || null,
      followUpNote: form.followUpNote.trim() || null,
      notes: form.notes.trim() || null,
      nextTouchDate,
    };

    let result;
    if (isEditing && contactId) {
      result = await updateContact(userId, contactId, contactPayload);
    } else {
      result = await createContact(userId, {
        ...contactPayload,
        lastContactedDate: today,
      });
    }

    setSaving(false);

    if (!result.success) {
      Alert.alert('Save failed', result.error ?? 'Something went wrong.');
      return;
    }

    navigation.goBack();
  }

  if (loadingContact) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Name <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={form.name}
          onChangeText={(v) => set('name', v)}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tier <Text style={styles.required}>*</Text></Text>
        <View style={styles.tierList}>
          {TIERS.map((tier) => (
            <Pressable
              key={tier.value}
              style={[styles.tierOption, form.tier === tier.value && styles.tierOptionSelected]}
              onPress={() => set('tier', tier.value)}
            >
              <Text style={[styles.tierOptionLabel, form.tier === tier.value && styles.tierOptionLabelSelected]}>
                {tier.label}
              </Text>
              <Text style={[styles.tierOptionDesc, form.tier === tier.value && styles.tierOptionDescSelected]}>
                {tier.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="+1-555-000-0000"
          value={form.phone}
          onChangeText={(v) => set('phone', v)}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          value={form.email}
          onChangeText={(v) => set('email', v)}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Birthday</Text>
        <TextInput
          style={styles.input}
          placeholder="MM-DD  (year optional)"
          value={form.birthday}
          onChangeText={(v) => set('birthday', v)}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <Text style={styles.hint}>Format: MM-DD. Example: 09-14. Year is not stored.</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>How We Met</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Met at a conference in 2024"
          value={form.howWeMet}
          onChangeText={(v) => set('howWeMet', v)}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Life Context</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Current job, city, situation..."
          value={form.lifeContext}
          onChangeText={(v) => set('lifeContext', v)}
          multiline
          numberOfLines={3}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Follow-Up Note</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="What to ask or mention next time..."
          value={form.followUpNote}
          onChangeText={(v) => set('followUpNote', v)}
          multiline
          numberOfLines={3}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="General notes about this person..."
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline
          numberOfLines={4}
          autoCapitalize="sentences"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Contact'}
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
    gap: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  required: {
    color: '#EF4444',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 15,
    color: '#111827',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  tierList: {
    gap: 8,
  },
  tierOption: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    gap: 2,
  },
  tierOptionSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  tierOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  tierOptionLabelSelected: {
    color: '#7C3AED',
  },
  tierOptionDesc: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  tierOptionDescSelected: {
    color: '#6D28D9',
  },
  saveButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
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
