import { useMemo, useState } from 'react'
import { NIVEIS } from '../../config/parametros.js'
import { rotuloComUnidade, parametro } from '../../lib/parametros.js'
import { VARIACAO, LADO, contarEstados } from '../../lib/variacao.js'
import { COLUNAS, ordenarLinhas } from '../../lib/ordenarVariacao.js'
import { textoDelta, textoPercentual, textoDaAusencia } from '../../lib/textosVariacao.js'

const ORDEM_PADRAO = { coluna: COLUNAS.MODULO, direcao: 'desc' }

// Colunas que ordenam de baixo para cima na primeira vez que se clica nelas.
// Em número, quem clica quer ver o maior primeiro; em texto, quer o começo do
// alfabeto.
const COMECA_DESC = new Set([COLUNAS.VALOR_A, COLUNAS.VALOR_B, COLUNAS.DELTA, COLUNAS.PERCENTUAL, COLUNAS.CLASSIFICACAO])

function Cabecalho({ coluna, rotulo, sublinha, aDireita = false, ordenacao, aoOrdenar }) {
  const ativa = ordenacao.coluna === coluna
  const seta = ativa ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : ''

  return (
    <th
      scope="col"
      aria-sort={ativa ? (ordenacao.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
      // Classes escritas por extenso: o Tailwind varre o código como texto e
      // não geraria uma classe montada em tempo de execução.
      className={`sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 ${aDireita ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => aoOrdenar(coluna)}
        className={`flex w-full items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-solo-600 ${aDireita ? 'justify-end' : ''}`}
      >
        <span className="flex flex-col items-start">
          <span>{rotulo}</span>
          {sublinha && <span className="font-normal text-[11px] text-slate-500">{sublinha}</span>}
        </span>
        <span aria-hidden="true" className="text-[9px] text-slate-500">{seta}</span>
      </button>
    </th>
  )
}

/**
 * Célula de um valor que pode não existir.
 *
 * **Nunca zero, nunca traço.** "sem dado" escrito, e embaixo o motivo — não
 * amostrada ou não medida. O ano fica claro porque está no cabeçalho da
 * coluna, e o motivo diz de quem é a pendência.
 */
function CelulaValor({ lado, unidade }) {
  if (lado.formatado === null) {
    return (
      <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">
        <span className="text-slate-500">sem dado</span>
        <span className="block text-[11px] text-slate-400">{textoDaAusencia(lado.estado)}</span>
      </td>
    )
  }

  return (
    <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-slate-800">
      {lado.formatado}
      {unidade && <span className="text-slate-400"> {unidade}</span>}
    </td>
  )
}

/** Diferença e percentual só existem quando os dois anos existem. */
function CelulaSemComparacao() {
  return (
    <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs text-slate-400">sem comparação</td>
  )
}

function CelulaClassificacao({ linha }) {
  if (linha.rotuloNivelB) {
    return (
      <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-800">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: NIVEIS[linha.nivelB].cor }}
          />
          {linha.rotuloNivelB}
        </span>
      </td>
    )
  }

  // Duas ausências diferentes: o parâmetro não classifica, ou não há valor no
  // Ano B para classificar.
  const texto = linha.b.estado === LADO.MEDIDO ? 'sem classificação' : 'sem dado'
  return <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-400">{texto}</td>
}

/**
 * Tabela de variação, ao lado do mapa.
 *
 * Ordenável por qualquer coluna, começando pela maior variação em módulo —
 * a pergunta que a tela existe para responder é "quais glebas mais mudaram".
 * Como a coluna de diferença ordena pelo valor com sinal (para separar as
 * maiores quedas das maiores altas), a ordem padrão não é alcançável clicando
 * num cabeçalho, e por isso tem um botão próprio para voltar.
 *
 * Clicar numa linha seleciona a gleba no mapa. É a mesma ação da barra
 * lateral, e mantém tabela e mapa falando do mesmo pedaço de terra.
 */
export default function TabelaVariacao({ comparacao, selecionado, aoSelecionar }) {
  const [ordenacao, setOrdenacao] = useState(ORDEM_PADRAO)

  const { linhas, chaveParametro, anoA, anoB } = comparacao
  const unidade = parametro(chaveParametro)?.unidade ?? ''

  const ordenadas = useMemo(
    () => ordenarLinhas(linhas, ordenacao.coluna, ordenacao.direcao),
    [linhas, ordenacao],
  )
  const contagem = useMemo(() => contarEstados(linhas), [linhas])

  function aoOrdenar(coluna) {
    setOrdenacao((atual) =>
      atual.coluna === coluna
        ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna, direcao: COMECA_DESC.has(coluna) ? 'desc' : 'asc' },
    )
  }

  const naOrdemPadrao =
    ordenacao.coluna === ORDEM_PADRAO.coluna && ordenacao.direcao === ORDEM_PADRAO.direcao

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">{linhas.length} glebas</span>
          {contagem.sem_um_ano > 0 && (
            <span> · {contagem.sem_um_ano} sem dado em um dos anos</span>
          )}
          {contagem.sem_os_dois > 0 && <span> · {contagem.sem_os_dois} sem dado nos dois</span>}
        </p>

        <button
          type="button"
          onClick={() => setOrdenacao(ORDEM_PADRAO)}
          disabled={naOrdemPadrao}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          Maior variação
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Variação de {rotuloComUnidade(chaveParametro)} entre {anoA} e {anoB}
          </caption>
          <thead>
            <tr>
              <Cabecalho coluna={COLUNAS.GLEBA} rotulo="Gleba" ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
              <Cabecalho coluna={COLUNAS.VALOR_A} rotulo={anoA} sublinha="Ano A" aDireita ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
              <Cabecalho coluna={COLUNAS.VALOR_B} rotulo={anoB} sublinha="Ano B" aDireita ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
              <Cabecalho coluna={COLUNAS.DELTA} rotulo="Diferença" sublinha={`B − A${unidade ? ` (${unidade})` : ''}`} aDireita ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
              <Cabecalho coluna={COLUNAS.PERCENTUAL} rotulo="Variação" sublinha="%" aDireita ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
              <Cabecalho coluna={COLUNAS.CLASSIFICACAO} rotulo="Classificação" sublinha={`em ${anoB}`} ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
            </tr>
          </thead>

          <tbody>
            {ordenadas.map((linha) => {
              const ativa = selecionado?.tipo === 'gleba' && selecionado.id === linha.glebaId
              const comparavel = linha.delta !== null
              const percentual = textoPercentual(linha)

              return (
                <tr
                  key={linha.glebaId}
                  onClick={() => aoSelecionar({ tipo: 'gleba', id: linha.glebaId })}
                  className={`cursor-pointer border-b border-slate-100 ${ativa ? 'bg-amber-100' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-2 py-1.5 text-xs text-slate-800">
                    <span className="flex items-center gap-1.5">
                      {/* A mesma cor que a gleba tem no mapa: sem isso, ler a
                          tabela e ler o mapa seriam dois trabalhos separados. */}
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-300"
                        style={{ backgroundColor: linha.cor }}
                      />
                      <span className="font-medium">{linha.gleba.codigo}</span>
                      {linha.gleba.nome && (
                        <span className="truncate text-slate-500">· {linha.gleba.nome}</span>
                      )}
                    </span>
                  </td>

                  <CelulaValor lado={linha.a} unidade={unidade} />
                  <CelulaValor lado={linha.b} unidade={unidade} />

                  {comparavel ? (
                    <td
                      className={`whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums ${
                        linha.estado === VARIACAO.ESTAVEL ? 'text-slate-500' : 'font-medium text-slate-900'
                      }`}
                    >
                      {textoDelta(linha, chaveParametro)}
                    </td>
                  ) : (
                    <CelulaSemComparacao />
                  )}

                  {!comparavel ? (
                    <CelulaSemComparacao />
                  ) : percentual ? (
                    <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">
                      {percentual}
                    </td>
                  ) : (
                    // Ano A igual a zero: a porcentagem não existe. Dizer o
                    // motivo evita a leitura de que a conta falhou.
                    <td className="whitespace-nowrap px-2 py-1.5 text-right text-[11px] text-slate-400">
                      partiu de zero
                    </td>
                  )}

                  <CelulaClassificacao linha={linha} />
                </tr>
              )
            })}
          </tbody>
        </table>

        {linhas.length === 0 && (
          <p className="px-3 py-4 text-xs text-slate-500">
            Esta fazenda ainda não tem glebas cadastradas.
          </p>
        )}
      </div>
    </div>
  )
}
