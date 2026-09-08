import { NIVEIS, SEM_MEDICAO } from '../config/parametros.js'
import { CINZA_NEUTRO, CINZA_HACHURA } from '../config/mapa.js'
import { parametro, faixaDe, rotuloDaFaixa, formatarValor, temMedicao } from './parametros.js'
import { faixasEfetivas } from './criterios.js'
import { latLngDoPonto } from './geo.js'

/**
 * Coloração dos talhões no mapa a partir de um filtro
 * (ano-safra, profundidade, parâmetro).
 *
 * Puro e sem React de propósito: é aqui que moram as regras que não podem
 * errar, e testá-las exige poder rodá-las fora do navegador.
 *
 * Um talhão pode ter várias amostras na mesma safra/profundidade — uma por
 * ponto de coleta, desde que gleba saiu de cena. Por isso a unidade que se
 * resolve aqui tem duas camadas: `resolverAmostra` classifica uma linha
 * (um ponto), e `resolverTalhao` agrega todos os pontos de um talhão num
 * resumo — média classificada, mais a lista de pontos crus para o mapa de
 * calor desenhar.
 *
 * Quatro estados, não três. A especificação previa "com cor", "sem faixa" e
 * "sem dado", mas "sem dado" se parte em dois casos que o produtor distingue:
 * o talhão não foi amostrado naquele filtro, ou foi amostrado e o
 * laboratório não mediu aquele parâmetro. Os dois ficam hachurados; o
 * tooltip diz qual é.
 */
export const ESTADO = {
  COM_COR: 'com_cor', // valor medido e parâmetro com faixa → cor da faixa
  SEM_FAIXA: 'sem_faixa', // valor medido, parâmetro sem classificação → cinza neutro
  SEM_MEDICAO: 'sem_medicao', // análise existe, parâmetro nulo → hachura
  SEM_ANALISE: 'sem_analise', // nenhuma análise no filtro → hachura
}

// Reexportadas de config/mapa.js, onde as cores das geometrias vivem.
// Quem consome o estado de um talhão pega a cor daqui sem precisar saber
// de onde ela vem.
export { CINZA_NEUTRO, CINZA_HACHURA }

// Ordem fixa dos cinco níveis — a mesma ordem de `NIVEIS` no config, do pior
// pro melhor. O mapa de calor precisa de uma posição numérica (0 a 1) por
// nível pra interpolar cor entre pontos; isto é o que traduz "bom" em "0.75"
// sem duplicar a lista em outro lugar.
const ORDEM_NIVEIS = Object.keys(NIVEIS)

/** Posição do nível na escala, de 0 (muito baixo) a 1 (muito bom), ou `null`. */
export function posicaoDoNivel(nivel) {
  const i = ORDEM_NIVEIS.indexOf(nivel)
  return i === -1 ? null : i / (ORDEM_NIVEIS.length - 1)
}

/** As cores de `NIVEIS`, na mesma ordem, como paradas de gradiente 0..1 —
 * o formato que `camadaCalor.js` interpola para colorir o mapa de calor. */
export function gradienteDeNiveis() {
  const gradiente = {}
  ORDEM_NIVEIS.forEach((nivel, i) => {
    gradiente[i / (ORDEM_NIVEIS.length - 1)] = NIVEIS[nivel].cor
  })
  return gradiente
}

/** O filtro está completo o bastante para colorir? */
export function filtroCompleto({ anoSafra, profundidade, chaveParametro }) {
  return Boolean(anoSafra && profundidade && chaveParametro)
}

/**
 * Índice talhão → análises, para um ano-safra e profundidade.
 *
 * Um array, não um valor só: um talhão tem quantos pontos de coleta tiver,
 * de propósito — a unicidade que existia por gleba não existe mais aqui.
 */
