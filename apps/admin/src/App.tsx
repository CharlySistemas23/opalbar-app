import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { Login } from '@/pages/Login';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { EventsList } from '@/pages/EventsList';
import { EventForm } from '@/pages/EventForm';
import { OffersList } from '@/pages/OffersList';
import { OfferForm } from '@/pages/OfferForm';
import { Community } from '@/pages/Community';
import { Users } from '@/pages/Users';
import { UserDetailRoute } from '@/pages/UserDetailRoute';
import { Reservations } from '@/pages/Reservations';
import { Reports } from '@/pages/Reports';
import { Support } from '@/pages/Support';
import { Messages } from '@/pages/Messages';
import { PushBroadcast } from '@/pages/PushBroadcast';
import { Analytics } from '@/pages/Analytics';
import { Venues } from '@/pages/Venues';
import { Config } from '@/pages/Config';
import { Activity } from '@/pages/Activity';
import { Staff } from '@/pages/Staff';
import { Flags } from '@/pages/Flags';
import { Gdpr } from '@/pages/Gdpr';
import { Loyalty } from '@/pages/Loyalty';
import { Stories } from '@/pages/Stories';
import { Reviews } from '@/pages/Reviews';
import { Marketing } from '@/pages/Marketing';
import { EventCategories } from '@/pages/EventCategories';
import { ReservationConfig } from '@/pages/ReservationConfig';
import { QuickReplies } from '@/pages/QuickReplies';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
});

function Guarded({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  if (!initialized) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  const { restore, initialized, user } = useAuthStore();
  useEffect(() => { restore(); }, []);

  if (!initialized) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Cargando…</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/admin" replace /> : <Login />} />
          <Route
            path="/"
            element={<Guarded><Layout /></Guarded>}
          >
            <Route index element={<Navigate to="/admin" replace />} />
            <Route path="admin" element={<Dashboard />} />
            <Route path="admin/events" element={<EventsList />} />
            <Route path="admin/events/new" element={<EventForm />} />
            <Route path="admin/events/:id" element={<EventForm />} />
            <Route path="admin/offers" element={<OffersList />} />
            <Route path="admin/offers/new" element={<OfferForm />} />
            <Route path="admin/offers/:id" element={<OfferForm />} />
            <Route path="admin/reservations" element={<Reservations />} />
            <Route path="admin/community" element={<Community />} />
            <Route path="admin/reports" element={<Reports />} />
            <Route path="admin/support" element={<Support />} />
            <Route path="admin/messages" element={<Messages />} />
            <Route path="admin/notifications" element={<PushBroadcast />} />
            <Route path="admin/analytics" element={<Analytics />} />
            <Route path="admin/venues" element={<Venues />} />
            <Route path="admin/users" element={<Users />} />
            <Route path="admin/users/:id" element={<UserDetailRoute />} />
            <Route path="admin/config" element={<Config />} />
            <Route path="admin/activity" element={<Activity />} />
            <Route path="admin/staff" element={<Staff />} />
            <Route path="admin/flags" element={<Flags />} />
            <Route path="admin/gdpr" element={<Gdpr />} />
            <Route path="admin/loyalty" element={<Loyalty />} />
            <Route path="admin/stories" element={<Stories />} />
            <Route path="admin/reviews" element={<Reviews />} />
            <Route path="admin/marketing" element={<Marketing />} />
            <Route path="admin/event-categories" element={<EventCategories />} />
            <Route path="admin/reservations/config" element={<ReservationConfig />} />
            <Route path="admin/support/quick-replies" element={<QuickReplies />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
