type Props = { searchParams: Promise<{ nome?: string }> }

export default async function ConfirmOkPage({ searchParams }: Props) {
  const { nome } = await searchParams
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold mb-2 text-green-600">Pagamento confirmado</h1>
        <p className="text-gray-600">
          {nome ? (
            <>
              <strong>{decodeURIComponent(nome)}</strong> foi notificado(a) sobre o pagamento.
            </>
          ) : (
            'O afiliado foi notificado sobre o pagamento.'
          )}
        </p>
      </div>
    </main>
  )
}
