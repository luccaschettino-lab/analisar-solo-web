import { NIVEIS, SEM_MEDICAO } from '../config/parametros.js'
import { CINZA_NEUTRO, CINZA_HACHURA } from '../config/mapa.js'
import { parametro, faixaDe, rotuloDaFaixa, formatarValor, temMedicao } from './parametros.js'
import { faixasEfetivas } from './criterios.js'

/**
 * Coloração das glebas no mapa a partir de um filtro
 * (ano-safra, profundidade, parâmetro).
 *
 * Puro e sem React de propósito: é aqui que moram as regras que não podem
 * errar, e testá-las exige poder rodá-las fora do navegador.
 *
 * Quatro estados, não três. A especificação previa "com cor", "sem faixa" e
 * "sem dado", mas "sem dado" se parte em dois casos que o produtor distingue:
 * a gleba não foi amostrada naquele filtro, ou foi amostrada e o laboratório
 * não mediu aquele parâmetro. Os dois ficam hachurados; o tooltip diz qual é.
 */
export const ESTADO = {
  COM_COR: 'com_cor', // valor medido e parâmetro com faixa → cor da faixa
  SEM_FAIXA: 'sem_faixa', // valor medido, parâmetro sem classificação → cinza neutro
  SEM_MEDICAO: 'sem_medicao', // análise existe, parâmetro nulo → hachura
  SEM_ANALISE: 'sem_analise', // nenhuma análise no filtro → hachura
}

// Reexportadas de config/mapa.js, onde as cores das geometrias vivem.
// Quem consome o estado de uma gleba pega a cor daqui sem precisar saber
// de onde ela vem.
export { CINZA_NEUTRO, CINZA_HACHURA }

/** O filtro está completo o bastante para colorir? */
export function filtroCompleto({ anoSafra, profundidade, chaveParametro }) {
  return Boolean(anoSafra && profundidade && chaveParametro)
}

/**
 * Índice gleba → análise, para um ano-safra e profundidade.
 *
 * A chave natural garante no máximo uma análise por combinação, então um Map
 * simples basta. Se houvesse duas, o banco teria recusado.
 */
export function indexarAnalises(analises, { anoSafra, profundidade }) {
  const porGleba = new Map()
  for (const a of analises) {
    if (a.ano_safra !== anoSafra) continue
    if (a.profundidade !== profundidade) continue
    porGleba.set(a.gleba_id, a)
  }
  return porGleba
}

/**
 * Resolve o estado de uma gleba: cor, valor formatado e classificação.
 *
 * Nunca devolve zero no lugar de ausência, e nunca aproxima para a faixa mais
 * próxima — ausência sai como ausência.
 *
 * `faixas` omitido usa as do config. Quem passa vem de `criarColoracao`, que
 * já resolveu o conjunto de critérios da fazenda uma vez só.
 */
export function resolverGleba(analise, chaveParametro, faixas) {
  const p = parametro(chaveParametro)

  if (!analise) {
    return {
      estado: ESTADO.SEM_ANALISE,
      cor: CINZA_HACHURA,
      hachurado: true,
      valor: null,
      valorFormatado: 'Sem dado',
      nivel: null,
      rotuloNivel: null,
    }
  }

  const bruto = analise[chaveParametro]

  if (!temMedicao(bruto)) {
    return {
      estado: ESTADO.SEM_MEDICAO,
      cor: CINZA_HACHURA,
      hachurado: true,
      valor: null,
      valorFormatado: SEM_MEDICAO,
      nivel: null,
      rotuloNivel: null,
    }
  }

  const valorFormatado = `${formatarValor(chaveParametro, bruto)}${p?.unidade ? ` ${p.unidade}` : ''}`
  const faixa = faixaDe(chaveParametro, bruto, faixas)

  // Parâmetro sem faixa aplicável não recebe cor. É deliberado: pintar sem
  // classificação válida afirmaria "bom" ou "ruim" sem base — ver a limitação
  // do fósforo em docs/decisoes.md. Vale tanto para o config quanto para um
  // conjunto de critérios que declare `faixas: null` neste parâmetro.
  if (!faixa) {
    return {
      estado: ESTADO.SEM_FAIXA,
      cor: CINZA_NEUTRO,
      hachurado: false,
      valor: Number(bruto),
      valorFormatado,
      nivel: null,
      rotuloNivel: null,
    }
  }

  return {
    estado: ESTADO.COM_COR,
    // Cor sempre do nível; o rótulo pode ser específico da faixa.
    cor: NIVEIS[faixa.nivel].cor,
    hachurado: false,
    valor: Number(bruto),
    valorFormatado,
    nivel: faixa.nivel,
    rotuloNivel: rotuloDaFaixa(faixa),
  }
}

/**
 * Devolve uma função `(glebaId) => estado` ou `null` quando o filtro está
 * incompleto. `null` é o sinal para o mapa manter tudo em cinza neutro.
 */
export function criarColoracao(analises, filtro, criterio = null) {
  if (!filtroCompleto(filtro)) return null

  // As faixas sao resolvidas UMA vez, e nao a cada gleba: numa fazenda com
  // centenas de glebas, repetir a mescla por linha seria trabalho igual para
  // resposta identica.
  const faixas = faixasEfetivas(filtro.chaveParametro, criterio)
  const porGleba = indexarAnalises(analises, filtro)
  return (glebaId) => resolverGleba(porGleba.get(glebaId) ?? null, filtro.chaveParametro, faixas)
}

/** O parâmetro tem faixas em vigor? Decide se a legenda aparece. */
export function temFaixas(chaveParametro, criterio = null) {
  return Boolean(faixasEfetivas(chaveParametro, criterio))
}

/**
 * As faixas do config viradas em linhas de legenda.
 *
 * O config guarda só o limite superior de cada faixa (`ate`), porque é o que
 * a classificação precisa. A legenda precisa do intervalo legível, então o
 * limite inferior vem do `ate` da faixa anterior.
 *
 * Devolve `[]` para parâmetro sem faixas — a legenda some nesse caso.
 */
export function faixasParaLegenda(chaveParametro, criterio = null) {
  const faixas = faixasEfetivas(chaveParametro, criterio)
  if (!faixas) return []

  let anterior = null
  return faixas.map((faixa) => {
    const de = anterior
    anterior = faixa.ate

    let texto
    if (faixa.ate === null) texto = `acima de ${formatarValor(chaveParametro, de)}`
    else if (de === null) texto = `até ${formatarValor(chaveParametro, faixa.ate)}`
    else texto = `${formatarValor(chaveParametro, de)} – ${formatarValor(chaveParametro, faixa.ate)}`

    return {
      nivel: faixa.nivel,
      rotulo: rotuloDaFaixa(faixa),
      cor: NIVEIS[faixa.nivel].cor,
      texto,
    }
  })
}

// ---- opções dos seletores, a partir do que existe no banco ----------------

/** Anos-safra presentes, do mais recente para o mais antigo. */
export function anosDisponiveis(analises) {
  return [...new Set(analises.map((a) => a.ano_safra))].sort((a, b) => b.localeCompare(a))
}

/** Profundidades presentes, da mais rasa para a mais funda. */
export function profundidadesDisponiveis(analises) {
  return [...new Set(analises.map((a) => a.profundidade))].sort((a, b) =>
    String(a).localeCompare(String(b), 'pt-BR', { numeric: true }),
  )
}