export function indexarAnalises(analises, { anoSafra, profundidade }) {
  const porTalhao = new Map()
  for (const a of analises) {
    if (a.ano_safra !== anoSafra) continue
    if (a.profundidade !== profundidade) continue
    if (!porTalhao.has(a.talhao_id)) porTalhao.set(a.talhao_id, [])
    porTalhao.get(a.talhao_id).push(a)
  }
  return porTalhao
}

/**
 * Resolve o estado de uma amostra (uma linha de `analises`): cor, valor
 * formatado e classificação.
 *
 * Nunca devolve zero no lugar de ausência, e nunca aproxima para a faixa mais
 * próxima — ausência sai como ausência.
 *
 * `faixas` omitido usa as do config. Quem passa vem de `criarColoracao`, que
 * já resolveu o conjunto de critérios da fazenda uma vez só.
 */
export function resolverAmostra(analise, chaveParametro, faixas) {
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
 * Resolve o estado de um talhão inteiro, a partir de todas as suas amostras
 * no filtro: um ponto resolvido por amostra (o mapa de calor desenha em cima
 * disso) mais um resumo agregado — média dos pontos medidos, já classificada
 * — para quem só precisa de uma cor e um valor só (tooltip, legenda,
 * comparação entre safras).
 */
export function resolverTalhao(analisesDoTalhao, chaveParametro, faixas) {
  if (!analisesDoTalhao || analisesDoTalhao.length === 0) {
    return {
      estado: ESTADO.SEM_ANALISE,
      cor: CINZA_HACHURA,
      hachurado: true,
      pontos: [],
      media: null,
      valorFormatado: 'Sem dado',
      nivel: null,
      rotuloNivel: null,
    }
  }

  const pontos = analisesDoTalhao.map((analise) => {
    const [lat, lng] = latLngDoPonto(analise.geometria) ?? [null, null]
    return { ...resolverAmostra(analise, chaveParametro, faixas), id: analise.id, lat, lng }
  })

  const medidos = pontos.filter((p) => p.valor != null)

  if (medidos.length === 0) {
    // Existem amostras, mas nenhuma mediu este parâmetro — hachura, mas por
    // um motivo diferente de "não amostrou o talhão".
    return {
      estado: ESTADO.SEM_MEDICAO,
      cor: CINZA_HACHURA,
      hachurado: true,
      pontos,
      media: null,
      valorFormatado: SEM_MEDICAO,
      nivel: null,
      rotuloNivel: null,
    }
  }

  const media = medidos.reduce((soma, p) => soma + p.valor, 0) / medidos.length
  const faixaMedia = faixaDe(chaveParametro, media, faixas)
  const p = parametro(chaveParametro)
  const valorFormatado = `${formatarValor(chaveParametro, media)}${p?.unidade ? ` ${p.unidade}` : ''}`

  if (!faixaMedia) {
    return {
      estado: ESTADO.SEM_FAIXA,
      cor: CINZA_NEUTRO,
      hachurado: false,
      pontos,
      media,
      valorFormatado,
      nivel: null,
      rotuloNivel: null,
    }
  }

  return {
    estado: ESTADO.COM_COR,
    cor: NIVEIS[faixaMedia.nivel].cor,
    hachurado: false,
    pontos,
    media,
    valorFormatado,
    nivel: faixaMedia.nivel,
    rotuloNivel: rotuloDaFaixa(faixaMedia),
  }
}

/**
 * Devolve uma função `(talhaoId) => estado` ou `null` quando o filtro está
 * incompleto. `null` é o sinal para o mapa manter tudo em cinza neutro.
 */
export function criarColoracao(analises, filtro, criterio = null) {
  if (!filtroCompleto(filtro)) return null

  // As faixas sao resolvidas UMA vez, e nao a cada talhao: numa fazenda com
  // dezenas de talhoes, repetir a mescla por linha seria trabalho igual para
  // resposta identica.
  const faixas = faixasEfetivas(filtro.chaveParametro, criterio)
  const porTalhao = indexarAnalises(analises, filtro)
  return (talhaoId) => resolverTalhao(porTalhao.get(talhaoId), filtro.chaveParametro, faixas)
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
