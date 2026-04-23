import { Stack } from 'expo-router';
export default function GdprAdminLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /></Stack>;
}
