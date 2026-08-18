import { CINZA_NEUTRO } from '../config/mapa.js'
import { parametro, faixaDe, rotuloDaFaixa, formatarValor, temMedicao } from './parametros.js'
import { calcularDiferenca } from './comparacao.js'
import { indexarAnalises } from './coloracao.js'
import { LADO, VARIACAO } from './estadosVariacao.js'
import { escalaDivergente, corDaVariacao } from './escalaDivergente.js'

/**
 * Variação de um parâmetro entre dois anos-safra: o cálculo.
 *
 * Puro e sem React, pelo mesmo motivo da coloração da Fase 4: é aqui que ficam
 * as regras que não podem errar, e verificá-las exige rodá-las fora do
 * navegador. O teste é `testes/variacao.mjs`.
 *
 * **Nada aqui interpola, estima ou completa valor.** Uma gleba medida só num
 * dos anos não tem variação — não tem variação zero, não tem variação pequena,
 * não tem variação nenhuma. Toda a estrutura abaixo existe para que esse caso
 * atravesse a tela inteira sem virar número.
 *
 * O que **não** mora aqui, e por quê:
 *   - a rampa de cor, em `escalaDivergente.js` — trocar o vermelho não deveria
 *     abrir o arquivo que decide o que é queda;
 *   - os textos com sinal, em `textosVariacao.js` — apresentação, e com dois
 *     consumidores de camadas diferentes (tooltip em HTML, tabela em JSX);
 *   - a ordenação, em `ordenarVariacao.js` — depende de qual coluna foi
 *     clicada, que é decisão de interface.
 */

// Os estados moram em `estadosVariacao.js` para não fechar ciclo com a escala
// de cor, mas seguem saindo daqui: quem pensa em variação abre este arquivo.
export { LADO, VARIACAO }

/** Fração da amplitude das faixas usada quando o config não traz `delta_minimo`. */
export const FRACAO_PADRAO = 0.05

// ---- limiar de significância ---------------------------------------------

/**
 * Distância entre o menor e o maior limite finito das faixas.
 *
 * É a régua da escala de interpretação: no K, cujos limites vão de 15 a 120,
 * a amplitude é 105. O `ate: null` da última faixa fica de fora porque não é
 * um número — "daí para cima" não tem topo.
 *
 * `null` quando o parâmetro não tem faixas, ou tem menos de dois limites
 * finitos, que é o mesmo que não ter régua.
 */
export function amplitudeDasFaixas(chave) {
  const p = parametro(chave)
  if (!p?.faixas) return null
  const limites = p.faixas.map((f) => f.ate).filter((v) => Number.isFinite(v))
  if (limites.length < 2) return null
  return Math.max(...limites) - Math.min(...limites)
}

/**
 * O quanto o valor precisa mudar para a variação contar como significativa.
 *
 * Ordem: `delta_minimo` do config, se declarado; senão 5% da amplitude das
 * faixas; senão **zero**.
 *
 * Zero para parâmetro sem faixas é escolha, não descuido. Sem escala de
 * interpretação validada não há como afirmar o que é ruído de laboratório —
 * e inventar uma zona de estabilidade esconderia diferença real. Com limiar
 * zero, toda diferença aparece como diferença, que é o fato bruto.
 *
 * `delta_minimo` negativo ou não numérico é ignorado: aceitar produziria uma
 * faixa de estabilidade impossível de ler.
 */
export function limiarDe(chave) {
  const declarado = parametro(chave)?.delta_minimo
  if (Number.isFinite(declarado) && declarado >= 0) return declarado
  const amplitude = amplitudeDasFaixas(chave)
  return amplitude === null ? 0 : amplitude * FRACAO_PADRAO
}

/**
 * De onde saiu o limiar deste parâmetro.
 *
 * A legenda mostra isso porque o número sozinho não se explica: "estável até
 * 0,18" é uma afirmação forte sobre o solo de alguém, e quem lê tem direito de
 * saber se ela veio de um valor validado no config ou de uma regra genérica
 * que ninguém conferiu.
 */
export function origemDoLimiar(chave) {
  const declarado = parametro(chave)?.delta_minimo
  if (Number.isFinite(declarado) && declarado >= 0) return 'config'
  return amplitudeDasFaixas(chave) === null ? 'sem_faixas' : 'faixas'
}

// ---- leitura de um lado ---------------------------------------------------

function lerLado(analise, chave) {
  if (!analise) return { estado: LADO.SEM_ANALISE, valor: null, formatado: null }

  const bruto = analise[chave]
  if (!temMedicao(bruto)) return { estado: LADO.SEM_MEDICAO, valor: null, formatado: null }

  const numero = Number(bruto)
  if (!Number.isFinite(numero)) return { estado: LADO.SEM_MEDICAO, valor: null, formatado: null }

  return { estado: LADO.MEDIDO, valor: numero, formatado: formatarValor(chave, numero) }
}

// ---- comparação de uma gleba ---------------------------------------------

