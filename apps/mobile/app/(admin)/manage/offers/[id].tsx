import { useLocalSearchParams } from 'expo-router';
import { OfferForm } from '@/features/admin-offers/OfferForm';

export default function EditOffer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OfferForm offerId={id} />;
}
