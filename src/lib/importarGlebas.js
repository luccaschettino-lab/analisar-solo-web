import bbox from '@turf/bbox'
import { areaEmHectares, avaliarContencao, CONTENCAO, paraFeature } from './geo.js'

/**
 * Importação de glebas a partir de um arquivo geoespacial: do que o arquivo
 * traz (polígonos ou pontos) às linhas que a pessoa revisa antes de gravar.
 *
 * Diferente do talhão, a gleba tem DONO: vive dentro de um talhão. Então além
 * do código e do nome, cada linha precisa de um talhão, e o que se tenta
 * fazer sozinho é descobri-lo pela posição — a gleba cujo desenho cabe num
 * talhão é dele. O que não cabe em nenhum (ou cabe em mais de um, na divisa)
 * fica sem talhão, e a pessoa escolhe. Nunca se adivinha.
 *
 * Regras que valem aqui como no cadastro manual (FormGleba):
 *   - o código é único dentro do talhão;
 *   - a gleba tem que ficar dentro do talhão escolhido (com a tolerância de
 *     `avaliarContencao`, que perdoa a gleba desenhada rente à divisa).
 */

/**
 * "Gleba 12 - Mata" -> { codigo: '12', nome: 'Mata' }. Sem esse padrão o nome
 * todo vira o código sugerido ("5-12", "A3"...): quem revisa ajusta.
 */
export function sugerirCodigoGleba(nomeOriginal) {
  const texto = String(nomeOriginal ?? '').trim()
  const m = /^gleba\s+(\S+)\s*-?\s*(.*)$/i.exec(texto)
  if (m) return { codigo: m[1], nome: m[2].trim() }
  return { codigo: texto, nome: '' }
}

function intersectaCaixas(a, b) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

/**
 * O talhão em que a geometria cabe, ou `null`. Só devolve quando há UM talhão
 * que a contém: duas respostas (gleba na divisa) é ambiguidade, e ambiguidade
 * é decisão da pessoa. Talhão sem polígono utilizável nunca responde.
 */
export function talhaoQueContem(geometria, talhoes) {
  const feature = paraFeature(geometria)
  if (!feature?.geometry) return null
  let caixa
  try {
    caixa = bbox(feature)
  } catch {
    return null
  }

  const candidatos = []
  for (const talhao of talhoes) {
    const geo = paraFeature(talhao.geometria)
    if (!geo?.geometry) continue
    try {
      // Barato antes do caro: sem sobreposição de caixas não há como conter.
      if (!intersectaCaixas(caixa, bbox(geo))) continue
    } catch {
      continue
    }
    if (avaliarContencao(feature, geo).situacao === CONTENCAO.DENTRO) candidatos.push(talhao)
  }
  return candidatos.length === 1 ? candidatos[0] : null
}

/**
 * Linhas de revisão, uma por candidato do arquivo. Códigos que se repetem no
 * mesmo talhão ganham "-2", "-3"... para a lista já nascer sem bloqueio (a
 * primeira fica como veio), como na importação de talhões.
 */
export function prepararLinhasDeGlebas(candidatos, talhoes) {
  const linhas = candidatos.map((candidato, indice) => {
    const { codigo, nome } = sugerirCodigoGleba(candidato.nomeOriginal)
    const talhao = talhaoQueContem(candidato.geometria, talhoes)
    return {
      id: `gleba-${indice}`,
      incluir: true,
      codigo,
      nome,
      nomeOriginal: candidato.nomeOriginal,
      geometria: candidato.geometria,
      // Ponto não tem área: fica nulo, nunca zero.
      areaHa: areaEmHectares(candidato.geometria),
      talhaoId: talhao?.id ?? '',
      talhaoAutomatico: Boolean(talhao),
      arquivo: candidato.arquivo ?? '',
    }
  })

  const ocorrencias = new Map()
  for (const linha of linhas) {
    if (!linha.codigo || !linha.talhaoId) continue
    const chave = JSON.stringify([linha.talhaoId, linha.codigo])
    const n = (ocorrencias.get(chave) ?? 0) + 1
    ocorrencias.set(chave, n)
    if (n > 1) linha.codigo = `${linha.codigo}-${n}`
  }
  return linhas
}

/**
 * Erros por linha incluída: o que trava o botão de importar. Recalculado a
 * cada edição, porque um código ou talhão trocado numa linha pode resolver ou
 * criar um conflito em outra.
 *
 * `contencaoDe(linha, talhao)` devolve a situação de contenção (de
 * `CONTENCAO`); fica fora para o componente poder guardar o resultado — o
 * recorte geométrico é caro demais para refazer a cada tecla digitada.
 */
export function errosDasLinhasDeGlebas(linhas, { talhoes, glebasExistentes, contencaoDe }) {
  const erros = new Map()
  const talhaoPorId = new Map(talhoes.map((t) => [t.id, t]))
  const existentes = new Set(glebasExistentes.map((g) => JSON.stringify([g.talhao_id, String(g.codigo).trim()])))

  const contagem = new Map()
  for (const l of linhas) {
    if (!l.incluir || !l.talhaoId || !l.codigo.trim()) continue
    const chave = JSON.stringify([l.talhaoId, l.codigo.trim()])
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }

  for (const l of linhas) {
    if (!l.incluir) continue
    const lista = []
    const codigo = l.codigo.trim()
    const talhao = talhaoPorId.get(l.talhaoId)

    if (!codigo) lista.push('Código obrigatório.')
    if (!talhao) {
      lista.push('Escolha o talhão desta gleba.')
    } else {
      if (codigo) {
        const chave = JSON.stringify([l.talhaoId, codigo])
        if (contagem.get(chave) > 1) lista.push('Código repetido neste talhão, nesta importação.')
        if (existentes.has(chave)) lista.push(`Já existe a gleba "${codigo}" no talhão ${talhao.codigo}.`)
      }
      if (contencaoDe(l, talhao) === CONTENCAO.FORA) lista.push(`Fica fora do talhão ${talhao.codigo}.`)
    }
    erros.set(l.id, lista)
  }
  return erros
}
