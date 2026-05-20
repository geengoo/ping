import { query } from '@/lib/db'

export default async function TenantDashboard({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params

  const { rows: stats } = await query(
    `SELECT
       COUNT(DISTINCT c.id) as campanhas,
       COUNT(DISTINCT p.id) as participantes,
       COUNT(DISTINCT CASE WHEN p.indicado_por IS NOT NULL THEN p.id END) as indicacoes
     FROM tenants t
     LEFT JOIN campanhas c ON c.tenant_id = t.id
     LEFT JOIN participantes p ON p.campanha_id = c.id
     WHERE t.slug = $1`,
    [tenant]
  )

  const s = stats[0]

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Campanhas" value={s.campanhas} />
        <StatCard label="Participantes" value={s.participantes} />
        <StatCard label="Indicações" value={s.indicacoes} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-5">
      <p className="text-sm text-zinc-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-zinc-900">{value ?? 0}</p>
    </div>
  )
}
