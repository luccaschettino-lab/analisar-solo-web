import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { ROTULO_PAPEL } from '../lib/permissoes.js'

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-500'
const ITEM = `flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition md:py-1.5 ${FOCO}`
const ATIVO = 'bg-solo-50 text-solo-800 dark:bg-solo-500/15 dark:text-solo-300'
const INATIVO = 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'

function Seta({ aberto }) {
  return (
    <span aria-hidden="true" className="w-3 shrink-0 text-xs text-slate-400 dark:text-slate-500">
      {aberto ? '▾' : '▸'}
    </span>
  )
}

// Ícones de traço, no estilo Feather — um SVG só, sem depender de emoji do
// sistema. Emoji renderiza cor e forma diferente em cada fonte/SO (o mapa
// ficava colorido, o funil vinha num quadrado azul, o gráfico noutro
// branco), e o resultado era uma coluna sem identidade única. `currentColor`
// deixa o ícone seguir a mesma cor do texto do item — ativo, inativo, hover,
// tudo já resolvido pelas classes que já existiam.
const PROPRIEDADES_ICONE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function IconeMapa(props) {
  return (
    <svg {...PROPRIEDADES_ICONE} {...props}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

function IconeFiltro(props) {
  return (
    <svg {...PROPRIEDADES_ICONE} {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function IconeComparar(props) {
  return (
    <svg {...PROPRIEDADES_ICONE} {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconeDados(props) {
  return (
    <svg {...PROPRIEDADES_ICONE} {...props}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function IconeMonitoramento(props) {
  return (
    <svg {...PROPRIEDADES_ICONE} {...props}>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  )
}

function IconeCriterios(props) {
  return (
    <svg {...PROPRIEDADES_ICONE} {...props}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}

/** Ícone + rótulo, na mesma linha — o padrão de todo item da barra. */
function ItemNav({ to, Icone, rotulo, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `${ITEM} font-medium ${isActive ? ATIVO : INATIVO}`}
    >
      <Icone aria-hidden="true" className="h-4 w-4 shrink-0" />
      {rotulo}
    </NavLink>
  )
}

/**
 * Navegação em cascata: Fazenda › Talhão › seção.
 *
 * Substitui o menu do topo, as abas das telas e o painel do mapa. A ideia é
 * ter um lugar só onde se sabe onde está e para onde dá para ir.
 *
 * Clicar num talhão **seleciona** ele no mapa — é a única forma de ver os
 * dados dele: o mapa de calor, de acordo com o filtro escolhido. Não há mais
 * tabela de análises nem gráfico de histórico por talhão.
 */
export default function BarraLateral({ aoNavegar }) {
  const {
    fazendas, carregandoFazendas, erroFazendas,
    fazendaSelecionada, selecionarFazenda, editor,
    talhoes, carregando: carregandoHierarquia,
    selecionado, setSelecionado,
    setFormFazenda, setPedidoDeAcao,
  } = useFazendaAtual()

  const temSede = fazendaSelecionada?.sede_lat != null && fazendaSelecionada?.sede_lng != null

  const navegar = useNavigate()
  const local = useLocation()
  // Recolhida por padrão: numa fazenda com muitos talhões, a árvore inteira
  // aberta empurrava Dados/Monitoramento/Critérios para fora da primeira tela.
  const [arvoreAberta, setArvoreAberta] = useState(false)

  // Selecionar um talhão no mapa revela a árvore aqui, não deixa a seleção
  // escondida sob ela recolhida.
  useEffect(() => {
    if (!selecionado) return
    setArvoreAberta(true)
  }, [selecionado])

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

  /**
   * Ações que precisam do mapa ou de um diálogo do Painel: marcar/ir para a
   * sede, importar KML, mesclar talhões, excluir fazenda. A barra só registra
   * a intenção — quem executa é o Painel, na rota do mapa.
   */
  function pedirAcao(acao) {
    setPedidoDeAcao(acao)
    if (local.pathname !== '/') navegar('/')
    aoNavegar?.()
  }

  // O diálogo (FormFazenda) só renderiza dentro do Painel, que é a rota do
  // mapa — abrir de outra tela sem navegar deixaria o pedido registrado e
  // nada na tela pra mostrar.
  function novaFazenda() {
    setFormFazenda('nova')
    if (local.pathname !== '/') navegar('/')
    aoNavegar?.()
  }

  return (
    <nav aria-label="Navegação" className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-slate-200 px-3 py-3 dark:border-white/10">
        <label htmlFor="barra-fazenda" className="block text-xs font-medium text-slate-500 dark:text-slate-400">
          Fazenda
        </label>
        {erroFazendas ? (
          <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">{erroFazendas}</p>
        ) : (
          <select
            id="barra-fazenda"
            value={fazendaSelecionada?.id ?? ''}
            onChange={(e) => selecionarFazenda(e.target.value)}
            disabled={carregandoFazendas || fazendas.length === 0}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 disabled:bg-slate-50 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30 dark:disabled:text-slate-500"
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
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {ROTULO_PAPEL[fazendaSelecionada.papel] ?? fazendaSelecionada.papel}
          </p>
        )}

        {/* Ações da fazenda selecionada. Vieram do mapa: flutuavam sobre a
            imagem de satélite e brigavam com os rótulos de talhão. Aqui, perto
            do seletor, fazem mais sentido — são sobre a fazenda, não sobre o
            que está sendo olhado no mapa agora. */}
        {fazendaSelecionada && (editor || temSede) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {editor && (
              <button
                onClick={() => { setFormFazenda('editar'); if (local.pathname !== '/') navegar('/'); aoNavegar?.() }}
                className={`rounded px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 ${FOCO}`}
              >
                Editar
              </button>
            )}
            {editor && (
              <button
                onClick={() => pedirAcao('marcar-sede')}
                className={`rounded px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 ${FOCO}`}
              >
                Marcar sede
              </button>
            )}
            {/* Ir até a sede é leitura, não edição — um consultor também
                precisa se localizar. */}
            {temSede && (
              <button
                onClick={() => pedirAcao('ir-para-sede')}
                title="Centralizar o mapa na sede da fazenda"
                className={`rounded px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 ${FOCO}`}
              >
                <span aria-hidden="true">⌂</span> Ir para a sede
              </button>
            )}
            {editor && (
              // Separado por espaço, não por linha: é destrutivo, mas ainda é
              // uma ação da fazenda, não merece uma seção à parte.
              <button
                onClick={() => pedirAcao('excluir-fazenda')}
                className={`ml-auto rounded px-1.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 ${FOCO}`}
              >
                Excluir
              </button>
            )}
          </div>
        )}

        <button
          onClick={novaFazenda}
          className={`mt-1.5 rounded px-1 py-0.5 text-xs font-medium text-solo-700 hover:bg-solo-50 dark:text-solo-400 dark:hover:bg-solo-500/10 ${FOCO}`}
        >
          + Nova fazenda
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="flex items-stretch">
          {fazendaSelecionada && (
            <button
              onClick={() => setArvoreAberta((a) => !a)}
              aria-expanded={arvoreAberta}
              aria-label={`${arvoreAberta ? 'Recolher' : 'Expandir'} lista de talhões`}
              className={`w-5 shrink-0 ${FOCO}`}
            >
              <Seta aberto={arvoreAberta} />
            </button>
          )}
          <ItemNav to="/" Icone={IconeMapa} rotulo="Mapa" onClick={aoNavegar} />
        </div>

        <div className="mt-0.5 flex flex-col gap-0.5">
          {fazendaSelecionada && arvoreAberta && (
            <div>
              {carregandoHierarquia ? (
                <p className="px-2 py-2 text-xs text-slate-400 dark:text-slate-500">carregando talhões…</p>
              ) : talhoes.length === 0 ? (
                <p className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                  Nenhum talhão. {editor && 'Importe um arquivo pra começar.'}
                </p>
              ) : (
                <ul className="ml-2 border-l border-slate-200 pl-1 dark:border-white/10">
                  {talhoes.map((talhao) => {
                    const ativo = selecionado?.tipo === 'talhao' && selecionado.id === talhao.id
                    return (
                      <li key={talhao.id}>
                        <button
                          onClick={() => selecionarNoMapa({ tipo: 'talhao', id: talhao.id })}
                          className={`${ITEM} ${ativo ? ATIVO : INATIVO}`}
                        >
                          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: talhao.cor }} />
                          <span className="truncate">
                            {talhao.codigo}
                            {talhao.nome && <span className="text-slate-400 dark:text-slate-500"> · {talhao.nome}</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {editor && (
                // Talhão só nasce de arquivo importado agora — "Importar" é a
                // ação principal aqui, não mais um item ao lado de "+ Talhão".
                <div className="mt-1 flex flex-wrap gap-x-1">
                  <button
                    onClick={() => pedirAcao('importar-arquivo')}
                    className={`${ITEM} w-auto text-xs font-medium text-solo-700 hover:bg-solo-50 dark:text-solo-400 dark:hover:bg-solo-500/10`}
                  >
                    Importar
                  </button>
                  {talhoes.length >= 2 && (
                    <button
                      onClick={() => pedirAcao('mesclar-talhoes')}
                      className={`${ITEM} w-auto text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5`}
                    >
                      Mesclar talhões
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <ItemNav to="/filtros" Icone={IconeFiltro} rotulo="Filtros" onClick={aoNavegar} />
          <ItemNav to="/comparar" Icone={IconeComparar} rotulo="Comparar anos" onClick={aoNavegar} />

          <div className="my-1 border-t border-slate-200 dark:border-white/10" />

          <ItemNav to="/dados" Icone={IconeDados} rotulo="Dados" onClick={aoNavegar} />
          {/* As duas formas de lançar análise, aninhadas embaixo de "Dados" —
              não de "Critérios", onde estavam por engano. */}
          <ul className="ml-6 space-y-0.5 border-l border-slate-200 pl-1 dark:border-white/10">
            <li>
              <button onClick={() => irPara('/dados')} className={`${ITEM} text-xs ${INATIVO}`}>
                Entrada manual
              </button>
            </li>
            <li>
              <button onClick={() => irPara('/dados?aba=pdf')} className={`${ITEM} text-xs ${INATIVO}`}>
                Importar laudo PDF
              </button>
            </li>
          </ul>

          <ItemNav to="/monitoramento" Icone={IconeMonitoramento} rotulo="Monitoramento" onClick={aoNavegar} />

          {/* Onde se define o que e bom ou ruim. Sem guard de papel: quem nao
              e autor entra em leitura, e precisa — a cor do mapa dele sai
              daqui. */}
          <ItemNav to="/criterios" Icone={IconeCriterios} rotulo="Critérios" onClick={aoNavegar} />
        </div>
      </div>
    </nav>
  )
}
