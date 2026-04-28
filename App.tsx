import 'react-native-get-random-values';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AuthNavigator from './navigation/AuthNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <AuthNavigator />
    </NavigationContainer>
  );
}
