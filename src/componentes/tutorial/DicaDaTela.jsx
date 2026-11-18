import { useLocation } from 'react-router-dom'
import { useTutorial } from '../../context/TutorialContext.jsx'

/**
 * Uma dica curta na primeira visita de cada tela. Some no "Entendi" e não
 * volta, a não ser por Ajuda → Ver o tutorial de novo.
 */
const DICAS = [
  {
    chave: 'mapa',
    combina: (caminho) => caminho === '/',
    titulo: 'O mapa da fazenda',
    texto:
      'Clique num talhão para ver os dados dele. Para colorir pelo solo, escolha safra, profundidade e parâmetro em Filtros. A lista de talhões abre no número ao lado de "Mapa", na barra lateral.',
  },
  {
    chave: 'filtros',
    combina: (caminho) => caminho === '/filtros',
    titulo: 'Filtros',
    texto:
      'Escolha safra, profundidade e parâmetro: o mapa pinta cada talhão pelo nível (verde é o ideal). Listrado é onde não há medição.',
  },
  {
    chave: 'comparar',
    combina: (caminho) => caminho === '/comparar',
    titulo: 'Comparar anos',
    texto: 'Escolha duas safras e um parâmetro: o mapa mostra onde subiu, onde caiu e onde ficou igual.',
  },
  {
    chave: 'dados',
    combina: (caminho) => caminho === '/dados',
    titulo: 'Lançar dados',
    texto:
      'Comece pelos pontos de amostra (o sistema cria as glebas). Depois importe o laudo em PDF, que já casa cada amostra com a gleba, ou digite à mão.',
  },
  {
    chave: 'monitoramento',
    combina: (caminho) => caminho === '/monitoramento',
    titulo: 'Monitoramento por satélite',
    texto:
      'Escolha o talhão e a data na barra do tempo; prefira as datas com bolinha verde, que têm pouca nuvem. O NDVI mostra o vigor da lavoura.',
  },
  {
    chave: 'criterios',
    combina: (caminho) => caminho === '/criterios',
    titulo: 'Critérios',
    texto:
      'Aqui se define o que é baixo, ideal ou alto em cada parâmetro. Já vem um padrão; mude só se o seu agrônomo usar outras faixas.',
  },
  {
    chave: 'gleba',
    combina: (caminho) => caminho.startsWith('/glebas/'),
    titulo: 'Página da gleba',
    texto: 'As análises do talhão desta gleba, o histórico em gráficos e a foto do local.',
  },
]

export default function DicaDaTela() {
  const { pathname } = useLocation()
  const { carregado, boasVindasAberta, dicaVista, marcarDica, missao } = useTutorial()
  // Durante o tutorial guiado, quem fala é o cartão da missão.
  if (!carregado || boasVindasAberta || missao) return null
  const dica = DICAS.find((d) => d.combina(pathname))
  if (!dica || dicaVista(dica.chave)) return null

  return (
    <div
      role="status"
      className="vidro-forte fixed bottom-4 left-4 right-4 z-[1500] rounded-xl border border-solo-200 p-4 shadow-painel motion-safe:animate-modal-entrada dark:border-solo-500/30 sm:left-auto sm:right-6 sm:w-96"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-solo-700 text-xs text-white dark:bg-solo-600">
          i
        </span>
        {dica.titulo}
      </p>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{dica.texto}</p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => marcarDica(dica.chave)}
          className="rounded-md bg-solo-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700"
        >
          Entendi
        </button>
      </div>
    </div>
  )
}
