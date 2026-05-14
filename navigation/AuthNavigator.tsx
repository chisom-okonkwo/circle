import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AddContactScreen from '.././screens/AddContactScreen';
import ContactListScreen from '.././screens/ContactListScreen';
import ContactProfileScreen from '.././screens/ContactProfileScreen';
import LogInteractionScreen from '.././screens/LogInteractionScreen';
import OnboardingScreen from '.././screens/OnboardingScreen';
import SettingsScreen from '.././screens/SettingsScreen';
import { useBirthdayNotifications } from '../hooks/useBirthdayNotifications';
import { useNotificationSetup } from '../hooks/useNotificationSetup';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { auth, db } from '../services/firebase';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Onboarding: undefined;
  Home: undefined;
  ContactList: undefined;
  ContactProfile: { contactId: string };
  AddContact: { contactId?: string } | undefined;
  LogInteraction: { contactId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AuthNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // null = not yet checked; true/false = result of the Firestore read
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useNotificationSetup(user?.uid);
  useBirthdayNotifications(user?.uid);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setOnboardingDone(null);
        setLoading(false);
        return;
      }

      // Check whether onboarding has been completed before revealing the app.
      try {
        const snap = await getDoc(doc(db, 'userSettings', currentUser.uid));
        const done = snap.exists() && snap.data()?.onboardingComplete === true;
        setOnboardingDone(done);
      } catch {
        // On error, skip onboarding so the user is never permanently blocked.
        setOnboardingDone(true);
      }

      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading || (user !== null && onboardingDone === null)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={user ? (onboardingDone ? 'ContactList' : 'Onboarding') : 'Login'}>
      {user ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ContactList" component={ContactListScreen} options={{ title: 'My Contacts' }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
          
          <Stack.Screen name="ContactProfile" component={ContactProfileScreen} options={{ title: 'Contact' }} />
          <Stack.Screen name="AddContact" component={AddContactScreen} options={{ title: 'Add Contact' }} />
          <Stack.Screen name="LogInteraction" component={LogInteractionScreen} options={{ title: 'Log Interaction' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
