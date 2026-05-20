import { query } from '@/lib/db'
import Link from 'next/link'

export default async function Clientes() {
  const { rows } = await query(`
    SELECT t.*, COUNT(c.id) as total_campanhas
    FROM tenants t
    LEFT JOIN campanhas c ON c.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.criado_em DESC
  `)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Clientes</h1>
        <Link
          href="/admin/clientes/novo"
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition"
        >
          + Novo cliente
        </Link>
      </div>
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Slug</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Campanhas</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">{t.nome}</td>
                <td className="px-4 py-3 text-zinc-500">{t.slug}</td>
                <td className="px-4 py-3 text-zinc-500">{t.email}</td>
                <td className="px-4 py-3 text-zinc-500">{t.total_campanhas}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${t.ativo ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/${t.slug}/admin`} className="text-zinc-400 hover:text-zinc-900 text-xs">
                    Ver painel →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">Nenhum cliente ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
