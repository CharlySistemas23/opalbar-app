import { Stack } from 'expo-router';
export default function NotificationsAdminLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /></Stack>;
}
