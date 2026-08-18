import { NIVEIS, CHAVES_PARAMETROS } from '../config/parametros.js'
import { parametro } from './parametros.js'

/**
 * Critérios de interpretação: a mescla entre o conjunto do consultor e a
 * semente do config, e a validação do que o consultor digita.
 *
 * **O config deixou de ser a verdade sobre o que é bom ou ruim.** Ele continua
 * sendo a fonte única de rótulo, unidade, casas decimais, grupo e faixa
 * plausível — isso é fato, não juízo. As `faixas` e o `delta_minimo` agora
 * podem vir de um conjunto nomeado, criado por quem responde pela
 * interpretação; o config é o que vale enquanto ninguém assinou nada.
 *
 * Puro e sem React: é o mesmo motivo da Fase 4 e da Fase 5 — estas regras
 * decidem a cor do mapa e não podem depender do navegador para serem
 * verificadas. O teste é `testes/criterios.mjs`.
 */

/**
 * De onde saíram as faixas em vigor para um parâmetro.
 *
 * Três origens, e a diferença é visível na tela: a legenda assina o critério
 * quando ele existe, e mantém o aviso de "classificação preliminar" quando o
 * que está pintando o mapa ainda é a tabela genérica do config.
 */
export const ORIGEM = {
  CRITERIO: 'criterio', // o conjunto declarou faixas para este parâmetro
  CONFIG: 'config', // o conjunto não fala dele; vale a semente
  SEM_CLASSIFICACAO: 'sem_classificacao', // o conjunto declarou que não há faixa
}

/**
 * O que o conjunto diz sobre um parâmetro, ou `null` se não disser nada.
 *
 * `criterio` aqui é o objeto `parametros` da tabela `criterios` — o mesmo
 * formato que o banco guarda em jsonb. Aceita `null` para "nenhum conjunto
 * aplicado", que é o caso da fazenda sem `criterio_id`.
 */
function entradaDe(criterio, chave) {
  if (!criterio || typeof criterio !== 'object') return null
  const entrada = criterio[chave]
  if (!entrada || typeof entrada !== 'object') return null
  return entrada
}

/**
 * O conjunto declarou `faixas` para este parâmetro?
 *
 * Distingue "não falou" de "falou que não tem". `{ faixas: null }` é uma
 * afirmação — o consultor discorda da faixa genérica e não tem outra para pôr
 * no lugar —, e ela precisa sobreviver à mescla. Sem essa distinção, a única
 * saída seria deixar de pé uma faixa que ele considera errada.
 */
function declarouFaixas(entrada) {
  return Boolean(entrada) && Object.prototype.hasOwnProperty.call(entrada, 'faixas')
}

/** Origem das faixas em vigor para o parâmetro. */
export function origemDasFaixas(chave, criterio) {
  const entrada = entradaDe(criterio, chave)
  if (!declarouFaixas(entrada)) return ORIGEM.CONFIG
  return entrada.faixas === null ? ORIGEM.SEM_CLASSIFICACAO : ORIGEM.CRITERIO
}

/**
 * Faixas em vigor: as do conjunto, se declaradas; senão as do config.
 *
 * Devolve `null` tanto para "o config também não tem" quanto para "o conjunto
 * declarou que não há" — para quem classifica, os dois casos são o mesmo:
 * não há como dizer se o valor é bom ou ruim. Quem precisa da diferença
 * pergunta a `origemDasFaixas`.
 */
export function faixasEfetivas(chave, criterio) {
  const entrada = entradaDe(criterio, chave)
  if (declarouFaixas(entrada)) return entrada.faixas
  return parametro(chave)?.faixas ?? null
}

/**
 * `delta_minimo` em vigor, ou `undefined` quando ninguém declarou.
 *
 * `undefined` e não `null` de propósito: `limiarDe`, na Fase 5, já trata
 * "não declarado" caindo em 5% da amplitude das faixas. Devolver `null` faria
 * aquele `Number.isFinite` reprovar do mesmo jeito, mas `undefined` diz a
 * coisa certa — o campo não existe, não é que ele valha nada.
 */
