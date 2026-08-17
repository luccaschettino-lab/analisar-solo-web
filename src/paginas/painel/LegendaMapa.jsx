import { useState } from 'react'
import { faixasParaLegenda, CINZA_HACHURA } from '../../lib/coloracao.js'
import { rotuloComUnidade } from '../../lib/parametros.js'

// Mesma hachura do mapa, em CSS: a legenda tem que mostrar exatamente o que
// aparece na gleba, senão não serve de chave de leitura.
const HACHURA_CSS = {
  backgroundColor: '#f1f5f9',
  backgroundImage: `repeating-linear-gradient(45deg, ${CINZA_HACHURA} 0 2px, transparent 2px 8px)`,
}

function Amostra({ cor, estilo }) {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-slate-300"
      style={estilo ?? { backgroundColor: cor }}
    />
  )
}

/**
 * Legenda das faixas, no canto do mapa.
 *
 * Só aparece com um parâmetro que tenha classificação. Sem parâmetro, ou com
 * um dos dez sem faixas, não há escala a explicar e a legenda some — mostrar
 * uma legenda vazia sugeriria que o mapa está colorido quando não está.
 */
export default function LegendaMapa({ chaveParametro, anoSafra, profundidade, elevada }) {
  // No celular começa recolhida: 224 px de legenda sobre uma tela de 360 tapam
  // justamente o mapa que ela explica. Em tela larga fica sempre aberta.
  const [aberta, setAberta] = useState(false)

  const faixas = faixasParaLegenda(chaveParametro)
  if (faixas.length === 0) return null

  return (
    <aside
      // Acima dos controles do Leaflet (1000), abaixo dos diálogos (2000).
      // bottom-8 livra a barra de atribuição; `elevada` sobe mais quando a
      // barra de detalhe do celular está ocupando o rodapé.
      className={`absolute right-2 z-[1100] w-auto rounded-lg border border-slate-200 bg-white/95 shadow-lg backdrop-blur md:right-3 md:w-56 md:p-3 ${
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

      <div className={`${aberta ? 'w-56 max-w-[80vw] p-3 pt-0' : 'hidden'} md:block md:w-auto md:max-w-none md:p-0`}>
      <h2 className="text-xs font-semibold text-slate-900">{rotuloComUnidade(chaveParametro)}</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        {anoSafra} · {profundidade} cm
      </p>

      <ul className="mt-2 space-y-1">
        {faixas.map((f) => (
          <li key={`${f.nivel}-${f.texto}`} className="flex items-start gap-2">
            <Amostra cor={f.cor} />
            <span className="text-xs leading-tight text-slate-700">
              <span className="font-medium">{f.rotulo}</span>
              <span className="block text-slate-500">{f.texto}</span>
            </span>
          </li>
        ))}

        {/* Duas amostras, porque a gleba pode ser área ou ponto e cada uma
            comunica ausência de um jeito. Mostrar só a hachura deixaria quem
            olha um ponto vazado sem chave de leitura. */}
        <li className="flex items-start gap-2 border-t border-slate-200 pt-1.5">
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
            <span className="font-medium">Sem dado</span>
            <span className="block text-slate-500">não amostrada ou não medida</span>
          </span>
        </li>
      </ul>

      {/* Exigido enquanto as faixas não passarem por validação agronômica.
          Ver a limitação registrada em docs/decisoes.md. */}
      <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-tight text-amber-900">
        Classificação preliminar, não validada por agrônomo.
      </p>
      </div>
    </aside>
  )
}
