import { CINZA_NEUTRO, CINZA_HACHURA, ESCALA_DIVERGENTE } from '../config/mapa.js'
import { VARIACAO } from './estadosVariacao.js'

/**
 * Como a variação de uma gleba vira tom na tela.
 *
 * Separado do cálculo em `lib/variacao.js` porque são perguntas diferentes:
 * lá se decide *o que* aconteceu com a gleba, aqui *como isso aparece*. A
 * troca da rampa de cor — se um dia o vermelho/azul precisar mudar — não
 * deveria abrir o arquivo que decide o que é queda e o que é estabilidade.
 *
 * Os dados da rampa moram em `config/mapa.js`; aqui só a matemática.
 */

/**
 * Extremo da escala: o maior |delta| entre as glebas comparáveis.
 *
 * **A escala é simétrica por construção.** Se a maior alta for +2 e a maior
 * queda for −0,3, os dois lados ancoram em 2. Ancorar cada lado no seu próprio
 * máximo faria a queda de 0,3 sair tão vermelha quanto a alta de 2 sai azul —
 * duas mudanças de tamanhos diferentes com a mesma intensidade na tela.
 */
export function escalaDivergente(linhas) {
  let max = 0
  for (const linha of linhas) {
    if (linha.delta === null) continue
    const magnitude = Math.abs(linha.delta)
    if (magnitude > max) max = magnitude
  }
  return { max, min: -max }
}

function hexParaRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbParaHex(canais) {
  return '#' + canais.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

/** Interpolação linear em sRGB. Suficiente para uma rampa curta de dois tons. */
export function interpolarCor(inicio, fim, t) {
  const a = hexParaRgb(inicio)
  const b = hexParaRgb(fim)
  const f = Math.min(1, Math.max(0, t))
  return rgbParaHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * f))
}

/**
 * Onde a magnitude cai entre o limiar e o extremo da escala, de 0 a 1.
 *
 * Quando o extremo não é maior que o limiar — caso de uma variação
 * significativa só — devolve 1: a única mudança visível na tela merece a ponta
 * forte da rampa, não um tom lavado que a esconderia.
 */
export function fracaoNaEscala(magnitude, limiar, max) {
  if (!(max > limiar)) return 1
  return Math.min(1, Math.max(0, (magnitude - limiar) / (max - limiar)))
}

/**
 * Cor da gleba no mapa divergente.
 *
 * Os dois estados de ausência não passam pela rampa: ausência não tem
 * magnitude, e pintá-la com qualquer tom da escala afirmaria uma variação que
 * ninguém mediu.
 */
export function corDaVariacao(linha, max) {
  if (linha.estado === VARIACAO.SEM_OS_DOIS) return CINZA_NEUTRO
  if (linha.estado === VARIACAO.SEM_UM_ANO) return CINZA_HACHURA
  if (linha.estado === VARIACAO.ESTAVEL) return ESCALA_DIVERGENTE.estavel

  const lado = linha.delta > 0 ? ESCALA_DIVERGENTE.alta : ESCALA_DIVERGENTE.queda
  const fracao = fracaoNaEscala(Math.abs(linha.delta), linha.limiar, max)
  return interpolarCor(lado.fraca, lado.forte, fracao)
}