export function deltaMinimoEfetivo(chave, criterio) {
  const entrada = entradaDe(criterio, chave)
  if (entrada && Object.prototype.hasOwnProperty.call(entrada, 'delta_minimo')) {
    return entrada.delta_minimo ?? undefined
  }
  return parametro(chave)?.delta_minimo
}

/**
 * O parâmetro com os fatos do config e o juízo em vigor, num objeto só.
 *
 * É o formato que `faixaDe` e companhia consomem: quem classifica não deveria
 * precisar saber se a faixa veio do banco ou do arquivo.
 */
export function parametroEfetivo(chave, criterio) {
  const base = parametro(chave)
  if (!base) return null
  return {
    ...base,
    faixas: faixasEfetivas(chave, criterio),
    delta_minimo: deltaMinimoEfetivo(chave, criterio),
    origem: origemDasFaixas(chave, criterio),
  }
}

/** Algum parâmetro do conjunto sobrescreve o config? Decide o texto da legenda. */
export function criterioTemAlgo(criterio) {
  if (!criterio || typeof criterio !== 'object') return false
  return CHAVES_PARAMETROS.some((chave) => declarouFaixas(entradaDe(criterio, chave)))
}

// ---- validação ------------------------------------------------------------

const NIVEIS_VALIDOS = new Set(Object.keys(NIVEIS))

/**
 * Valida as faixas de um parâmetro.
 *
 * Devolve `{ erros, avisos }`. **Erro impede salvar; aviso não.** A divisão
 * segue a mesma regra do resto do produto: o sistema barra o que produziria
 * uma classificação silenciosamente errada, e apenas avisa sobre o que é
 * escolha legítima de quem entende de solo.
 */
export function validarFaixas(chave, faixas) {
  const erros = []
  const avisos = []

  // Ausência declarada é válida: é o consultor dizendo que não classifica.
  if (faixas === null || faixas === undefined) return { erros, avisos }

  if (!Array.isArray(faixas)) {
    erros.push('As faixas precisam ser uma lista.')
    return { erros, avisos }
  }

  if (faixas.length === 0) {
    erros.push('Uma lista de faixas vazia não classifica nada. Use "sem classificação".')
    return { erros, avisos }
  }

  let anterior = null
  faixas.forEach((faixa, i) => {
    const posicao = `Faixa ${i + 1}`
    const ultima = i === faixas.length - 1

    if (!faixa || typeof faixa !== 'object') {
      erros.push(`${posicao}: formato inválido.`)
      return
    }

    if (!NIVEIS_VALIDOS.has(faixa.nivel)) {
      erros.push(`${posicao}: nível "${faixa.nivel}" não existe.`)
    }

    // O último limite tem que ser aberto, e só ele.
    //
    // `faixaDe` percorre as faixas e devolve a primeira em que o valor cabe.
    // Se a última tiver um teto, um valor acima dele não casa com faixa
    // nenhuma e a gleba sai sem classificação — sem erro, sem aviso, sem
    // ninguém perceber. É a falha mais perigosa desta tela, porque só aparece
    // no laudo que passar do teto.
    if (ultima && faixa.ate !== null && faixa.ate !== undefined) {
      erros.push('A última faixa precisa ser aberta ("daí para cima"), senão valores acima dela ficam sem classificação.')
    }
    if (!ultima && (faixa.ate === null || faixa.ate === undefined)) {
      erros.push(`${posicao}: só a última faixa pode ser aberta.`)
    }

    if (!ultima) {
      if (!Number.isFinite(faixa.ate)) {
        erros.push(`${posicao}: o limite precisa ser um número.`)
      } else if (anterior !== null && faixa.ate <= anterior) {
        erros.push(`${posicao}: o limite (${faixa.ate}) precisa ser maior que o da faixa anterior (${anterior}).`)
      } else {
        anterior = faixa.ate
      }
    }

    if (faixa.rotulo !== undefined && faixa.rotulo !== null && typeof faixa.rotulo !== 'string') {
      erros.push(`${posicao}: o rótulo precisa ser texto.`)
    }
  })

  // Rótulo repetido na legenda: foi o bug do pH na Fase 4, onde "Baixo"
  // aparecia duas vezes com a mesma cor significando ácido demais e alcalino
  // demais. Aviso e não erro porque a escala não-monotônica é legítima — o
  // que falta é dar nome próprio a cada ponta.
  const rotulos = faixas
    .map((f) => f?.rotulo ?? (NIVEIS_VALIDOS.has(f?.nivel) ? NIVEIS[f.nivel].rotulo : null))
    .filter(Boolean)
  if (new Set(rotulos).size !== rotulos.length) {
    avisos.push('Duas faixas mostram o mesmo texto na legenda. Dê um rótulo próprio a cada uma.')
  }

  // Limite fora do que um laudo plausível traria: provavelmente é engano de
  // digitação, não uma escala exótica.
  const p = parametro(chave)
  if (p?.plausivel) {
    const fora = faixas
      .map((f) => f?.ate)
      .filter((v) => Number.isFinite(v) && (v < p.plausivel.min || v > p.plausivel.max))
    if (fora.length > 0) {
      avisos.push(`Limite fora da faixa plausível do parâmetro (${p.plausivel.min} a ${p.plausivel.max}): ${fora.join(', ')}.`)
    }
  }

  // O config deixou este parâmetro sem faixa por um motivo escrito. Definir
  // uma agora é decisão legítima de quem assina, mas a razão registrada tem
  // que aparecer — é o caso do fósforo, que depende do P-Rem.
  if (p && p.faixas === null && p.nota) {
    avisos.push(`Este parâmetro não tem faixa padrão de propósito: ${p.nota}`)
  }

  return { erros, avisos }
}

