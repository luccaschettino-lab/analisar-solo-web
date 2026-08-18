import { ESTADO } from '../lib/coloracao.js'
import { rotuloComUnidade } from '../lib/parametros.js'

/**
 * Código e nome vêm do cadastro, digitados pelo usuário. O tooltip do Leaflet
 * aceita HTML, então tudo que vem de fora passa por aqui antes.
 */
export function escapar(texto) {
  return String(texto ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

function identificacao(gleba) {
  return gleba.nome ? `${gleba.codigo} · ${gleba.nome}` : gleba.codigo
}

/**
 * Conteúdo do tooltip de uma gleba.
 *
 * Sem filtro completo, mostra só a identificação — não há parâmetro sobre o
 * que falar. Com filtro, mostra o valor e, quando existe, a classificação.
 *
 * Os quatro estados dizem coisas diferentes de propósito: "Sem dado" é gleba
 * não amostrada naquele filtro; "sem medição" é gleba amostrada em que o
 * laboratório não mediu aquele parâmetro. Achatar os dois esconderia de quem
 * é o problema.
 */
export function conteudoTooltipGleba(gleba, info, chaveParametro) {
  const titulo = `<span class="font-semibold">${escapar(identificacao(gleba))}</span>`
  if (!info) return titulo

  const nome = escapar(rotuloComUnidade(chaveParametro))

  if (info.estado === ESTADO.SEM_ANALISE) {
    return `${titulo}<br><span class="text-slate-500">${nome}: sem dado nesta safra</span>`
  }

  if (info.estado === ESTADO.SEM_MEDICAO) {
    return `${titulo}<br><span class="text-slate-500">${nome}: sem medição neste laudo</span>`
  }

  const valor = `${nome}: <span class="font-medium">${escapar(info.valorFormatado)}</span>`

  if (info.estado === ESTADO.SEM_FAIXA) {
    return `${titulo}<br>${valor}<br><span class="text-slate-400">sem classificação definida</span>`
  }

  return `${titulo}<br>${valor}<br><span class="font-medium">${escapar(info.rotuloNivel)}</span>`
}
