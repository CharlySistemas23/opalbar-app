import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="search" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="events/filter" />
      <Stack.Screen name="offers/index" />
      <Stack.Screen name="offers/[id]" />
      <Stack.Screen name="community/posts/[id]" />
      <Stack.Screen name="community/new-post" />
      <Stack.Screen name="profile/edit" />
      <Stack.Screen name="profile/wallet" />
      <Stack.Screen name="profile/loyalty-levels" />
      <Stack.Screen name="profile/notifications" />
      <Stack.Screen name="profile/notification-settings" />
      <Stack.Screen name="profile/sessions" />
      <Stack.Screen name="profile/change-password" />
      <Stack.Screen name="profile/privacy" />
      <Stack.Screen name="profile/gdpr" />
      <Stack.Screen name="profile/about" />
      <Stack.Screen name="messages/index" />
      <Stack.Screen name="messages/[id]" />
      <Stack.Screen name="users/[id]" />
      <Stack.Screen name="users/[id]/followers" />
      <Stack.Screen name="users/[id]/following" />
      <Stack.Screen name="venue/[id]" />
      <Stack.Screen name="venue/[id]/review" />
      <Stack.Screen name="reservations/new" />
      <Stack.Screen name="reservations/my" />
      <Stack.Screen name="reservations/[id]" />
      <Stack.Screen name="support/index" />
      <Stack.Screen name="support/new-ticket" />
      <Stack.Screen name="support/chat/[id]" />
      <Stack.Screen name="staff/scan" />
    </Stack>
  );
}
