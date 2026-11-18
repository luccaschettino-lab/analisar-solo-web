import { useFazendaAtual } from '../../context/FazendaContext.jsx'
import { useTutorial } from '../../context/TutorialContext.jsx'

/**
 * "Primeiros passos" na barra lateral: a ordem de montar uma fazenda, que se
 * marca sozinha olhando os dados de verdade (não um clique em "feito"). O
 * próximo passo pendente ganha o botão de ir fazer.
 *
 * Só aparece para a fazenda da própria pessoa, e só para quem pode editar —
 * quem só visualiza não tem o que cadastrar. Na fazenda de exemplo não
 * aparece: lá tudo já está feito.
 *
 * `acoes`: { novaFazenda, marcarSede, desenharTalhao, importarTalhoes, irPara }
 * — vêm da barra, que já sabe levar até cada tela ou diálogo.
 */
export default function PrimeirosPassos({ acoes }) {
  const { fazendas, carregandoFazendas, fazendaSelecionada, editor, talhoes, glebas, analisesDaFazenda, carregando } =
    useFazendaAtual()
  const { carregado, passosFechados, fecharPassos, dicaVista, missao } = useTutorial()

  if (!carregado || passosFechados || carregandoFazendas || missao) return null
  const temPropria = fazendas.some((f) => !f.exemplo)
  const naPropria = fazendaSelecionada && !fazendaSelecionada.exemplo
  if (temPropria && !(naPropria && editor)) return null
  if (naPropria && carregando) return null

  const passos = [
    { titulo: 'Criar a sua fazenda', feito: temPropria, fazer: [['Criar', acoes.novaFazenda]] },
    { titulo: 'Marcar a sede no mapa', feito: naPropria && fazendaSelecionada.sede_lat != null, fazer: [['Marcar', acoes.marcarSede]] },
    {
      titulo: 'Cadastrar os talhões',
      feito: naPropria && talhoes.length > 0,
      fazer: [
        ['Desenhar', acoes.desenharTalhao],
        ['Importar arquivo', acoes.importarTalhoes],
      ],
    },
    {
      titulo: 'Importar os pontos de amostra',
      feito: naPropria && glebas.length > 0,
      fazer: [['Importar', () => acoes.irPara('/dados?aba=pontos')]],
    },
    {
      titulo: 'Lançar as análises',
      feito: naPropria && analisesDaFazenda.length > 0,
      fazer: [
        ['Laudo PDF', () => acoes.irPara('/dados?aba=pdf')],
        ['Digitar', () => acoes.irPara('/dados')],
      ],
    },
    {
      titulo: 'Definir os critérios (agrônomo)',
      feito: naPropria && Boolean(fazendaSelecionada.criterio_id),
      fazer: [['Abrir Critérios', () => acoes.irPara('/criterios')]],
    },
    { titulo: 'Ver o mapa de calor', feito: naPropria && dicaVista('filtros'), fazer: [['Abrir Filtros', () => acoes.irPara('/filtros')]] },
  ]
  const feitos = passos.filter((p) => p.feito).length
  if (feitos === passos.length) return null
  const proximo = passos.findIndex((p) => !p.feito)

  return (
    <section aria-label="Primeiros passos" className="mb-3 mt-4 rounded-xl border border-solo-200 bg-solo-50/60 p-3 dark:border-solo-500/25 dark:bg-solo-500/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Primeiros passos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {feitos} de {passos.length} feitos
          </p>
        </div>
        <button
          type="button"
          onClick={fecharPassos}
          aria-label="Esconder primeiros passos"
          title="Esconder (volta em Ajuda → Ver o tutorial de novo)"
          className="rounded px-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-white/10">
        <div className="h-full rounded-full bg-solo-600 transition-all dark:bg-solo-500" style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>

      <ol className="mt-3 space-y-1.5">
        {passos.map((p, i) => (
          <li key={p.titulo}>
            <div className={`flex items-start gap-2 text-sm ${p.feito ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[0.6rem] ${
                  p.feito
                    ? 'border-solo-600 bg-solo-600 text-white dark:border-solo-500 dark:bg-solo-500'
                    : i === proximo
                      ? 'border-solo-600 dark:border-solo-400'
                      : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {p.feito ? '✓' : ''}
              </span>
              <span className={`${p.feito ? 'line-through' : ''} ${i === proximo ? 'font-medium' : ''}`}>
                <span className="sr-only">{p.feito ? 'Feito: ' : 'A fazer: '}</span>
                {p.titulo}
              </span>
            </div>
            {i === proximo && (
              <div className="ml-6 mt-1 flex flex-wrap gap-1">
                {p.fazer.map(([rotulo, acao]) => (
                  <button
                    key={rotulo}
                    type="button"
                    onClick={acao}
                    className="rounded-md bg-solo-700 px-2 py-1 text-xs font-medium text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700"
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
