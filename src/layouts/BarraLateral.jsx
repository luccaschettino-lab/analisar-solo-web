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

/**
 * Ícone sozinho, sem rótulo ao lado — todas as abas da barra viraram isso a
 * pedido, empilhadas na vertical em vez de uma linha de texto por aba. O
 * nome não some de verdade: `title` mostra no hover, e `aria-label` mantém a
 * tela legível para quem usa leitor de tela.
 */
function IconeNav({ to, icone, rotulo, onClick }) {
  return (
    <NavLink
      to={to}
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      className={({ isActive }) =>
        `flex h-9 w-full items-center justify-center rounded text-base transition ${FOCO} ${isActive ? ATIVO : INATIVO}`
      }
    >
      <span aria-hidden="true">{icone}</span>
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
        {/* Todas as abas viram ícone sozinho, empilhadas na vertical — o
            nome continua acessível por `title` (hover) e `aria-label`
            (leitor de tela), só não ocupa mais uma linha de texto cada. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-stretch gap-1">
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
            <IconeNav to="/" icone="🗺" rotulo="Mapa" onClick={aoNavegar} />
          </div>

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

          <IconeNav to="/filtros" icone="🔽" rotulo="Filtros" onClick={aoNavegar} />
          <IconeNav to="/comparar" icone="📈" rotulo="Comparar anos" onClick={aoNavegar} />

          <div className="my-1 border-t border-slate-200 dark:border-white/10" />

          <IconeNav to="/dados" icone="📋" rotulo="Dados" onClick={aoNavegar} />
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

          <IconeNav to="/monitoramento" icone="🛰" rotulo="Monitoramento" onClick={aoNavegar} />

          {/* Onde se define o que e bom ou ruim. Sem guard de papel: quem nao
              e autor entra em leitura, e precisa — a cor do mapa dele sai
              daqui. */}
          <IconeNav to="/criterios" icone="🎚" rotulo="Critérios" onClick={aoNavegar} />
        </div>
      </div>
    </nav>
  )
}
