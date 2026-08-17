import { useState } from 'react'
import Modal from './Modal.jsx'
import { Aviso } from './formulario.jsx'

/**
 * Confirmação de exclusão com o que será perdido em cascata.
 *
 * `consequencias` é uma lista de { rotulo, quantidade }. Itens com quantidade
 * zero são omitidos: "0 análises serão perdidas" é ruído que treina o usuário
 * a ignorar o diálogo.
 */
export default function ConfirmarExclusao({
  titulo,
  descricao,
  consequencias = [],
  aoConfirmar,
  aoFechar,
}) {
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState('')

  const relevantes = consequencias.filter((c) => c.quantidade > 0)

  async function confirmar() {
    setErro('')
    setExcluindo(true)
    try {
      await aoConfirmar()
      // Não devolvemos `excluindo` para false: quem chama fecha o diálogo.
    } catch (e) {
      setErro(e.message)
      setExcluindo(false)
    }
  }

  return (
    <Modal titulo={titulo} aoFechar={excluindo ? () => {} : aoFechar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{descricao}</p>

        {relevantes.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-sm font-medium text-amber-900">Também será apagado:</p>
            <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
              {relevantes.map((c) => (
                <li key={c.rotulo}>
                  {c.quantidade} {c.rotulo}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Aviso>{erro}</Aviso>

        <div className="flex justify-end gap-2">
          <button
            onClick={aoFechar}
            disabled={excluindo}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={excluindo}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-slate-300"
          >
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
