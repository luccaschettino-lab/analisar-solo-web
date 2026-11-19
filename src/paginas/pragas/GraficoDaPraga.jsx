import { useState } from 'react'
import { STATUS, formatarValor } from '../../lib/pragas.js'
import { dataBr } from './comum.jsx'

const L = 320
const A = 160
const M = { esq: 38, dir: 10, topo: 12, base: 28 }

/**
 * Evolução de uma praga no talhão: um ponto por vistoria (valor do talhão),
 * na cor do semáforo, e o nível de controle tracejado. Uma série só; clicar
 * num ponto abre aquela vistoria.
 *
 * `pontos`: [{ vistoriaId, data, valor, nivel, status }], por data.
 */
export default function GraficoDaPraga({ pontos, metodo, nome, selecionadaId, aoEscolher }) {
  const [foco, setFoco] = useState(null)
  if (pontos.length === 0) return null
  const escalaFixa = metodo === 'nota' ? 3 : metodo === 'presenca' ? 1 : null
  const maior = Math.max(...pontos.map((p) => Math.max(p.valor ?? 0, p.nivel ?? 0)))
  const max = escalaFixa ?? (maior > 0 ? maior * 1.15 : 1)
  const t0 = Date.parse(pontos[0].data)
  const t1 = Math.max(Date.parse(pontos.at(-1).data), t0 + 86400000)
  const x = (iso) =>
    pontos.length === 1 ? (M.esq + L - M.dir) / 2 : M.esq + ((Date.parse(iso) - t0) / (t1 - t0)) * (L - M.esq - M.dir)
  const y = (v) => M.topo + (1 - v / max) * (A - M.topo - M.base)
  const marcas = escalaFixa === 3 ? [1, 2, 3] : escalaFixa === 1 ? [0, 1] : [0, max / 2, max]
  const rotuloY = (v) => (metodo === 'nota' ? ['', 'Baixo', 'Médio', 'Alto'][v] : metodo === 'presenca' ? (v ? 'Sim' : 'Não') : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))
  const caminho = pontos
    .filter((p) => p.valor != null)
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`)
    .join(' ')
  const nivelCaminho = pontos
    .filter((p) => p.nivel != null)
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.data).toFixed(1)},${y(p.nivel).toFixed(1)}`)
    .join(' ')
  const focado = pontos.find((p) => p.vistoriaId === foco)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label={`${nome}: valor do talhão em cada vistoria`}>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={M.esq} x2={L - M.dir} y1={y(v)} y2={y(v)} className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />
            <text x={M.esq - 6} y={y(v) + 3} textAnchor="end" className="fill-slate-500 dark:fill-slate-400" fontSize="10">
              {rotuloY(v)}
            </text>
          </g>
        ))}
        <text x={M.esq} y={A - 8} className="fill-slate-500 dark:fill-slate-400" fontSize="10">
          {dataBr(pontos[0].data).slice(0, 5)}
        </text>
        {pontos.length > 1 && (
          <text x={L - M.dir} y={A - 8} textAnchor="end" className="fill-slate-500 dark:fill-slate-400" fontSize="10">
            {dataBr(pontos.at(-1).data).slice(0, 5)}
          </text>
        )}
        {nivelCaminho && pontos.length > 1 && (
          <path d={nivelCaminho} fill="none" stroke="#b91c1c" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
        )}
        {nivelCaminho && pontos.length === 1 && (
          <line x1={M.esq} x2={L - M.dir} y1={y(pontos[0].nivel)} y2={y(pontos[0].nivel)} stroke="#b91c1c" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
        )}
        {caminho && <path d={caminho} fill="none" className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="2" strokeLinejoin="round" />}
        {pontos.map((p) =>
          p.valor == null ? null : (
            <g key={p.vistoriaId}>
              <circle
                cx={x(p.data)}
                cy={y(p.valor)}
                r={p.vistoriaId === selecionadaId ? 6 : 4.5}
                fill={STATUS[p.status].cor}
                stroke="white"
                strokeWidth="2"
              />
              <circle
                cx={x(p.data)}
                cy={y(p.valor)}
                r="12"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setFoco(p.vistoriaId)}
                onMouseLeave={() => setFoco(null)}
                onClick={() => aoEscolher(p.vistoriaId)}
              >
                <title>{`${dataBr(p.data)}: ${formatarValor(p.valor, metodo)} · ${STATUS[p.status].rotulo}`}</title>
              </circle>
            </g>
          ),
        )}
      </svg>
      {focado && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow dark:bg-white dark:text-slate-900">
          {dataBr(focado.data)} · {formatarValor(focado.valor, metodo)} · {STATUS[focado.status].rotulo}
        </div>
      )}
      {pontos.some((p) => p.nivel != null) && (
        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <svg width="20" height="6" aria-hidden="true">
            <line x1="0" x2="20" y1="3" y2="3" stroke="#b91c1c" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          Nível de controle
        </p>
      )}
    </div>
  )
}
