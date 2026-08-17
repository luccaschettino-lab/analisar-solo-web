import { useState } from 'react'
import Modal from '../../componentes/Modal.jsx'
import { Campo, BotaoPrincipal, Aviso } from '../../componentes/formulario.jsx'
import { criarFazenda, atualizarFazenda } from '../../dados/fazendas.js'

// UF em maiúscula e no máximo 2 letras. Normalizado aqui em vez de no banco,
// porque a coluna é text livre e o dado sujo só apareceria no relatório.
function normalizarUf(valor) {
  return valor.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
}

export default function FormFazenda({ fazenda, aoSalvar, aoFechar }) {
  const edicao = Boolean(fazenda)

  const [nome, setNome] = useState(fazenda?.nome ?? '')
  const [municipio, setMunicipio] = useState(fazenda?.municipio ?? '')
  const [uf, setUf] = useState(fazenda?.uf ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    if (!nome.trim()) {
      setErro('O nome da fazenda é obrigatório.')
      return
    }
    setErro('')
    setSalvando(true)
    try {
      const salva = edicao
        ? await atualizarFazenda(fazenda.id, { nome, municipio, uf })
        : await criarFazenda({ nome, municipio, uf })
      // Na edição o papel não volta do update: preserva o que já se sabia.
      aoSalvar({ ...(fazenda ?? {}), ...salva })
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={edicao ? 'Editar fazenda' : 'Nova fazenda'} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Aviso>{erro}</Aviso>

        <Campo
          id="fazenda-nome"
          rotulo="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          disabled={salvando}
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <Campo
              id="fazenda-municipio"
              rotulo="Município"
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              disabled={salvando}
            />
          </div>
          <div className="w-20">
            <Campo
              id="fazenda-uf"
              rotulo="UF"
              value={uf}
              onChange={(e) => setUf(normalizarUf(e.target.value))}
              disabled={salvando}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={aoFechar}
            disabled={salvando}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <div className="w-32">
            <BotaoPrincipal type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </BotaoPrincipal>
          </div>
        </div>
      </form>
    </Modal>
  )
}