/** `delta_minimo` válido é número não negativo, ou nada. */
export function validarDeltaMinimo(valor) {
  if (valor === null || valor === undefined) return { erros: [], avisos: [] }
  if (!Number.isFinite(valor) || valor < 0) {
    return { erros: ['O delta mínimo precisa ser um número não negativo.'], avisos: [] }
  }
  return { erros: [], avisos: [] }
}

/**
 * Valida o conjunto inteiro antes de gravar.
 *
 * Devolve `{ valido, porParametro }`, com erros e avisos por chave. Um
 * parâmetro ruim não invalida os outros na leitura do resultado — mas o
 * salvamento só passa com `valido`, porque gravar metade de um conjunto
 * deixaria o mapa pintando com uma escala que o autor não terminou.
 */
export function validarCriterio(parametros) {
  const porParametro = {}
  let valido = true

  if (!parametros || typeof parametros !== 'object') {
    return { valido: false, porParametro: {}, erroGeral: 'Conjunto de critérios inválido.' }
  }

  for (const chave of Object.keys(parametros)) {
    if (!CHAVES_PARAMETROS.includes(chave)) {
      porParametro[chave] = { erros: [`"${chave}" não é um parâmetro conhecido.`], avisos: [] }
      valido = false
      continue
    }

    const entrada = parametros[chave] ?? {}
    const faixas = declarouFaixas(entrada) ? entrada.faixas : undefined
    const resultado = validarFaixas(chave, faixas)
    const delta = validarDeltaMinimo(entrada.delta_minimo)

    const erros = [...resultado.erros, ...delta.erros]
    const avisos = [...resultado.avisos, ...delta.avisos]

    if (erros.length > 0) valido = false
    if (erros.length > 0 || avisos.length > 0) porParametro[chave] = { erros, avisos }
  }

  return { valido, porParametro }
}

/**
 * Ponto de partida para editar um parâmetro: as faixas do config, copiadas.
 *
 * Cópia profunda porque o editor mexe nos objetos, e mutar o config em memória
 * contaminaria todas as outras telas da sessão.
 */
export function faixasIniciais(chave) {
  const faixas = parametro(chave)?.faixas
  if (!faixas) return null
  return faixas.map((f) => ({ ...f }))
}
