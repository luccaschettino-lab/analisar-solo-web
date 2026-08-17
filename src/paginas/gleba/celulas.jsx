import { SEM_MEDICAO } from '../../config/parametros.js'
import { formatarValor, temMedicao } from '../../lib/parametros.js'
import { calcularDiferenca, textoDaDiferenca } from '../../lib/comparacao.js'

/** Valor medido, ou "sem medição" — nunca um traço que possa parecer zero. */
export function Valor({ chave, valor, esmaecido }) {
  if (!temMedicao(valor)) {
    return <span className="text-xs italic text-slate-400">{SEM_MEDICAO}</span>
  }
  return (
    <span className={esmaecido ? 'text-slate-500' : 'font-medium text-slate-800'}>
      {formatarValor(chave, valor)}
    </span>
  )
}

/**
 * Variação entre duas safras.
 *
 * Sem seta colorida de bom ou ruim: subir alumínio é péssimo, subir cálcio é
 * ótimo, e o pH tem um ponto ideal no meio. A direção fica com a leitura; aqui
 * é só o fato.
 */
export function Variacao({ chave, atual, anterior, casas }) {
  const d = calcularDiferenca(atual, anterior)

  // Sem base não é "0%": é impossível comparar. Dizer 0% inventaria
  // estabilidade onde só existe falta de dado.
  if (!d) return <span className="text-xs italic text-slate-300">—</span>

  return (
    <span className="text-slate-600">
      <span aria-hidden="true" className="text-slate-400">
        {d.sentido === 'subiu' ? '▲' : d.sentido === 'desceu' ? '▼' : '='}
      </span>{' '}
      {textoDaDiferenca(d, casas)}
      {d.tipo === 'absoluta' && <span className="text-xs text-slate-400"> abs.</span>}
    </span>
  )
}
