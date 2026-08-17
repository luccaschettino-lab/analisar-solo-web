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

  const gruposComDados = GRUPOS.map((grupo) => ({
    grupo,
    parametros: parametrosDoGrupo(grupo.chave).filter((p) => porParametro.has(p.chave)),
  })).filter((g) => g.parametros.length > 0)

  const semDados = 24 - porParametro.size

  return (
    <div className="space-y-8 p-6">
      {anos.length === 1 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Só há uma safra cadastrada nesta gleba. Os gráficos mostram o ponto,
          mas a evolução aparece a partir da segunda.
        </p>
      )}

      {gruposComDados.map(({ grupo, parametros }) => (
        <section key={grupo.chave}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {grupo.rotulo}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <p className="text-xs text-slate-500">
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
