import { useState } from 'react'
import Modal from '../../componentes/Modal.jsx'
import { Campo, BotaoPrincipal, Aviso } from '../../componentes/formulario.jsx'
import { criarGleba, atualizarGleba } from '../../dados/glebas.js'
import { areaEmHectares, avaliarContencao, CONTENCAO, ehPonto } from '../../lib/geo.js'

export default function FormGleba({ talhao, gleba, geometria, aoSalvar, aoFechar }) {
  const edicao = Boolean(gleba)
  const geo = geometria ?? gleba?.geometria

  const [codigo, setCodigo] = useState(gleba?.codigo ?? '')
  const [nome, setNome] = useState(gleba?.nome ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const areaHa = areaEmHectares(geo)
  const ponto = ehPonto(geo)

  /**
   * Contenção da gleba no talhão. Passou a **bloquear** o salvamento, a pedido
   * do responsável — antes só avisava e deixava confirmar.
   *
   * A tolerância na divisa é o que torna o bloqueio viável: sem ela, uma
   * sub-área desenhada rente à cerca ficaria impossível de cadastrar, porque
   * o snap gruda o vértice na borda e o arredondamento o joga para fora.
   *
   * `nao_verificavel` não bloqueia: não saber conferir é diferente de saber
   * que está errado.
   */
  const contencao = avaliarContencao(geo, talhao?.geometria)
  const foraDoTalhao = contencao.situacao === CONTENCAO.FORA

  async function enviar(evento) {
    evento.preventDefault()
    if (!codigo.trim()) {
      setErro('O código da gleba é obrigatório.')
      return
    }

    // Bloqueio, não confirmação. Antes o primeiro clique só acendia um aviso e
    // o segundo salvava — o que fazia o botão parecer quebrado para quem não
    // via o aviso.
    if (foraDoTalhao) {
      setErro(
        ponto
          ? `Este ponto está fora do talhão ${talhao.codigo}. Reposicione-o dentro do talhão para salvar.`
          : `Esta sub-área está fora do talhão ${talhao.codigo}. Redesenhe-a dentro do talhão para salvar.`,
      )
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
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
          >
            <p className="font-medium">
              {ponto ? 'Este ponto está' : 'Esta sub-área está'} fora do talhão {talhao.codigo}.
            </p>
            <p className="mt-1">
              {ponto
                ? 'Feche esta janela e marque o ponto dentro do talhão.'
                : `Fora do talhão: ${(contencao.fracaoFora * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% da sub-área${contencao.areaForaHa ? ` (${contencao.areaForaHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha)` : ''}. Feche esta janela e redesenhe dentro do talhão.`}
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
              rotulo="Descrição (opcional)"
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
            {/* Desabilitado, e não "salvar mesmo assim": o botão diz a verdade
                sobre o que vai acontecer se for clicado. */}
            <BotaoPrincipal type="submit" disabled={salvando || foraDoTalhao}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </BotaoPrincipal>
          </div>
        </div>
      </form>
    </Modal>
  )
}
