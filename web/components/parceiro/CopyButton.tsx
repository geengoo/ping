'use client'
export function CopyButton({ valor }: { valor: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(valor)}
      className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors shrink-0"
    >
      Copiar
    </button>
  )
}
