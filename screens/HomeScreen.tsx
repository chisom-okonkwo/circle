import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function HomeScreen() {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log out.';
      Alert.alert('Logout failed', message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home — logged in</Text>
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
