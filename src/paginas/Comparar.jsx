import { useCallback, useEffect, useMemo, useState } from 'react'
import Mapa from '../mapa/Mapa.jsx'
import { useGeometrias } from '../mapa/useGeometrias.js'
import { useEnquadramentoDaFazenda } from '../mapa/useEnquadramentoDaFazenda.js'
import { focarGeometria } from '../mapa/enquadrar.js'
import { criarTooltipVariacao } from '../mapa/tooltipVariacao.js'
import { useFazendaAtual } from '../context/FazendaContext.jsx'
import { compararAnos, criarColoracaoVariacao } from '../lib/variacao.js'
import { useFiltroComparacao } from './comparacao/useFiltroComparacao.js'
import FiltrosComparacao from './comparacao/FiltrosComparacao.jsx'
import LegendaDivergente from './comparacao/LegendaDivergente.jsx'
import TabelaVariacao from './comparacao/TabelaVariacao.jsx'

/**
 * Comparação entre dois anos-safra: mapa divergente e tabela de variação.
 *
 * O mapa é o mesmo da Fase 4 — mesmas geometrias, mesma hachura, mesma
 * seleção —, trocando só o que decide a cor e o que o tooltip diz. Foi por
 * isso que `useGeometrias` ganhou um `conteudoTooltip` opcional em vez de uma
 * cópia do desenho das camadas: duas cópias divergiriam na primeira correção.
 *
 * A tela não escreve nada no banco. Tudo aqui é recorte das análises que já
 * estão em memória por causa do `FazendaContext`.
 */
export default function Comparar() {
  const {
    fazendas, carregandoFazendas, erroFazendas, idSelecionada, fazendaSelecionada, selecionarFazenda,
    talhoes, glebas, carregando: carregandoHierarquia, erro: erroHierarquia,
    analisesDaFazenda, carregandoAnalises, erroAnalises, anos,
    selecionado, setSelecionado,
  } = useFazendaAtual()

  const [mapa, setMapa] = useState(null)
  const { filtro, mudar, inverter, erro: erroAnos, completo } = useFiltroComparacao(anos)

  const comparacao = useMemo(
    () => compararAnos(analisesDaFazenda, glebas, filtro),
    [analisesDaFazenda, glebas, filtro],
  )
  const coloracao = useMemo(() => criarColoracaoVariacao(comparacao), [comparacao])
  const conteudoTooltip = useMemo(() => criarTooltipVariacao(comparacao), [comparacao])

  const aoSelecionar = useCallback((alvo) => setSelecionado(alvo), [setSelecionado])
  const aoCriarMapa = useCallback((instancia) => setMapa(instancia), [])

  useGeometrias(mapa, { talhoes, glebas, selecionado, aoSelecionar, coloracao, conteudoTooltip })

  // Só o enquadramento de abertura: esta tela lê, não escreve. O modo de
  // marcar centro fica em `useMapaDaFazenda`, com a tela que tem o botão.
  useEnquadramentoDaFazenda({ mapa, fazendaSelecionada, talhoes, carregandoHierarquia })

  // Clicar numa linha da tabela leva o mapa até a gleba. Sem isso, a seleção
  // acenderia uma geometria fora da tela.
  useEffect(() => {
    if (!mapa || selecionado?.tipo !== 'gleba') return
    const gleba = glebas.find((g) => g.id === selecionado.id)
    if (gleba?.geometria) focarGeometria(mapa, gleba.geometria)
  }, [mapa, selecionado, glebas])

  const semFazenda = !carregandoFazendas && !fazendaSelecionada
  const semAnalises = Boolean(fazendaSelecionada) && !carregandoAnalises && anos.length === 0

  /**
   * Falha de carga vem antes de qualquer mensagem de "não tem".
   *
   * Não saber dizer a diferença entre "falhou" e "está vazio" é o pior que
   * esta tela pode fazer: as duas leem igual, e só uma é problema do usuário.
   * O texto do erro sai na faixa de alerta dos filtros; aqui só se aponta
   * para lá, para o mesmo erro não aparecer em vermelho duas vezes.
   */
  const erroDeCarga = Boolean(erroFazendas || erroHierarquia || erroAnalises)
  const prontoParaComparar = completo && !carregandoHierarquia && !erroDeCarga

  function mensagemDeEspera() {
    if (erroDeCarga) return 'Não foi possível carregar os dados desta fazenda. Veja o aviso acima.'
    if (semFazenda) return 'Selecione uma fazenda para comparar.'
    if (carregandoHierarquia) return 'Carregando talhões e glebas…'
    if (carregandoAnalises) return 'Carregando análises…'
    if (semAnalises) return 'Esta fazenda ainda não tem análises lançadas.'
    if (anos.length === 1) {
      return `Há laudos de um ano-safra só (${anos[0]}). Comparar exige dois.`
    }
    if (erroAnos) return erroAnos
    return 'Escolha os dois anos-safra, a profundidade e o parâmetro.'
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FiltrosComparacao
        fazendas={fazendas}
        idFazenda={idSelecionada}
        aoSelecionarFazenda={selecionarFazenda}
        carregandoFazendas={carregandoFazendas}
        filtro={filtro}
        aoMudar={mudar}
        aoInverter={inverter}
        anos={anos}
        carregandoAnalises={carregandoAnalises}
        erroFazendas={erroFazendas}
        erroHierarquia={erroHierarquia}
        erroAnalises={erroAnalises}
        erroAnos={erroAnos}
      />

      {/* Mapa em cima e tabela embaixo no celular; lado a lado a partir de lg,
          que é onde as seis colunas cabem sem espremer. */}
      <div className="grid min-h-0 flex-1 grid-rows-[45%_55%] lg:grid-cols-2 lg:grid-rows-1">
        <div className="relative min-h-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
          <Mapa aoCriarMapa={aoCriarMapa} />

          {comparacao && <LegendaDivergente comparacao={comparacao} />}

          {!prontoParaComparar && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[1100] flex justify-center px-3">
              <p className="pointer-events-auto rounded-md border border-slate-200 bg-white/95 px-3 py-1.5 text-center text-xs text-slate-600 shadow backdrop-blur">
                {mensagemDeEspera()}
              </p>
            </div>
          )}

        </div>

        <div className="min-h-0 overflow-hidden bg-white">
          {/* A tabela só entra com a hierarquia carregada: com `glebas` vazio
              por carregamento ou por falha, ela afirmaria que a fazenda não
              tem gleba nenhuma. */}
          {prontoParaComparar && comparacao ? (
            <TabelaVariacao
              comparacao={comparacao}
              selecionado={selecionado}
              aoSelecionar={aoSelecionar}
            />
          ) : (
            <p className="px-3 py-4 text-xs text-slate-500">{mensagemDeEspera()}</p>
          )}
        </div>
      </div>
    </div>
  )
}
