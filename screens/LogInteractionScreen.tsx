import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/AuthNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'LogInteraction'>;

export default function LogInteractionScreen({ route }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Interaction</Text>
      <Text style={styles.subtitle}>Contact ID: {route.params.contactId}</Text>
      <Text style={styles.note}>Coming in Layer 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280' },
  note: { fontSize: 13, color: '#9CA3AF', marginTop: 8 },
});
