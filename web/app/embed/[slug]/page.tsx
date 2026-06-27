import { EmbedContent } from './EmbedContent'

export default async function EmbedPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { slug } = await params
  const { t } = await searchParams

  if (!t) {
    return (
      <main className="flex items-center justify-center h-32 text-sm text-gray-400">
        Token ausente.
      </main>
    )
  }

  return (
    <main className="bg-white min-h-screen">
      <EmbedContent slug={slug} token={t} />
    </main>
  )
}
