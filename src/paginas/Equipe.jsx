import { useCallback, useEffect, useState } from 'react'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { CARGOS, ROTULO_PAPEL } from '../lib/permissoes.js'
import {
  listarEquipe,
  mudarCargo,
  removerDaEquipe,
  listarConvites,
  criarConvite,
  cancelarConvite,
  linkDoConvite,
} from '../dados/equipe.js'

/**
 * Equipe da fazenda (só o proprietário): convida por link com o cargo
 * escolhido na hora, e depois troca o cargo ou tira o acesso de quem entrou.
 */

const SELECT =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:text-slate-400 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30'
const BOTAO =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5'
const BOTAO_PRINCIPAL =
  'rounded-lg bg-solo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-solo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500 disabled:opacity-50 dark:bg-solo-600 dark:hover:bg-solo-500'

const COR_CARGO = {
  proprietario: 'bg-solo-100 text-solo-800 dark:bg-solo-500/20 dark:text-solo-200',
  agronomo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  editor: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  leitor: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
}

const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

function Cartao({ titulo, subtitulo, icone, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 flex items-start gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-solo-50 text-lg dark:bg-solo-500/15">
          {icone}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
          {subtitulo && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Etiqueta({ papel }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR_CARGO[papel] ?? COR_CARGO.leitor}`}>{ROTULO_PAPEL[papel] ?? papel}</span>
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

function mensagemDoConvite(fazenda, papel, link) {
  return `Olá! Você foi convidado(a) para a fazenda ${fazenda} no Moinho, como ${ROTULO_PAPEL[papel]}. Abra o link para entrar (vale 7 dias e é só para você): ${link}`
}

/** O link recém-criado (ou reaberto), com copiar e WhatsApp. */
function LinkGerado({ convite, fazenda, aoFechar }) {
  const link = linkDoConvite(convite.token)
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        Link de convite {convite.para ? `para ${convite.para} ` : ''}como {ROTULO_PAPEL[convite.papel]}
      </p>
      <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-200">Vale 7 dias e só para uma pessoa. Mande pelo WhatsApp ou como preferir.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input readOnly value={link} onFocus={(e) => e.target.select()} className={`${SELECT} min-w-0 flex-1 font-mono text-xs`} aria-label="Link do convite" />
        <button type="button" className={BOTAO} onClick={async () => setCopiado(await copiar(link))}>
          {copiado ? 'Copiado ✓' : 'Copiar link'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagemDoConvite(fazenda, convite.papel, link))}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-[#25d366] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-95"
        >
          Enviar pelo WhatsApp
        </a>
        {aoFechar && (
          <button type="button" className="px-2 text-sm text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-200" onClick={aoFechar}>
            Fechar
          </button>
        )}
      </div>
    </div>
  )
}

export default function Equipe() {
  const { fazendaSelecionada, proprietario } = useFazendaAtual()
  const { usuario } = useAuth()
  const fazendaId = fazendaSelecionada?.id

  const [membros, setMembros] = useState([])
  const [convites, setConvites] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(null) // id do que está salvando

  const [papelNovo, setPapelNovo] = useState('agronomo')
  const [para, setPara] = useState('')
  const [gerado, setGerado] = useState(null)
  const [aRemover, setARemover] = useState(null)

  const recarregar = useCallback(async () => {
    if (!fazendaId) return
    setErro(null)
    try {
      const [m, c] = await Promise.all([listarEquipe(fazendaId), listarConvites(fazendaId)])
      setMembros(m)
      setConvites(c)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [fazendaId])

  useEffect(() => {
    setCarregando(true)
    setGerado(null)
    setMembros([])
    setConvites([])
    if (proprietario) recarregar()
    else setCarregando(false)
  }, [recarregar, proprietario])

  if (!fazendaSelecionada) {
    return <p className="m-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">Escolha uma fazenda na barra lateral.</p>
  }
  if (!proprietario) {
    return (
      <p className="m-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Só o proprietário da fazenda gerencia a equipe. O seu cargo em <strong>{fazendaSelecionada.nome}</strong> é {ROTULO_PAPEL[fazendaSelecionada.papel]}.
      </p>
    )
  }

  async function gerarConvite() {
    setOcupado('novo')
    setErro(null)
    try {
      const c = await criarConvite(fazendaId, papelNovo, para)
      setGerado(c)
      setPara('')
      setConvites((lista) => [c, ...lista])
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(null)
    }
  }

  async function trocarCargo(m, papel) {
    setOcupado(m.usuario_id)
    setErro(null)
    try {
      await mudarCargo(fazendaId, m.usuario_id, papel)
      setMembros((lista) => lista.map((x) => (x.usuario_id === m.usuario_id ? { ...x, papel } : x)))
    } catch (e) {
      setErro(/proprietário/i.test(e.message) ? e.message : `${e.message}. Se for o único proprietário, torne outra pessoa proprietária antes.`)
    } finally {
      setOcupado(null)
    }
  }

  async function remover(m) {
    setOcupado(m.usuario_id)
    setErro(null)
    try {
      await removerDaEquipe(fazendaId, m.usuario_id)
      // Saiu da própria fazenda: recarrega para ela sumir da lista.
      if (m.usuario_id === usuario?.id) {
        window.location.reload()
        return
      }
      setMembros((lista) => lista.filter((x) => x.usuario_id !== m.usuario_id))
      setARemover(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(null)
    }
  }

  async function cancelar(c) {
    setOcupado(c.id)
    try {
      await cancelarConvite(c.id)
      setConvites((lista) => lista.filter((x) => x.id !== c.id))
      if (gerado?.id === c.id) setGerado(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(null)
    }
  }

  const agora = Date.now()
  const pendentes = convites.filter((c) => !c.usado_em && Date.parse(c.expira_em) > agora)
  const proprietarios = membros.filter((m) => m.papel === 'proprietario').length

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-noite-900 sm:px-6">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solo-50 text-lg dark:bg-solo-500/15">
          👥
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Equipe</h1>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{fazendaSelecionada.nome} · quem pode ver e editar esta fazenda</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6 lg:grid-cols-2">
          {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300 lg:col-span-2">{erro}</p>}

          <Cartao icone="✉️" titulo="Convidar alguém" subtitulo="Escolha o cargo, gere o link e mande para a pessoa. Ela cria a senha e já entra na fazenda.">
            <fieldset disabled={ocupado === 'novo'}>
              <legend className="sr-only">Cargo de quem vai receber o convite</legend>
              <div className="space-y-1.5">
                {CARGOS.map((c) => (
                  <label
                    key={c.papel}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition ${
                      papelNovo === c.papel ? 'border-solo-600 bg-solo-50 dark:border-solo-500 dark:bg-solo-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5'
                    }`}
                  >
                    <input type="radio" name="cargo" value={c.papel} checked={papelNovo === c.papel} onChange={() => setPapelNovo(c.papel)} className="mt-1 accent-solo-600" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{c.rotulo}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{c.faz}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Para quem é (opcional, só para você lembrar)
                  <input value={para} maxLength={80} onChange={(e) => setPara(e.target.value)} placeholder="Ex.: João, agrônomo da revenda" className={`${SELECT} mt-1 w-full`} />
                </label>
                <button type="button" onClick={gerarConvite} className={BOTAO_PRINCIPAL}>
                  {ocupado === 'novo' ? 'Gerando…' : 'Gerar link de convite'}
                </button>
              </div>
            </fieldset>
            {gerado && <LinkGerado convite={gerado} fazenda={fazendaSelecionada.nome} aoFechar={() => setGerado(null)} />}
          </Cartao>

          <div className="space-y-4">
            <Cartao icone="👥" titulo="Pessoas com acesso" subtitulo="Troque o cargo a qualquer momento. A fazenda sempre precisa de pelo menos um proprietário.">
              {carregando ? (
                <p className="text-sm text-slate-500">Carregando…</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-white/10">
                  {membros.map((m) => {
                    const souEu = m.usuario_id === usuario?.id
                    const ultimoDono = m.papel === 'proprietario' && proprietarios <= 1
                    return (
                      <li key={m.usuario_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solo-700 text-sm font-bold text-white">
                          {(m.nome || m.email || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {m.nome || m.email} {souEu && <span className="font-normal text-slate-400">(você)</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {m.nome ? `${m.email} · ` : ''}desde {new Date(m.desde).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        {aRemover === m.usuario_id ? (
                          <span className="flex items-center gap-2 text-xs">
                            Tirar o acesso?
                            <button type="button" className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700" disabled={ocupado === m.usuario_id} onClick={() => remover(m)}>
                              Tirar
                            </button>
                            <button type="button" className="text-slate-500 hover:underline" onClick={() => setARemover(null)}>
                              Voltar
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <select
                              value={m.papel}
                              aria-label={`Cargo de ${m.nome || m.email}`}
                              disabled={ocupado === m.usuario_id || ultimoDono}
                              title={ultimoDono ? 'É o único proprietário: torne outra pessoa proprietária antes.' : undefined}
                              onChange={(e) => trocarCargo(m, e.target.value)}
                              className={SELECT}
                            >
                              {CARGOS.map((c) => (
                                <option key={c.papel} value={c.papel}>
                                  {c.rotulo}
                                </option>
                              ))}
                            </select>
                            {!ultimoDono && (
                              <button
                                type="button"
                                title={souEu ? 'Sair da fazenda' : 'Tirar o acesso'}
                                aria-label={souEu ? 'Sair da fazenda' : `Tirar o acesso de ${m.nome || m.email}`}
                                onClick={() => setARemover(m.usuario_id)}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                  <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Cartao>

            <Cartao icone="⏳" titulo="Convites pendentes" subtitulo="Links gerados que ainda não foram usados.">
              {pendentes.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum convite esperando.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-white/10">
                  {pendentes.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                          <span className="truncate">{c.para || 'Sem nome'}</span>
                          <Etiqueta papel={c.papel} />
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">criado em {dataCurta(c.criado_em)} · vence em {dataCurta(c.expira_em)}</p>
                      </div>
                      <button type="button" className={BOTAO} onClick={() => setGerado(c)}>
                        Ver link
                      </button>
                      <button type="button" className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400" disabled={ocupado === c.id} onClick={() => cancelar(c)}>
                        Cancelar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>
        </div>
      </div>
    </div>
  )
}
