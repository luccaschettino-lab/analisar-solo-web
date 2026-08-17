import { useState } from 'react'
import Modal from '../../componentes/Modal.jsx'
import { Campo, BotaoPrincipal, Aviso } from '../../componentes/formulario.jsx'
import { criarGleba, atualizarGleba } from '../../dados/glebas.js'
import { areaEmHectares, glebaDentroDoTalhao, ehPonto } from '../../lib/geo.js'

export default function FormGleba({ talhao, gleba, geometria, aoSalvar, aoFechar }) {
  const edicao = Boolean(gleba)
  const geo = geometria ?? gleba?.geometria

  const [codigo, setCodigo] = useState(gleba?.codigo ?? '')
  const [nome, setNome] = useState(gleba?.nome ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  // Só vira true depois que o usuário viu o aviso de contenção uma vez.
  const [cienteDoFora, setCienteDoFora] = useState(false)

  const areaHa = areaEmHectares(geo)
  const ponto = ehPonto(geo)

  // true dentro, false fora, null quando não dá para verificar — talhão sem
  // geometria ou desenho degenerado. null nunca vira aviso: seria alarme falso.
  const contido = glebaDentroDoTalhao(geo, talhao?.geometria)
  const foraDoTalhao = contido === false

  async function enviar(evento) {
    evento.preventDefault()
    if (!codigo.trim()) {
      setErro('O código da gleba é obrigatório.')
      return
    }

    // Avisa uma vez e deixa salvar na segunda tentativa. O GPS de campo erra,
    // e o produtor conhece a terra dele melhor que o desenho — o aviso serve
    // para ele reparar, não para impedir.
    if (foraDoTalhao && !cienteDoFora) {
      setCienteDoFora(true)
      setErro('')
      return
    }

    setErro('')
    setSalvando(true)
    try {
      const salva = edicao
        ? await atualizarGleba(gleba.id, { codigo, nome, geometria: geo, areaHa })
        : await criarGleba({ talhaoId: talhao.id, codigo, nome, geometria: geo, areaHa })
      aoSalvar(salva)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={edicao ? `Editar gleba ${gleba.codigo}` : `Nova gleba no talhão ${talhao.codigo}`}
      aoFechar={aoFechar}
    >
      <form onSubmit={enviar} className="space-y-4">
        <Aviso>{erro}</Aviso>

        {foraDoTalhao && (
          <div
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <p className="font-medium">
              {ponto ? 'Este ponto está' : 'Esta sub-área está'} fora do talhão {talhao.codigo}.
            </p>
            <p className="mt-1">
              Confira se é isso mesmo. Se estiver certo, clique em salvar de novo para
              confirmar.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <div className="w-28">
            <Campo
              id="gleba-codigo"
              rotulo="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="G1"
              required
              disabled={salvando}
            />
          </div>
          <div className="flex-1">
            <Campo
              id="gleba-nome"
              rotulo="Nome (opcional)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Perto do córrego"
              disabled={salvando}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Este código é seu e não muda entre safras. O número que o laboratório
          imprime no laudo é outro, e vai junto da análise.
        </p>

        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {ponto ? (
            <>Registrada como <strong className="text-slate-900">ponto de coleta</strong>, sem área.</>
          ) : (
            <>
              Área desenhada:{' '}
              <strong className="text-slate-900">
                {areaHa != null
                  ? `${areaHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
                  : '—'}
              </strong>
            </>
          )}
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
          <div className="w-40">
            <BotaoPrincipal type="submit" disabled={salvando}>
              {salvando
                ? 'Salvando…'
                : foraDoTalhao && cienteDoFora
                  ? 'Salvar mesmo assim'
                  : 'Salvar'}
            </BotaoPrincipal>
          </div>
        </div>
      </form>
    </Modal>
  )
}
