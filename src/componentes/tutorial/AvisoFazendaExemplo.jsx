import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../Modal.jsx'
import { useFazendaAtual } from '../../context/FazendaContext.jsx'
import { excluirFazenda } from '../../dados/fazendas.js'

/**
 * Faixa no topo enquanto a fazenda de exemplo está aberta: lembra que os
 * dados são fictícios e oferece sair dela ou excluí-la. Excluir o exemplo não
 * pede a senha das exclusões de verdade — não há dado real a proteger.
 */
export default function AvisoFazendaExemplo() {
  const { fazendaSelecionada, fazendas, selecionarFazenda, removerFazenda, setFormFazenda } = useFazendaAtual()
  const navegar = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState('')

  if (!fazendaSelecionada?.exemplo) return null
  const outra = fazendas.find((f) => !f.exemplo)

  async function excluir() {
    setErro('')
    setExcluindo(true)
    try {
      await excluirFazenda(fazendaSelecionada.id)
      removerFazenda(fazendaSelecionada.id)
      selecionarFazenda(outra?.id ?? '')
      setConfirmando(false)
    } catch (e) {
      setErro(e.message)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="font-medium">Fazenda de exemplo:</span>
        <span>dados fictícios, para conhecer o sistema. Pode mexer à vontade.</span>
        <span className="ml-auto flex gap-2">
          {outra ? (
            <button type="button" onClick={() => selecionarFazenda(outra.id)} className="rounded px-2 py-1 font-medium underline-offset-2 hover:underline">
              Ir para {outra.nome}
            </button>
          ) : (
            <button type="button" onClick={() => { setFormFazenda('nova'); navegar('/') }} className="rounded px-2 py-1 font-medium underline-offset-2 hover:underline">
              Cadastrar a minha fazenda
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded border border-amber-300 px-2 py-1 font-medium hover:bg-amber-100 dark:border-amber-400/30 dark:hover:bg-amber-500/15"
          >
            Excluir exemplo
          </button>
        </span>
      </div>

      {confirmando && (
        <Modal titulo="Excluir a fazenda de exemplo?" aoFechar={() => !excluindo && setConfirmando(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Somem os talhões, glebas e análises fictícios. Suas fazendas não são tocadas. Dá para criar o exemplo de novo em
            Ajustes → Tutorial.
          </p>
          {erro && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{erro}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={excluindo}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void excluir()}
              disabled={excluindo}
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              {excluindo ? 'Excluindo…' : 'Excluir exemplo'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
