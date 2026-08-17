import { SEM_MEDICAO } from '../../config/parametros.js'
import { formatarValor, temMedicao, parametro } from '../../lib/parametros.js'
import { calcularDiferenca, textoDaDiferenca } from '../../lib/comparacao.js'

const SETA = { subiu: '▲', desceu: '▼', igual: '=' }

export default function CelulaParametro({ chave, valor, valorComparado, comparando }) {
  const medido = temMedicao(valor)

  if (!medido) {
    return (
      <span className="whitespace-nowrap text-xs italic text-slate-400">{SEM_MEDICAO}</span>
    )
  }

  const linhaValor = (
    <span className="block whitespace-nowrap font-medium text-slate-800">
      {formatarValor(chave, valor)}
    </span>
  )

  if (!comparando) return linhaValor

  const diferenca = calcularDiferenca(valor, valorComparado)

  // Comparado ausente: não há base. Dizer "0%" aqui inventaria estabilidade
  // onde só existe falta de dado.
  if (!diferenca) {
    return (
      <>
        {linhaValor}
        <span className="block whitespace-nowrap text-xs italic text-slate-300">sem base</span>
      </>
    )
  }

  const casas = parametro(chave)?.casas ?? 2
  const texto = textoDaDiferenca(diferenca, casas)

  return (
    <>
      {linhaValor}
      <span className="block whitespace-nowrap text-xs text-slate-500">
        <span className="text-slate-300">{formatarValor(chave, valorComparado)}</span>{' '}
        <span aria-hidden="true">{SETA[diferenca.sentido]}</span> {texto}
        {diferenca.tipo === 'absoluta' && <span className="text-slate-400"> abs.</span>}
      </span>
    </>
  )
}
