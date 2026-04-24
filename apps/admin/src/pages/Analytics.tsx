import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/client';

export function Analytics() {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await adminApi.stats()).data?.data ?? {},
  });
  const insights = useQuery({
    queryKey: ['admin', 'insights', 'audience'],
    queryFn: async () => (await adminApi.audienceInsights()).data?.data ?? {},
  });

  const s: any = stats.data ?? {};
  const i: any = insights.data ?? {};

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted text-sm mt-1">KPIs y audiencia</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Usuarios totales" value={s.totalUsers} />
        <Kpi label="Nuevos (30d)" value={s.signupsLast30d} />
        <Kpi label="Activos (DAU)" value={s.dau} />
        <Kpi label="Activos (WAU)" value={s.wau} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Eventos activos" value={s.activeEvents} />
        <Kpi label="Ofertas activas" value={s.activeOffers} />
        <Kpi label="Reservas pendientes" value={s.pendingReservations} />
        <Kpi label="Canjes (30d)" value={s.redemptionsLast30d} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Demográficos">
          <KV label="Edad promedio" value={i.demographics?.avgAge} />
          <KV label="Género F" value={i.demographics?.female} />
          <KV label="Género M" value={i.demographics?.male} />
          <KV label="Otro" value={i.demographics?.other} />
        </Card>
        <Card title="Intereses top">
          <ul className="text-sm space-y-1">
            {(i.topInterests ?? []).slice(0, 8).map((it: any) => (
              <li key={it.id} className="flex justify-between">
                <span>{it.name}</span>
                <span className="text-muted">{it.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Cohortes">
          <ul className="text-sm space-y-1">
            {(i.cohorts ?? []).map((c: any) => (
              <li key={c.week} className="flex justify-between">
                <span>{c.week}</span>
                <span className="text-muted">{c.signups} signups · {c.retention}% retención</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Hora pico">
          <ul className="text-sm space-y-1">
            {(i.peakHours ?? []).slice(0, 6).map((h: any) => (
              <li key={h.hour} className="flex justify-between">
                <span>{h.hour}:00</span>
                <span className="text-muted">{h.count} eventos</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="card p-5">
      <p className="text-3xl font-extrabold">{value ?? '—'}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="font-bold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted">{label}</span>
      <span>{value ?? '—'}</span>
    </div>
  );
}
