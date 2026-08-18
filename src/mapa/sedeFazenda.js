import L from 'leaflet'
import { escapar } from './tooltipGleba.js'

/**
 * Pin da sede da fazenda.
 *
 * Até a Fase 6 o ponto gravado em `fazendas` era só "onde o mapa abre" — um
 * detalhe de interface, sem representação na tela. Ele passa a ser a **sede**:
 * um lugar real, que o produtor reconhece, e que por isso aparece marcado e
 * com nome.
 *
 * O ícone é SVG inline num `divIcon`, e não um arquivo de imagem. Mesma razão
 * das glebas-ponto usarem `circleMarker`: `L.Icon` padrão busca PNGs por
 * caminho relativo, o que quebra com o bundler e com o prefixo
 * `/analisar-solo-web/` do GitHub Pages.
 */

// Gota clássica de marcador, com furo branco no meio. O contorno escuro é o
// que garante leitura sobre solo claro; o miolo branco, sobre mata escura.
const SVG_PIN = `
<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M13 1C6.9 1 2 5.9 2 12c0 8.2 11 21 11 21s11-12.8 11-21c0-6.1-4.9-11-11-11z"
        fill="#f59e0b" stroke="#1f2937" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="13" cy="12" r="4.2" fill="#ffffff" stroke="#1f2937" stroke-width="1.5"/>
</svg>`.trim()

const ICONE_SEDE = L.divIcon({
  className: 'pin-sede',
  html: SVG_PIN,
  iconSize: [26, 34],
  // Ponta da gota no ponto, e não o centro do desenho: um marcador ancorado
  // pelo meio aponta 17 px acima do lugar que a pessoa clicou.
  iconAnchor: [13, 34],
  tooltipAnchor: [0, 2],
})

/**
 * Cria o marcador, sem adicioná-lo ao mapa — quem gerencia o ciclo de vida é
 * o hook que sabe quando a fazenda muda.
 *
 * `interactive: false` de propósito: o pin é referência visual, não alvo.
 * Interativo, ele engoliria o clique de quem está desenhando um talhão ou
 * remarcando a própria sede, justo no ponto em que a pessoa quer clicar.
 */
export function criarMarcadorSede(lat, lng, nomeFazenda) {
  const marcador = L.marker([lat, lng], {
    icon: ICONE_SEDE,
    interactive: false,
    keyboard: false,
    // Acima das geometrias, abaixo dos controles.
    zIndexOffset: 500,
  })

  if (nomeFazenda) {
    // O Leaflet escreve o conteúdo do tooltip com `innerHTML`, mesmo quando
    // recebe string pura — não há escape embutido. O nome da fazenda é
    // digitado pelo usuário, então passa pelo mesmo `escapar` dos outros
    // tooltips do mapa.
    marcador.bindTooltip(escapar(nomeFazenda), {
      permanent: true,
      direction: 'bottom',
      className: 'rotulo-sede',
      opacity: 1,
    })
  }

  return marcador
}