/**
 * Compara os dois lados de uma gleba e devolve a linha da tabela.
 *
 * `delta` é sempre B − A, com sinal. `percentual` é (B − A) / |A|, e vem
 * `null` quando A é zero — dividir por zero daria infinito, e "subiu ∞%" não
 * informa nada. `tipoDiferenca` diz qual dos dois casos ocorreu.
 */
export function compararGleba(gleba, analiseA, analiseB, chave) {
  const a = lerLado(analiseA, chave)
  const b = lerLado(analiseB, chave)
  const limiar = limiarDe(chave)

  // A classificação exibida é a do Ano B: é o estado atual do solo. A do Ano A
  // já foi mostrada no mapa da Fase 4, quando aquele ano era o atual.
  const faixaB = b.estado === LADO.MEDIDO ? faixaDe(chave, b.valor) : null

  const base = {
    glebaId: gleba.id,
    gleba,
    a,
    b,
    limiar,
    nivelB: faixaB?.nivel ?? null,
    rotuloNivelB: rotuloDaFaixa(faixaB),
    delta: null,
    percentual: null,
    tipoDiferenca: null,
  }

  const temA = a.estado === LADO.MEDIDO
  const temB = b.estado === LADO.MEDIDO

  if (!temA && !temB) return { ...base, estado: VARIACAO.SEM_OS_DOIS }
  if (!temA || !temB) return { ...base, estado: VARIACAO.SEM_UM_ANO }

  const diferenca = calcularDiferenca(b.valor, a.valor)
  const delta = diferenca.delta

  // `<=` e não `<`: variação exatamente igual ao limiar ainda não o
  // ultrapassou. Com limiar zero, delta zero cai aqui — como deve.
  const estado =
    Math.abs(delta) <= limiar ? VARIACAO.ESTAVEL : delta > 0 ? VARIACAO.ALTA : VARIACAO.QUEDA

  return {
    ...base,
    estado,
    delta,
    percentual: diferenca.percentual,
    tipoDiferenca: diferenca.tipo,
  }
}

// ---- montagem da comparação ----------------------------------------------

/** Os dois anos foram escolhidos e são o mesmo? É o único erro de filtro possível. */
export function anosRepetidos({ anoA, anoB }) {
  return Boolean(anoA && anoB && anoA === anoB)
}

/** O filtro dá para comparar? Quatro campos preenchidos e os anos diferentes. */
export function filtroComparacaoCompleto({ anoA, anoB, profundidade, chaveParametro }) {
  return Boolean(anoA && anoB && profundidade && chaveParametro && anoA !== anoB)
}

/**
 * Uma linha por gleba da fazenda, mais a escala.
 *
 * Toda gleba entra, inclusive a que não tem análise em ano nenhum. Sumir com
 * ela deixaria o mapa mostrando menos terra do que existe, e o produtor sem
 * saber que aquele pedaço nunca foi amostrado.
 *
 * Devolve `null` com filtro incompleto — o sinal para a tela não afirmar nada.
 */
export function compararAnos(analises, glebas, filtro) {
  if (!filtroComparacaoCompleto(filtro)) return null

  const indiceA = indexarAnalises(analises, {
    anoSafra: filtro.anoA,
    profundidade: filtro.profundidade,
  })
  const indiceB = indexarAnalises(analises, {
    anoSafra: filtro.anoB,
    profundidade: filtro.profundidade,
  })

  const cruas = glebas.map((gleba) =>
    compararGleba(
      gleba,
      indiceA.get(gleba.id) ?? null,
      indiceB.get(gleba.id) ?? null,
      filtro.chaveParametro,
    ),
  )

  const { max } = escalaDivergente(cruas)

  return {
    anoA: filtro.anoA,
    anoB: filtro.anoB,
    profundidade: filtro.profundidade,
    chaveParametro: filtro.chaveParametro,
    limiar: limiarDe(filtro.chaveParametro),
    max,
    linhas: cruas.map((linha) => ({ ...linha, cor: corDaVariacao(linha, max) })),
  }
}

/**
 * Devolve `(glebaId) => info` para `useGeometrias`, ou `null` sem comparação.
 *
 * Mesmo contrato da coloração da Fase 4 — `cor` e `hachurado` — para o mapa
 * não precisar saber se está pintando classificação ou variação.
 */
export function criarColoracaoVariacao(comparacao) {
  if (!comparacao) return null
  const porGleba = new Map(comparacao.linhas.map((linha) => [linha.glebaId, linha]))

  return (glebaId) => {
    const linha = porGleba.get(glebaId)
    // Gleba fora da comparação não deveria acontecer — as linhas nascem da
    // mesma lista que o mapa desenha —, mas cinza neutro é o fallback honesto.
    if (!linha) return { cor: CINZA_NEUTRO, hachurado: false, linha: null }
    return { cor: linha.cor, hachurado: linha.estado === VARIACAO.SEM_UM_ANO, linha }
  }
}

// ---- contagem para o resumo da tela --------------------------------------

/** Quantas glebas em cada estado. A tela mostra para dar tamanho ao que falta. */
export function contarEstados(linhas) {
  const contagem = { queda: 0, estavel: 0, alta: 0, sem_um_ano: 0, sem_os_dois: 0 }
  for (const linha of linhas) contagem[linha.estado] += 1
  return contagem
}
