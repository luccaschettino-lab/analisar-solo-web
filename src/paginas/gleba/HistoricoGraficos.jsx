import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { GRUPOS } from '../../config/parametros.js'
import { parametrosDoGrupo } from '../../lib/parametros.js'
import { montarSeriesPorParametro } from '../../lib/historico.js'
import { anosSafra, profundidades } from '../../hooks/useAnalises.js'
import GraficoParametro from './GraficoParametro.jsx'

// Registro explícito, só do que estes gráficos usam. O bundle não carrega
// barra, pizza, radar nem escalas de tempo à toa.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function HistoricoGraficos({ analises }) {
  // Do mais antigo para o mais recente: o tempo corre para a direita.
  const anos = useMemo(() => anosSafra(analises).slice().reverse(), [analises])
  const camadas = useMemo(() => profundidades(analises), [analises])

  // Só entram parâmetros com pelo menos uma medição — 24 gráficos vazios
  // enterrariam os poucos que têm dado.
  const porParametro = useMemo(
    () => montarSeriesPorParametro(analises, camadas),
    [analises, camadas],
  )

  if (anos.length === 0) return null

  // Granulometria (areia/silte/argila) é textura do solo, não química — não
  // muda de uma safra para a outra por adubação ou manejo, então uma linha do
  // tempo dela não conta evolução nenhuma. O parâmetro continua na tabela e no
  // lançamento; só some deste gráfico, que é sobre o que de fato varia.
  const gruposComDados = GRUPOS.filter((grupo) => grupo.chave !== 'granulometria')
    .map((grupo) => ({
      grupo,
      parametros: parametrosDoGrupo(grupo.chave).filter((p) => porParametro.has(p.chave)),
    }))
    .filter((g) => g.parametros.length > 0)

  const semDados = 24 - porParametro.size

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {anos.length === 1 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          Só há uma safra cadastrada nesta gleba. Os gráficos mostram o ponto,
          mas a evolução aparece a partir da segunda.
        </p>
      )}

      {gruposComDados.map(({ grupo, parametros }) => (
        <section key={grupo.chave}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {grupo.rotulo}
          </h2>
          {/* `auto-fit`/`minmax` reage à largura real do container, não à da
              tela — ao contrário de breakpoint fixo (`md:`, `xl:`), que olha
              só o viewport. Essencial aqui: o mesmo componente também vive no
              painel estreito ao lado do mapa, e um breakpoint de tela cheia
              pediria 2 ou 3 colunas mesmo quando o container tem a metade
              disso, espremendo cada gráfico. */}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))' }}
          >
            {parametros.map((p) => (
              <GraficoParametro
                key={p.chave}
                chave={p.chave}
                anos={anos}
                series={porParametro.get(p.chave).series}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        A linha se interrompe onde não houve medição — o gráfico não liga um ano
        ao outro por cima do buraco, porque não sabemos o que aconteceu ali.
        {semDados > 0 && (
          <>
            {' '}
            {semDados} dos 24 parâmetros não têm nenhuma medição nesta gleba e por
            isso não aparecem.
          </>
        )}
      </p>
    </div>
  )
}
