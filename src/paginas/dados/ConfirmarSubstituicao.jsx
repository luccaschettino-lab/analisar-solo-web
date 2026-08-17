import { useState } from 'react'
import Modal from '../../componentes/Modal.jsx'
import { Aviso } from '../../componentes/formulario.jsx'

function formatarData(iso) {
  if (!iso) return 'sem data'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * Conflito na chave natural (gleba, ano-safra, profundidade).
 *
 * O conflito nunca é silenciado: nem sobrescrevendo por baixo dos panos, nem
 * devolvendo um erro seco de constraint. O usuário vê o que já existe, com
 * data e número de amostra, e decide.
 */
export default function ConfirmarSubstituicao({
  existente,
  anoSafra,
  profundidade,
  moveria,
  aoSubstituir,
  aoFechar,
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function substituir() {
    setErro('')
    setSalvando(true)
    try {
      await aoSubstituir()
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Já existe uma análise para essa combinação" aoFechar={salvando ? () => {} : aoFechar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Esta gleba já tem uma análise de <strong>{anoSafra}</strong> na profundidade{' '}
          <strong>{profundidade} cm</strong>.
        </p>

        <dl className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Coleta</dt>
            <dd className="font-medium text-slate-800">{formatarData(existente.data_coleta)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Amostra do laboratório</dt>
            <dd className="font-medium text-slate-800">{existente.numero_amostra_lab || '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Origem</dt>
            <dd className="font-medium text-slate-800">{existente.origem}</dd>
          </div>
        </dl>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Substituir troca <strong>todos</strong> os valores da análise existente pelos
          que você preencheu — inclusive apagando os que você deixou em branco.
          {moveria && (
            <>
              {' '}
              A análise que você estava editando será removida, porque as duas passariam
              a ocupar a mesma safra e profundidade.
            </>
          )}
        </div>

        <Aviso>{erro}</Aviso>

        <div className="flex justify-end gap-2">
          <button
            onClick={aoFechar}
            disabled={salvando}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={substituir}
            disabled={salvando}
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-slate-300"
          >
            {salvando ? 'Substituindo…' : 'Substituir'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
