import { useState } from 'react'
import { ESCALA_DIVERGENTE, CINZA_NEUTRO, HACHURA_FUNDO, HACHURA_TRACO } from '../../config/mapa.js'
import { formatarValor, rotuloComUnidade, parametro } from '../../lib/parametros.js'
import { FRACAO_PADRAO, origemDoLimiar } from '../../lib/variacao.js'

// Mesma hachura do mapa, em CSS — copiada da legenda da Fase 4 pelo mesmo
// motivo: a amostra tem que ser exatamente o que aparece na gleba.
const HACHURA_CSS = {
  backgroundColor: HACHURA_FUNDO,
  backgroundImage: `repeating-linear-gradient(45deg, ${HACHURA_TRACO} 0 2px, transparent 2px 8px)`,
}

/**
 * A barra da escala, com a faixa estável no tamanho real que ela ocupa.
 *
 * Desenhar a zona neutra com largura proporcional a `limiar / max` não é
 * enfeite: é a única forma de a legenda responder "o quanto dessa escala é
 * considerado parado". Com um limiar grande diante de variações pequenas, a
 * barra sai quase toda neutra — e é exatamente isso que o mapa mostra.
 */
function Barra({ max, limiar }) {
  const { queda, alta, estavel } = ESCALA_DIVERGENTE

  const fracaoNeutra = max > 0 ? Math.min(1, limiar / max) : 1
  const inicioNeutro = 50 * (1 - fracaoNeutra)
  const fimNeutro = 50 * (1 + fracaoNeutra)

  const gradiente =
    fracaoNeutra >= 1
      ? estavel
      : `linear-gradient(to right, ${queda.forte} 0%, ${queda.fraca} ${inicioNeutro}%, ${estavel} ${inicioNeutro}%, ${estavel} ${fimNeutro}%, ${alta.fraca} ${fimNeutro}%, ${alta.forte} 100%)`

  return (
    <div
      aria-hidden="true"
      className="h-3 w-full rounded border border-slate-300"
      style={{ background: gradiente }}
    />
  )
}

/**
 * Legenda do mapa divergente.
 *
 * Diz três coisas que o mapa sozinho não diz: onde ficam os extremos da
 * escala, o que conta como estável e de onde esse limiar veio, e o que
 * significam os dois cinzas — que não são valores, são ausências.
 */
export default function LegendaDivergente({ comparacao, elevada = false }) {
  // No celular começa recolhida, como a legenda do mapa da Fase 4: aberta, ela
  // tapa justamente o mapa que explica.
  const [aberta, setAberta] = useState(false)

  if (!comparacao) return null

  const { chaveParametro, anoA, anoB, profundidade, max, limiar } = comparacao
  const unidade = parametro(chaveParametro)?.unidade ?? ''
  const origem = origemDoLimiar(chaveParametro)
  const semVariacao = max === 0

  const extremo = (sinal) =>
    `${sinal}${formatarValor(chaveParametro, max)}${unidade ? ` ${unidade}` : ''}`

  return (
    <aside
      className={`absolute right-2 z-[1100] w-auto rounded-lg border border-slate-200 bg-white/95 shadow-lg backdrop-blur md:right-3 md:w-64 md:p-3 ${
        elevada ? 'bottom-44 md:bottom-8' : 'bottom-8'
      }`}
    >
      <button
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-xs font-medium text-slate-700 md:hidden"
      >
        <span aria-hidden="true">{aberta ? '▾' : '▸'}</span>
        Legenda
      </button>

      <div className={`${aberta ? 'w-64 max-w-[80vw] p-3 pt-0' : 'hidden'} md:block md:w-auto md:max-w-none md:p-0`}>
        <h2 className="text-xs font-semibold text-slate-900">{rotuloComUnidade(chaveParametro)}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {anoA} → {anoB} · {profundidade} cm
        </p>

        <div className="mt-2">
          <Barra max={max} limiar={limiar} />
          <div className="mt-1 flex justify-between text-[11px] leading-tight text-slate-600">
            <span>{semVariacao ? '—' : extremo('−')}</span>
            <span>0</span>
            <span>{semVariacao ? '—' : extremo('+')}</span>
          </div>
          <p className="mt-1 text-[11px] leading-tight text-slate-500">
            Queda em vermelho, alta em azul. A escala é simétrica: os dois lados ancoram na maior
            variação em módulo.
          </p>
        </div>

        <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-tight text-slate-600">
          <span className="font-medium text-slate-800">
            Estável: variação de até {formatarValor(chaveParametro, limiar)}
            {unidade ? ` ${unidade}` : ''}
          </span>
          <span className="mt-0.5 block">
            {origem === 'config' && 'Limiar definido no config para este parâmetro.'}
            {origem === 'faixas' &&
              `Padrão: ${Math.round(FRACAO_PADRAO * 100)}% da amplitude das faixas de classificação.`}
            {origem === 'sem_faixas' &&
              'Este parâmetro não tem faixas, então não há limiar: qualquer diferença aparece como variação.'}
          </span>
        </p>

        <ul className="mt-2 space-y-1 border-t border-slate-200 pt-1.5">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex shrink-0 items-center gap-1">
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-sm border border-slate-300"
                style={HACHURA_CSS}
              />
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full border-2 border-dashed border-slate-500 bg-white/30"
              />
            </span>
            <span className="text-xs leading-tight text-slate-700">
              <span className="font-medium">Sem dado em um dos anos</span>
              <span className="block text-slate-500">não há variação a calcular</span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-slate-300"
              style={{ backgroundColor: CINZA_NEUTRO }}
            />
            <span className="text-xs leading-tight text-slate-700">
              <span className="font-medium">Sem dado nos dois anos</span>
              <span className="block text-slate-500">gleba nunca amostrada nesta profundidade</span>
            </span>
          </li>
        </ul>

        {/* Vermelho e azul dizem direção. Quem transforma direção em juízo é a
            coluna de classificação — e ela vem das faixas não validadas. */}
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-tight text-amber-900">
          As cores indicam o sentido da mudança, não se ela é boa: alumínio que sobe é ruim, cálcio
          que sobe é bom. A classificação na tabela é preliminar, não validada por agrônomo.
        </p>
      </div>
    </aside>
  )
}
