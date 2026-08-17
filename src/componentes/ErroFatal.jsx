// Tela de erro de ultimo recurso. Sem dependencia de contexto, rota ou
// Supabase: e usada justamente quando algum deles falhou.
export default function ErroFatal({ titulo, detalhe }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-red-700">{titulo}</h1>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{detalhe}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
        >
          Recarregar
        </button>
      </div>
    </div>
  )
}
