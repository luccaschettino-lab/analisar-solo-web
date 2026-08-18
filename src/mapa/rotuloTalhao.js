import { escapar } from './tooltipGleba.js'

/**
 * Rótulo fixo do talhão, desenhado sobre a geometria.
 *
 * Duas linhas: identificação em cima, área embaixo. A área vai na segunda
 * linha e em peso menor porque é consulta, não identidade — quem procura um
 * talhão procura pelo código, e a área é o que ele confere depois de achar.
 *
 * Chamamos de **talhão**, não de "lote". Lote é a coluna da planilha do
 * laboratório; talhão é a entidade do cadastro, com código próprio e
 * permanente. Misturar os dois nomes na tela reintroduz exatamente a tradução
 * mental que o modelo de dados existe para eliminar.
 */

/** Área com duas casas, como o laudo e o cadastro mostram: "46,31 ha". */
export function formatarArea(areaHa) {
  const numero = Number(areaHa)
  if (!Number.isFinite(numero)) return null
  return `${numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`
}

/**
 * HTML do rótulo. Código e nome vêm do cadastro, digitados pelo usuário, e o
 * tooltip do Leaflet aceita HTML — por isso passam por `escapar`.
 *
 * Talhão sem área desenhada (geometria ausente ou degenerada) sai só com a
 * identificação, sem "0,00 ha". Área zero e área desconhecida são coisas
 * diferentes, e a segunda não deve ser exibida como número.
 */
export function conteudoRotuloTalhao(talhao) {
  const descricao = talhao.nome ? ` (${talhao.nome})` : ''
  const titulo = escapar(`Talhão ${talhao.codigo}${descricao}`)

  const area = formatarArea(talhao.area_ha)
  if (!area) return titulo

  return `${titulo}<br><span class="rotulo-area">${escapar(area)}</span>`
}
