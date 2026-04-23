import { useLocalSearchParams } from 'expo-router';
import { EventForm } from '@/features/admin-events/EventForm';

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventForm eventId={id} />;
}
