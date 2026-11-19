import { useState } from 'react'
import Modal from '../../componentes/Modal.jsx'
import { CULTURAS, ESTADIOS } from '../../config/pragas.js'
import { INPUT, SELECT, BOTAO, BOTAO_PRINCIPAL, Aviso, hojeIso } from './comum.jsx'

/** Criar ou editar a vistoria: data, cultura, estádio e observação. */
export default function FormVistoria({ inicial, talhaoRotulo, aoSalvar, aoFechar }) {
  const [data, setData] = useState(inicial?.data ?? hojeIso())
  const [cultura, setCultura] = useState(inicial?.cultura ?? 'soja')
  const [estadio, setEstadio] = useState(inicial?.estadio ?? '')
  const [observacao, setObservacao] = useState(inicial?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setErro(null)
    if (!data) return setErro('Informe a data da vistoria.')
    setSalvando(true)
    try {
      await aoSalvar({ data, cultura, estadio: estadio.trim(), observacao: observacao.trim() })
    } catch (falha) {
      setErro(falha.message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={inicial?.id ? 'Editar vistoria' : `Nova vistoria · talhão ${talhaoRotulo}`} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            Data
            <input type="date" value={data} max={hojeIso()} onChange={(e) => setData(e.target.value)} className={`${INPUT} mt-1`} />
          </label>
          <label className="block text-sm text-slate-700 dark:text-slate-200">
            Cultura
            <select value={cultura} onChange={(e) => setCultura(e.target.value)} className={`${SELECT} mt-1`}>
              {CULTURAS.map((c) => (
                <option key={c.chave} value={c.chave}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm text-slate-700 dark:text-slate-200">
          Estádio da cultura
          <input
            list={`estadios-${cultura}`}
            value={estadio}
            maxLength={30}
            onChange={(e) => setEstadio(e.target.value)}
            placeholder={cultura === 'soja' ? 'Ex.: V4, R3' : 'Ex.: Chumbinho, Granação'}
            className={`${INPUT} mt-1`}
          />
          <datalist id={`estadios-${cultura}`}>
            {ESTADIOS[cultura].map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <details className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <summary className="cursor-pointer">O que é o estádio?</summary>
            {cultura === 'soja' ? (
              <p className="mt-1">
                A fase da lavoura hoje. <strong>V</strong> = vegetativo, só folhas (V3 = 3 folhas abertas). <strong>R</strong> = reprodutivo: R1-R2
                flor, R3-R4 vagens, R5-R6 enchendo grão, R7-R8 maturação. Muda o nível de controle: percevejo só conta de R3 em diante, e a
                desfolha tolerada cai de 30% para 15% a partir de R1. Opcional.
              </p>
            ) : (
              <p className="mt-1">A fase da lavoura hoje: florada, chumbinho (fruto pequeno), expansão, granação, maturação, colheita. Opcional.</p>
            )}
          </details>
        </label>
        <label className="block text-sm text-slate-700 dark:text-slate-200">
          Observação (opcional)
          <textarea value={observacao} maxLength={1000} rows={2} onChange={(e) => setObservacao(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={aoFechar} className={BOTAO}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className={BOTAO_PRINCIPAL}>
            {salvando ? 'Salvando…' : inicial?.id ? 'Salvar' : 'Começar vistoria'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
