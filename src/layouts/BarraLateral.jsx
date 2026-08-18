import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { glebasDoTalhao } from '../hooks/useHierarquia.js'
import { ROTULO_PAPEL } from '../lib/permissoes.js'

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600'
const ITEM = `flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition md:py-1.5 ${FOCO}`

function Seta({ aberto }) {
  return (
    <span aria-hidden="true" className="w-3 shrink-0 text-xs text-slate-400">
      {aberto ? '▾' : '▸'}
    </span>
  )
}

/**
 * Navegação em cascata: Fazenda › Talhão › Gleba › seção.
 *
 * Substitui o menu do topo, as abas das telas e o painel do mapa. A ideia é
 * ter um lugar só onde se sabe onde está e para onde dá para ir.
 *
 * Clicar numa gleba **seleciona** ela no mapa; as sub-entradas Análises e
 * Histórico **navegam**. A distinção existe porque as duas ações são
 * legítimas e a mais frequente — olhar no mapa — deve ser a mais barata.
 */
export default function BarraLateral({ aoNavegar }) {
  const {
    fazendas, carregandoFazendas, erroFazendas,
    fazendaSelecionada, selecionarFazenda, editor,
    talhoes, glebas, carregando: carregandoHierarquia,
    selecionado, setSelecionado, setPedidoDeDesenho,
  } = useFazendaAtual()

  const navegar = useNavigate()
  const local = useLocation()
  const [abertos, setAbertos] = useState(() => new Set())
  const [glebaAberta, setGlebaAberta] = useState(null)

  // Abre o ramo do item selecionado no mapa: clicar numa gleba no mapa deve
  // revelá-la aqui, não deixá-la escondida sob um nó fechado.
  useEffect(() => {
    if (!selecionado) return
    const idTalhao =
      selecionado.tipo === 'talhao'
        ? selecionado.id
        : glebas.find((g) => g.id === selecionado.id)?.talhao_id
    if (idTalhao) setAbertos((a) => new Set(a).add(idTalhao))
    if (selecionado.tipo === 'gleba') setGlebaAberta(selecionado.id)
  }, [selecionado, glebas])

  function alternar(id) {
    setAbertos((atual) => {
      const proximo = new Set(atual)
      proximo.has(id) ? proximo.delete(id) : proximo.add(id)
      return proximo
    })
  }

  function irPara(caminho) {
    navegar(caminho)
    aoNavegar?.()
  }

  function selecionarNoMapa(alvo) {
    setSelecionado(alvo)
    // Selecionar é ação de mapa: se o usuário está em outra tela, leva de volta.
    if (local.pathname !== '/') navegar('/')
    aoNavegar?.()
  }

  function pedirDesenho(pedido) {
    setPedidoDeDesenho(pedido)
    if (local.pathname !== '/') navegar('/')
    aoNavegar?.()
  }

  return (
    <nav aria-label="Navegação" className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-slate-200 px-3 py-3">
        <label htmlFor="barra-fazenda" className="block text-xs font-medium text-slate-500">
          Fazenda
        </label>
        {erroFazendas ? (
          <p role="alert" className="mt-1 text-xs text-red-700">{erroFazendas}</p>
        ) : (
          <select
            id="barra-fazenda"
            value={fazendaSelecionada?.id ?? ''}
            onChange={(e) => selecionarFazenda(e.target.value)}
            disabled={carregandoFazendas || fazendas.length === 0}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50"
          >
            <option value="">
              {carregandoFazendas ? 'carregando…' : fazendas.length ? 'selecione…' : 'nenhuma fazenda'}
            </option>
            {fazendas.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        )}
        {fazendaSelecionada && (
          <p className="mt-1 text-xs text-slate-400">
            {ROTULO_PAPEL[fazendaSelecionada.papel] ?? fazendaSelecionada.papel}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 px-2 py-2">
        <button onClick={() => irPara('/')} className={`${ITEM} font-medium ${local.pathname === '/' ? 'bg-solo-50 text-solo-800' : 'text-slate-700 hover:bg-slate-100'}`}>
          <span aria-hidden="true">🗺</span> Mapa
        </button>

        {fazendaSelecionada && (
          <div className="mt-1">
            {carregandoHierarquia ? (
              <p className="px-2 py-2 text-xs text-slate-400">carregando talhões…</p>
            ) : talhoes.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-500">
                Nenhum talhão. {editor && 'Desenhe o primeiro no mapa.'}
              </p>
            ) : (
              <ul className="ml-2 border-l border-slate-200 pl-1">
                {talhoes.map((talhao) => {
                  const filhas = glebasDoTalhao(glebas, talhao.id)
                  const aberto = abertos.has(talhao.id)
                  const ativo = selecionado?.tipo === 'talhao' && selecionado.id === talhao.id
                  return (
                    <li key={talhao.id}>
                      <div className="flex items-stretch">
                        <button
                          onClick={() => alternar(talhao.id)}
                          aria-expanded={aberto}
                          aria-label={`${aberto ? 'Recolher' : 'Expandir'} talhão ${talhao.codigo}`}
                          className={`w-8 shrink-0 md:w-5 ${FOCO}`}
                        >
                          <Seta aberto={aberto} />
                        </button>
                        <button
                          onClick={() => selecionarNoMapa({ tipo: 'talhao', id: talhao.id })}
                          className={`${ITEM} ${ativo ? 'bg-solo-50 text-solo-800' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: talhao.cor }} />
                          <span className="truncate">
                            {talhao.codigo}
                            {talhao.nome && <span className="text-slate-400"> · {talhao.nome}</span>}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-slate-400">{filhas.length}</span>
                        </button>
                      </div>

                      {aberto && (
                        <ul className="ml-4 border-l border-slate-200 pl-1">
                          {filhas.map((gleba) => {
                            const expandida = glebaAberta === gleba.id
                            const glebaAtiva = selecionado?.tipo === 'gleba' && selecionado.id === gleba.id
                            return (
                              <li key={gleba.id}>
                                <div className="flex items-stretch">
                                  <button
                                    onClick={() => setGlebaAberta(expandida ? null : gleba.id)}
                                    aria-expanded={expandida}
                                    aria-label={`${expandida ? 'Recolher' : 'Expandir'} gleba ${gleba.codigo}`}
                                    className={`w-8 shrink-0 md:w-5 ${FOCO}`}
                                  >
                                    <Seta aberto={expandida} />
                                  </button>
                                  <button
                                    onClick={() => selecionarNoMapa({ tipo: 'gleba', id: gleba.id })}
                                    className={`${ITEM} ${glebaAtiva ? 'bg-amber-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
                                  >
                                    <span className="truncate">
                                      {gleba.codigo}
                                      {gleba.nome && <span className="text-slate-400"> · {gleba.nome}</span>}
                                    </span>
                                  </button>
                                </div>

                                {expandida && (
                                  <ul className="ml-8 md:ml-5">
                                    <li>
                                      <button onClick={() => irPara(`/glebas/${gleba.id}`)} className={`${ITEM} text-slate-600 hover:bg-slate-100`}>
                                        Análises
                                      </button>
                                    </li>
                                    <li>
                                      <button onClick={() => irPara(`/glebas/${gleba.id}?aba=historico`)} className={`${ITEM} text-slate-600 hover:bg-slate-100`}>
                                        Histórico
                                      </button>
                                    </li>
                                  </ul>
                                )}
                              </li>
                            )
                          })}

                          {editor && (
                            <li>
                              <button
                                onClick={() => pedirDesenho({ tipo: 'gleba', talhaoId: talhao.id })}
                                className={`${ITEM} pl-8 text-xs font-medium text-solo-700 hover:bg-solo-50 md:pl-5`}
                              >
                                + Gleba
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {editor && (
              <button
                onClick={() => pedirDesenho({ tipo: 'talhao' })}
                className={`${ITEM} mt-1 text-xs font-medium text-solo-700 hover:bg-solo-50`}
              >
                + Talhão
              </button>
            )}
          </div>
        )}

        <div className="mt-3 border-t border-slate-200 pt-2">
          {/* Comparação entre anos. Sem guard de papel: quem enxerga a fazenda
              enxerga o histórico dela — a RLS já decide isso na leitura. */}
          <NavLink to="/comparar" className={({ isActive }) => `${ITEM} font-medium ${isActive ? 'bg-solo-50 text-solo-800' : 'text-slate-700 hover:bg-slate-100'}`} onClick={aoNavegar}>
            <span aria-hidden="true">📈</span> Comparar anos
          </NavLink>

          <NavLink to="/dados" className={({ isActive }) => `${ITEM} mt-1 font-medium ${isActive ? 'bg-solo-50 text-solo-800' : 'text-slate-700 hover:bg-slate-100'}`} onClick={aoNavegar}>
            <span aria-hidden="true">📋</span> Dados
          </NavLink>
          <ul className="ml-4 border-l border-slate-200 pl-1">
            <li>
              <button onClick={() => irPara('/dados')} className={`${ITEM} text-slate-600 hover:bg-slate-100`}>
                Entrada manual
              </button>
            </li>
            <li>
              <button onClick={() => irPara('/dados?aba=pdf')} className={`${ITEM} text-slate-600 hover:bg-slate-100`}>
                Importar laudo PDF
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  )
}
