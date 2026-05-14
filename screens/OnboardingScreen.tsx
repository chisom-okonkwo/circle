import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RootStackParamList } from '../navigation/AuthNavigator';
import { auth } from '../services/firebase';
import { updateUserSettings } from '../services/userSettingsService';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const TIERS = [
  { badge: 'T1', label: 'Inner Circle',  freq: 'Every 2 weeks',  color: '#7C3AED' },
  { badge: 'T2', label: 'Close Circle',  freq: 'Monthly',        color: '#2563EB' },
  { badge: 'T3', label: 'Warm Network',  freq: 'Quarterly',      color: '#059669' },
  { badge: 'T4', label: 'Loose Ties',    freq: 'Every 6 months', color: '#D97706' },
];

const TOTAL_STEPS = 3;

// ── Step components ────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.heading}>Welcome to Circle</Text>
      <Text style={styles.body}>
        Circle helps you stay genuinely connected with the people who matter most —
        by reminding you to reach out before relationships quietly fade.
      </Text>

      <View style={styles.tiersCard}>
        <Text style={styles.tiersCardTitle}>Organise contacts into four tiers</Text>
        {TIERS.map((t) => (
          <View key={t.badge} style={styles.tierRow}>
            <View style={[styles.tierBadge, { backgroundColor: t.color }]}>
              <Text style={styles.tierBadgeText}>{t.badge}</Text>
            </View>
            <View style={styles.tierInfo}>
              <Text style={styles.tierLabel}>{t.label}</Text>
              <Text style={styles.tierFreq}>{t.freq}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function StepAddContact({ onAddContact }: { onAddContact: () => void }) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.emoji}>👥</Text>
      <Text style={styles.heading}>Start with one person</Text>
      <Text style={styles.body}>
        Think of someone you've been meaning to catch up with. Add them now and
        Circle will start tracking when to reach out next.
      </Text>

      <TouchableOpacity
        style={styles.outlineButton}
        onPress={onAddContact}
        activeOpacity={0.85}
      >
        <Text style={styles.outlineButtonText}>Add my first contact →</Text>
      </TouchableOpacity>

      <Text style={styles.skipNote}>
        You can also do this later — your contacts list is always one tap away.
      </Text>
    </ScrollView>
  );
}

function StepNotifications() {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.emoji}>🔔</Text>
      <Text style={styles.heading}>We'll nudge you daily</Text>
      <Text style={styles.body}>
        Each morning, Circle sends a quick digest so you always know who needs
        attention — overdue contacts, upcoming birthdays, and your overall
        network health at a glance.
      </Text>

      <View style={styles.notifPreview}>
        <View style={styles.notifHeader}>
          <View style={styles.notifAppIcon} />
          <View>
            <Text style={styles.notifAppName}>Circle</Text>
            <Text style={styles.notifTime}>now</Text>
          </View>
        </View>
        <Text style={styles.notifTitle}>Circle — daily check-in</Text>
        <Text style={styles.notifBody}>
          You have 3 overdue contacts and 1 birthday coming up. Tap to review.
        </Text>
      </View>

      <Text style={styles.skipNote}>
        You can change the timing or disable notifications anytime in Settings.
      </Text>
    </ScrollView>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  function handleNext() {
    setStep((s) => s + 1);
  }

  async function handleFinish() {
    const userId = auth.currentUser?.uid;
    setFinishing(true);
    if (userId) {
      try {
        await updateUserSettings(userId, { onboardingComplete: true });
      } catch {
        // Best effort — don't block the user if Firestore fails.
      }
    }
    // replace() removes Onboarding from the back stack so pressing back
    // from ContactList doesn't return here.
    navigation.replace('ContactList');
  }

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      {/* Step content */}
      <View style={styles.contentArea}>
        {step === 0 && <StepWelcome />}
        {step === 1 && (
          <StepAddContact
            onAddContact={() => navigation.navigate('AddContact')}
          />
        )}
        {step === 2 && <StepNotifications />}
      </View>

      {/* CTA button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, finishing && styles.buttonDisabled]}
          onPress={isLast ? handleFinish : handleNext}
          disabled={finishing}
          activeOpacity={0.85}
        >
          {finishing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isLast ? 'Get Started' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 20,
    paddingBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    backgroundColor: '#7C3AED',
    width: 24,
  },
  contentArea: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },

  // Text
  emoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 28,
  },
  skipNote: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 16,
    paddingHorizontal: 8,
  },

  // Tiers card (step 0)
  tiersCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  tiersCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  tierInfo: {
    flex: 1,
  },
  tierLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  tierFreq: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 1,
  },

  // Add contact button (step 1)
  outlineButton: {
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
  },
  outlineButtonText: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '700',
  },

  // Notification preview (step 2)
  notifPreview: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  notifAppIcon: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#7C3AED',
  },
  notifAppName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  notifTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  notifBody: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },

  // Footer
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 32,
    paddingTop: 12,
  },
  primaryButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
