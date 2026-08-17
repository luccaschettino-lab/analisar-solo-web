import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { corDaProfundidade, opcoesDoGrafico } from '../../config/graficos.js'
import { formatarValor, parametro, rotuloComUnidade } from '../../lib/parametros.js'
import { valoresAlinhados } from '../../lib/historico.js'

/**
 * Evolução de um parâmetro ao longo das safras.
 *
 * Uma linha por profundidade. Safra sem medição entra como `null` no array —
 * nunca é omitida nem vira zero. Com `spanGaps: false`, o Chart.js interrompe
 * a linha ali, que é a leitura correta: não sabemos o que houve naquele ano.
 */
export default function GraficoParametro({ chave, anos, series }) {
  const p = parametro(chave)

  const dados = useMemo(
    () => ({
      labels: anos,
      datasets: series.map((serie) => ({
        label: `${serie.profundidade} cm`,
        // Um item por safra, na mesma ordem de `anos`. Buraco é null naquela
        // posição — encurtar o array deslocaria os pontos seguintes.
        data: valoresAlinhados(serie.porAno, anos),
        borderColor: corDaProfundidade(serie.profundidade),
        pointBorderColor: corDaProfundidade(serie.profundidade),
        pointBackgroundColor: '#ffffff',
      })),
    }),
    [anos, series],
  )

  const opcoes = useMemo(
    () =>
      opcoesDoGrafico({
        rotuloEixoY: p?.unidade || null,
        formatarValor: (valor) => formatarValor(chave, valor),
      }),
    [chave, p],
  )

  // Uma série só dispensa legenda: o título já diz o que é.
  if (series.length < 2) opcoes.plugins.legend.display = false

  const totalDePontos = series.reduce(
    (acc, s) => acc + anos.filter((ano) => s.porAno.get(ano) != null).length,
    0,
  )

  return (
    <figure className="rounded-lg border border-slate-200 bg-white p-4">
      <figcaption className="mb-1">
        <h3 className="text-sm font-semibold text-slate-800">{rotuloComUnidade(chave)}</h3>
        {p?.nota && <p className="mt-0.5 text-xs text-slate-400">{p.nota}</p>}
      </figcaption>

      <div className="h-52">
        <Line data={dados} options={opcoes} />
      </div>

      {totalDePontos === 1 && (
        <p className="mt-1 text-xs text-slate-400">
          Uma medição só — a evolução aparece a partir da segunda safra.
        </p>
      )}
    </figure>
  )
}
