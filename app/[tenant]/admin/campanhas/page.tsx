import { query } from '@/lib/db'
import Link from 'next/link'

export default async function Campanhas({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params

  const { rows } = await query(
    `SELECT c.*, COUNT(p.id) as total_participantes
     FROM campanhas c
     JOIN tenants t ON t.id = c.tenant_id
     LEFT JOIN participantes p ON p.campanha_id = c.id
     WHERE t.slug = $1
     GROUP BY c.id
     ORDER BY c.criado_em DESC`,
    [tenant]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Campanhas</h1>
        <Link
          href={`/${tenant}/admin/campanhas/nova`}
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition"
        >
          + Nova campanha
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-zinc-100 p-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-900">{c.titulo}</p>
              <p className="text-sm text-zinc-400 mt-0.5">{c.total_participantes} participantes</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.ativa ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                {c.ativa ? 'Ativa' : 'Inativa'}
              </span>
              <Link
                href={`/${tenant}/${c.slug}`}
                target="_blank"
                className="text-xs text-zinc-400 hover:text-zinc-900"
              >
                Ver página →
              </Link>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center text-zinc-400">
            Nenhuma campanha ainda. Crie a primeira!
          </div>
        )}
      </div>
    </div>
  )
}
