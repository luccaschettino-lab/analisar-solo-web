import { Link } from 'react-router-dom'
import { lembrarFazenda } from '../../hooks/useSelecaoFazenda.js'

function area(ha) {
  if (ha == null) return null
  return `${ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}

function Separador() {
  return (
    <span aria-hidden="true" className="px-2 text-slate-300 dark:text-slate-600">
      ›
    </span>
  )
}

export default function TrilhaNavegacaoTalhao({ fazenda, talhao }) {
  const areaTalhao = area(talhao.area_ha)
  const local = [fazenda.municipio, fazenda.uf].filter(Boolean).join('/')

  return (
    <nav aria-label="Trilha de navegação" className="text-sm">
      <div className="flex flex-wrap items-center">
        <Link
          to="/"
          // Grava a fazenda antes de navegar: sem isso o mapa abriria na
          // última que o usuário visitou, que pode não ser esta.
          onClick={() => lembrarFazenda(fazenda.id)}
          className="font-medium text-solo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600 dark:text-solo-400"
        >
          {fazenda.nome}
        </Link>
        {local && <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">{local}</span>}

        <Separador />

        <span aria-current="page" className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: talhao.cor }}
          />
          Talhão {talhao.codigo}
          {talhao.nome && <span className="font-normal text-slate-500 dark:text-slate-400"> · {talhao.nome}</span>}
        </span>
        {areaTalhao && <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">{areaTalhao}</span>}
      </div>
    </nav>
  )
}
