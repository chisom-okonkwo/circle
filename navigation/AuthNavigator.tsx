import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AddContactScreen from '.././screens/AddContactScreen';
import ContactListScreen from '.././screens/ContactListScreen';
import ContactProfileScreen from '.././screens/ContactProfileScreen';
import LogInteractionScreen from '.././screens/LogInteractionScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { auth } from '../services/firebase';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  ContactList: undefined;
  ContactProfile: { contactId: string };
  AddContact: { contactId?: string } | undefined;
  LogInteraction: { contactId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AuthNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {user ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
          <Stack.Screen name="ContactList" component={ContactListScreen} options={{ title: 'My Contacts' }} />
          <Stack.Screen name="ContactProfile" component={ContactProfileScreen} options={{ title: 'Contact' }} />
          <Stack.Screen name="AddContact" component={AddContactScreen} options={{ title: 'Add Contact' }} />
          <Stack.Screen name="LogInteraction" component={LogInteractionScreen} options={{ title: 'Log Interaction' }} />
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
