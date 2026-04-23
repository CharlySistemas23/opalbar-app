import { Stack } from 'expo-router';

// Expo Router auto-discovers every file under this folder. No need to declare
// each Stack.Screen manually — that was causing "No route named X" warnings
// when a folder had its own nested _layout (then the route name is just the
// folder, not folder/index). Leave the Stack bare and it routes correctly.
export default function ManageLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
