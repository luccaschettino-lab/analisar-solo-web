import { useState } from 'react'

const L = 320 // largura do desenho (viewBox); o SVG estica no cartão
const A = 150
const M = { esq: 34, dir: 10, topo: 10, base: 34 }
const DIA = 86400000

const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const num = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Evolução do índice no último mês: uma série só (o índice escolhido), um
 * ponto por imagem, valor = média do talhão. Linha fina ligando só as datas
 * com leitura; data toda nublada vira uma marca cinza no rodapé — sem valor
 * inventado. Clicar num ponto abre a data no mapa.
 *
 * `pontos`: [{ id, data, media|null, limpoPct }], em ordem de data.
 */
export default function GraficoDoMes({ pontos, rotulo, selecionadaId, inicio, fim, aoEscolher }) {
  const [foco, setFoco] = useState(null)
  const comValor = pontos.filter((p) => p.media != null)

  const t0 = inicio.getTime()
  const t1 = Math.max(fim.getTime(), t0 + DIA)
  const x = (iso) => M.esq + ((Date.parse(iso) - t0) / (t1 - t0)) * (L - M.esq - M.dir)

  // Eixo y pelos dados, com folga e "redondo" em 0,1.
  const valores = comValor.map((p) => p.media)
  let min = valores.length ? Math.min(...valores) : 0
  let max = valores.length ? Math.max(...valores) : 1
  if (max - min < 0.1) {
    min -= 0.05
    max += 0.05
  }
  min = Math.floor(min * 10) / 10
  max = Math.ceil(max * 10) / 10
  const y = (v) => M.topo + (1 - (v - min) / (max - min)) * (A - M.topo - M.base)
  const marcasY = [min, (min + max) / 2, max]

  const caminho = comValor.map((p, i) => `${i ? 'L' : 'M'}${x(p.data).toFixed(1)},${y(p.media).toFixed(1)}`).join(' ')
  const marcasX = [inicio, new Date((t0 + t1) / 2), fim]
  const focado = pontos.find((p) => p.id === foco)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label={`${rotulo} médio do talhão por data, no último mês`}>
        {/* grade e eixos recessivos */}
        {marcasY.map((v) => (
          <g key={v}>
            <line x1={M.esq} x2={L - M.dir} y1={y(v)} y2={y(v)} className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />
            <text x={M.esq - 6} y={y(v) + 3} textAnchor="end" className="fill-slate-500 dark:fill-slate-400" fontSize="10">
              {num(v)}
            </text>
          </g>
        ))}
        {marcasX.map((d, i) => (
          <text key={i} x={M.esq + (i / 2) * (L - M.esq - M.dir)} y={A - 8} textAnchor={['start', 'middle', 'end'][i]} className="fill-slate-500 dark:fill-slate-400" fontSize="10">
            {dataCurta(d.toISOString())}
          </text>
        ))}

        {caminho && <path d={caminho} fill="none" className="stroke-solo-600 dark:stroke-solo-400" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}

        {pontos.map((p) => {
          const px = x(p.data)
          const selecionado = p.id === selecionadaId
          const alvo = (
            <circle
              cx={px}
              cy={p.media != null ? y(p.media) : A - M.base + 10}
              r="11"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setFoco(p.id)}
              onMouseLeave={() => setFoco(null)}
              onClick={() => aoEscolher(p.id)}
            >
              <title>{`${dataCurta(p.data)}: ${p.media != null ? num(p.media) : 'nublado'}`}</title>
            </circle>
          )
          if (p.media == null) {
            // Nublada: marca no rodapé, sem valor.
            return (
              <g key={p.id}>
                <text x={px} y={A - M.base + 14} textAnchor="middle" fontSize="11" className="fill-slate-400 dark:fill-slate-500">
                  ×
                </text>
                {alvo}
              </g>
            )
          }
          const parcial = p.limpoPct < 50
          return (
            <g key={p.id}>
              {selecionado && <circle cx={px} cy={y(p.media)} r="8" fill="none" className="stroke-solo-600 dark:stroke-solo-400" strokeWidth="2" />}
              <circle
                cx={px}
                cy={y(p.media)}
                r="4.5"
                strokeWidth="2"
                className={
                  parcial
                    ? 'fill-white stroke-solo-600 dark:fill-noite-900 dark:stroke-solo-400'
                    : 'fill-solo-600 stroke-white dark:fill-solo-400 dark:stroke-noite-900'
                }
              />
              {alvo}
            </g>
          )
        })}
      </svg>

      {focado && (
        <div
          className="vidro-forte pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-slate-200 px-2 py-1 text-xs shadow dark:border-white/10"
          style={{ left: `${(x(focado.data) / L) * 100}%`, top: 0 }}
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">{dataCurta(focado.data)}</p>
          <p className="text-slate-600 dark:text-slate-300">
            {focado.media != null ? `${rotulo} ${num(focado.media)}` : 'nublado, sem leitura'}
          </p>
          <p className="text-slate-500 dark:text-slate-400">{Math.round(focado.limpoPct)}% do talhão sem nuvem</p>
        </div>
      )}

      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-solo-600 dark:bg-solo-400" /> leitura boa
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border-2 border-solo-600 dark:border-solo-400" /> menos da metade sem nuvem
        </span>
        <span>× nublado</span>
      </p>
    </div>
  )
}
