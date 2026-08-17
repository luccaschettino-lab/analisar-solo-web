import { Link } from 'react-router-dom'

export default function NaoEncontrado() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <p className="text-sm font-medium text-slate-500">Página não encontrada</p>
      <Link to="/" className="text-sm font-medium text-solo-700 hover:underline">
        Voltar ao início
      </Link>
    </div>
  )
}
