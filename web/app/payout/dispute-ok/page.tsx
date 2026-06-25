type Props = { searchParams: Promise<{ nome?: string }> }

export default async function DisputeOkPage({ searchParams }: Props) {
  const { nome } = await searchParams
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold mb-2 text-blue-600">Previsão registrada</h1>
        <p className="text-gray-600">
          {nome ? (
            <>
              Entendido. <strong>{decodeURIComponent(nome)}</strong> será notificado(a) com a previsão de pagamento.
            </>
          ) : (
            'Entendido. O afiliado será notificado com a previsão de pagamento.'
          )}
        </p>
      </div>
    </main>
  )
}
