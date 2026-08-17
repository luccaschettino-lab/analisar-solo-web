import { useState } from 'react'
import Modal from '../../componentes/Modal.jsx'
import { Campo, BotaoPrincipal, Aviso } from '../../componentes/formulario.jsx'
import { criarTalhao, atualizarTalhao } from '../../dados/talhoes.js'
import { areaEmHectares } from '../../lib/geo.js'
import { CORES_TALHAO } from '../../config/mapa.js'

export default function FormTalhao({ fazendaId, talhao, geometria, aoSalvar, aoFechar }) {
  const edicao = Boolean(talhao)
  const geo = geometria ?? talhao?.geometria

  const [codigo, setCodigo] = useState(talhao?.codigo ?? '')
  const [nome, setNome] = useState(talhao?.nome ?? '')
  const [cor, setCor] = useState(talhao?.cor ?? CORES_TALHAO[0])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Calculada aqui e gravada junto da geometria — as duas sempre andam juntas.
  const areaHa = areaEmHectares(geo)

  async function enviar(evento) {
    evento.preventDefault()
    if (!codigo.trim()) {
      setErro('O código do talhão é obrigatório.')
      return
    }
    setErro('')
    setSalvando(true)
    try {
      const salvo = edicao
        ? await atualizarTalhao(talhao.id, { codigo, nome, cor, geometria: geo, areaHa })
        : await criarTalhao({ fazendaId, codigo, nome, cor, geometria: geo, areaHa })
      aoSalvar(salvo)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={edicao ? `Editar talhão ${talhao.codigo}` : 'Novo talhão'} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Aviso>{erro}</Aviso>

        <div className="flex gap-3">
          <div className="w-28">
            <Campo
              id="talhao-codigo"
              rotulo="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="8"
              required
              disabled={salvando}
            />
          </div>
          <div className="flex-1">
            <Campo
              id="talhao-nome"
              rotulo="Nome (opcional)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Baixada"
              disabled={salvando}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          O código vem da coluna <strong>Lote</strong> do laudo do laboratório.
        </p>

        <div className="space-y-1">
          <span className="block text-sm font-medium text-slate-700">Cor no mapa</span>
          <div className="flex flex-wrap gap-2">
            {CORES_TALHAO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                disabled={salvando}
                style={{ backgroundColor: c }}
                className={`h-7 w-7 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 ${
                  cor === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Área desenhada:{' '}
          <strong className="text-slate-900">
            {areaHa != null
              ? `${areaHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
              : '—'}
          </strong>
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
