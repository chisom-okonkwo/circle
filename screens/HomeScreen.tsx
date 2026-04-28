import { signOut } from 'firebase/auth';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { auth } from '../services/firebase';
import { runFirestoreContactTest } from '../services/firestoreTest';

export default function HomeScreen() {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log out.';
      Alert.alert('Logout failed', message);
    }
  };

  const handleFirestoreTest = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Not logged in', 'No user found.');
      return;
    }
    const result = await runFirestoreContactTest(userId);
    Alert.alert(result.success ? 'Test passed ✓' : 'Test failed ✗', result.message);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home — logged in</Text>
      <Button title="Run Firestore Test" onPress={handleFirestoreTest} />
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
});
