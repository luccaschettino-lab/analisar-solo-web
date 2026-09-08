import { ESTADO } from '../lib/coloracao.js'
import { rotuloComUnidade } from '../lib/parametros.js'
import { escapar } from './tooltipGleba.js'

function identificacao(talhao) {
  return talhao.nome ? `${talhao.codigo} · ${talhao.nome}` : talhao.codigo
}

/**
 * Conteúdo do tooltip de um talhão.
 *
 * Sem filtro completo, mostra só a identificação — não há parâmetro sobre o
 * que falar. Com filtro, mostra a média das amostras do talhão e, quando
 * existe, a classificação — o mapa de calor já mostra a variação entre os
 * pontos, o tooltip só precisa de um número pra quem passa o mouse rápido.
 *
 * Os quatro estados dizem coisas diferentes de propósito: "sem dado" é
 * talhão não amostrado naquela safra; "sem medição" é talhão amostrado em
 * que nenhum ponto mediu esse parâmetro. Achatar os dois esconderia de quem
 * é o problema.
 */
export function conteudoTooltipTalhao(talhao, info, chaveParametro) {
  const titulo = `<span class="font-semibold">Talhão ${escapar(identificacao(talhao))}</span>`
  if (!info) return titulo

  const nome = escapar(rotuloComUnidade(chaveParametro))
  const n = info.pontos?.length ?? 0
  const contagem = `${n} ${n === 1 ? 'amostra' : 'amostras'}`

  if (info.estado === ESTADO.SEM_ANALISE) {
    return `${titulo}<br><span class="text-slate-500">${nome}: sem dado nesta safra</span>`
  }

  if (info.estado === ESTADO.SEM_MEDICAO) {
    return `${titulo}<br><span class="text-slate-500">${nome}: sem medição neste laudo (${contagem})</span>`
  }

  const valor =
    `${nome}: <span class="font-medium">${escapar(info.valorFormatado)}</span> ` +
    `<span class="text-slate-400">(média de ${contagem})</span>`

  if (info.estado === ESTADO.SEM_FAIXA) {
    return `${titulo}<br>${valor}<br><span class="text-slate-400">sem classificação definida</span>`
  }

  return `${titulo}<br>${valor}<br><span class="font-medium">${escapar(info.rotuloNivel)}</span>`
}
