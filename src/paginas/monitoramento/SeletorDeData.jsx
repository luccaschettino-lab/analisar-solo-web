import { diasDasCenas, posicoesNaBarra, indiceMaisProximo, diasDesdeAAnterior, faixaDeNuvem } from '../../lib/linhaDoTempo.js'

const COR_DA_MARCA = {
  pouca: 'bg-emerald-500',
  media: 'bg-amber-500',
  muita: 'bg-slate-400 dark:bg-slate-500',
  desconhecida: 'bg-slate-300 dark:bg-slate-600',
}

// Metade da largura do botão deslizante do navegador. As marcas ficam dentro
// deste respiro nas duas pontas, senão não alinham com o centro do botão.
const RESPIRO_PX = 8

function formatarData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatarNuvem(percentual) {
  return percentual == null ? 'indisponível' : `${Math.round(percentual)}%`
}

const BOTAO =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10'

/**
 * Barra horizontal de datas do satélite: arrastar para a direita avança no
 * tempo, para a esquerda volta. A posição é o tempo de verdade, e cada cena é
 * uma marca na barra (colorida pela nuvem), então dá para ver onde há buraco
 * de cobertura e quais datas valem a pena (as verdes). Ao arrastar, o botão
 * encaixa na cena mais próxima.
 *
 * Teclado: setas, Home e End andam de cena em cena. O passo padrão do
 * navegador (1 unidade) cairia na mesma cena e a barra pareceria travada.
 */
export default function SeletorDeData({ cenas, selecionadaId, aoSelecionar }) {
  if (cenas.length === 0) return null

  const dias = diasDasCenas(cenas)
  const posicoes = posicoesNaBarra(dias)
  const total = dias[dias.length - 1]
  const encontrado = cenas.findIndex((cena) => cena.id === selecionadaId)
  const indice = encontrado === -1 ? cenas.length - 1 : encontrado
  const cena = cenas[indice]
  const desdeAnterior = diasDesdeAAnterior(dias, indice)

  const irPara = (i) => {
    const alvo = Math.min(cenas.length - 1, Math.max(0, i))
    if (alvo !== indice) aoSelecionar(cenas[alvo])
  }

  function aoMexer(evento) {
    const i = indiceMaisProximo(dias, Number(evento.target.value))
    if (i !== -1) irPara(i)
  }

  function aoTeclar(evento) {
    const passos = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }
    if (evento.key in passos) {
      evento.preventDefault()
      irPara(indice + passos[evento.key])
    } else if (evento.key === 'Home') {
      evento.preventDefault()
      irPara(0)
    } else if (evento.key === 'End') {
      evento.preventDefault()
      irPara(cenas.length - 1)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            data-testid="data-selecionada"
            aria-live="polite"
            className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100"
          >
            {formatarData(cena.data)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nuvens {formatarNuvem(cena.nuvens)} · cena {indice + 1} de {cenas.length}
            {desdeAnterior != null && ` · ${desdeAnterior} ${desdeAnterior === 1 ? 'dia' : 'dias'} depois da anterior`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => irPara(indice - 1)} disabled={indice === 0} className={BOTAO}>
            ‹ Anterior
          </button>
          <button type="button" onClick={() => irPara(indice + 1)} disabled={indice === cenas.length - 1} className={BOTAO}>
            Próxima ›
          </button>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="range"
          aria-label="Data da cena de satélite"
          aria-valuetext={`${formatarData(cena.data)}, nuvens ${formatarNuvem(cena.nuvens)}`}
          min={0}
          max={total > 0 ? total : 1}
          step="any"
          value={total > 0 ? dias[indice] : 0}
          disabled={cenas.length === 1}
          onChange={aoMexer}
          onKeyDown={aoTeclar}
          className="h-6 w-full cursor-pointer accent-solo-700 disabled:cursor-default"
        />

        <div className="relative mt-1 h-4">
          {cenas.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => irPara(i)}
              title={`${formatarData(c.data)} · nuvens ${formatarNuvem(c.nuvens)}`}
              aria-label={`Ir para ${formatarData(c.data)}, nuvens ${formatarNuvem(c.nuvens)}`}
              aria-current={i === indice ? 'true' : undefined}
              style={{ left: `calc(${RESPIRO_PX}px + (100% - ${2 * RESPIRO_PX}px) * ${posicoes[i]})` }}
              className={`absolute top-0 -translate-x-1/2 rounded-full transition-all ${COR_DA_MARCA[faixaDeNuvem(c.nuvens)]} ${
                i === indice
                  ? 'h-4 w-4 ring-2 ring-solo-700 ring-offset-1 dark:ring-solo-400 dark:ring-offset-noite-900'
                  : 'mt-0.5 h-3 w-3 opacity-80 hover:opacity-100'
              }`}
            />
          ))}
        </div>

        <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{formatarData(cenas[0].data)}</span>
          <span>{formatarData(cenas[cenas.length - 1].data)}</span>
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>Cada ponto é uma cena:</span>
          <span className="flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-full ${COR_DA_MARCA.pouca}`} /> até 20% de nuvens</span>
          <span className="flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-full ${COR_DA_MARCA.media}`} /> até 60%</span>
          <span className="flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-full ${COR_DA_MARCA.muita}`} /> mais nuvens</span>
        </p>
      </div>
    </div>
  )
}
