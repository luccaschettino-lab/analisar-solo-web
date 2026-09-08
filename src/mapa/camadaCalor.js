import L from 'leaflet'
import { gradienteDeNiveis } from '../lib/coloracao.js'
import { interpolarCor } from '../lib/escalaDivergente.js'

/**
 * Mapa de calor por interpolação (IDW), clipado na união dos talhões com
 * dado — não o borrão de pontos do `leaflet.heat` (Fase 8), mas uma
 * superfície contínua cobrindo o talhão inteiro, como um mapa de fertilidade
 * de verdade: a cor atravessa a linha entre duas quadras vizinhas do mesmo
 * talhão sem respeitar a grade, porque o solo não sabe onde o cadastro
 * desenhou a divisa.
 *
 * Pane própria (`PANE_CALOR`), entre o preenchimento do talhão (overlayPane,
 * 400) e o contorno grosso (`contornoTalhao`, 450) — desenhado depois do chão
 * do talhão e antes da linha que marca a fronteira.
 */
export const PANE_CALOR = 'calorTalhao'
export const Z_CALOR = 420

// Grade de cálculo baixa de propósito: IDW é O(pontos × células), e o
// resultado vai ser esticado com suavização — computar em alta resolução só
// gastaria CPU num detalhe que a interpolação do canvas apaga de qualquer
// jeito.
const GRADE_LADO_MAX = 150
// Resolução final do raster. Não acompanha o zoom do mapa — como qualquer
// ImageOverlay georreferenciado, o Leaflet reamostra ao aproximar. Nesse
// tamanho o raster fica nítido na maioria dos zooms de uso normal.
const SAIDA_LADO_MAX = 900

function* aneisDe(geometry) {
  if (!geometry) return
  if (geometry.type === 'Polygon') {
    for (const anel of geometry.coordinates) yield anel
  } else if (geometry.type === 'MultiPolygon') {
    for (const poligono of geometry.coordinates) {
      for (const anel of poligono) yield anel
    }
  }
}

function bboxDe(geometrias) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const geometria of geometrias) {
    for (const anel of aneisDe(geometria)) {
      for (const [lng, lat] of anel) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null
  return [minLng, minLat, maxLng, maxLat]
}

/** As paradas de `gradienteDeNiveis()` viradas numa função `t (0..1) -> hex`. */
function construirGradiente() {
  const paradas = gradienteDeNiveis()
  const chaves = Object.keys(paradas).map(Number).sort((a, b) => a - b)

  return function corDoValor(t) {
    const v = Math.min(1, Math.max(0, t))
    for (let i = 0; i < chaves.length - 1; i++) {
      const a = chaves[i]
      const b = chaves[i + 1]
      if (v >= a && v <= b) {
        return interpolarCor(paradas[a], paradas[b], (v - a) / (b - a || 1))
      }
    }
    return paradas[chaves[chaves.length - 1]]
  }
}

/**
 * Monta o raster de calor a partir dos talhões com dado no filtro atual.
 *
 * `talhoesComDado` é `[{ geometry, pontos: [{ lat, lng, valor }] }]` — só os
 * talhões coloridos (não hachurados) entram, e só a geometria deles delimita
 * o recorte. Um talhão sem amostra no meio de dois amostrados não ganha cor
 * emprestada dos vizinhos: fica de fora do recorte, e a hachura dele (pintada
 * à parte) continua avisando que ali não há dado.
 *
 * Devolve `null` quando não há o que desenhar (nenhum ponto, ou geometria sem
 * área) — quem chama simplesmente não adiciona nada ao mapa.
 */
export function criarCamadaCalor(talhoesComDado, opacidade = 0.92) {
  const geometrias = talhoesComDado.map((t) => t.geometry).filter(Boolean)
  const bbox = bboxDe(geometrias)
  if (!bbox) return null

  const [minLng, minLat, maxLng, maxLat] = bbox
  const bboxW = maxLng - minLng
  const bboxH = maxLat - minLat
  if (!(bboxW > 0) || !(bboxH > 0)) return null

  const pontos = talhoesComDado
    .flatMap((t) => t.pontos)
    .filter((p) => p.lat != null && p.lng != null && p.valor != null)
  if (pontos.length === 0) return null

  const latMed = (minLat + maxLat) / 2
  // Graus de longitude "encolhem" com a latitude — sem a correção, a grade
  // ficaria distorcida (células mais largas que altas) longe do equador.
  const correcaoLng = Math.cos((latMed * Math.PI) / 180) || 1
  const aspecto = (bboxW * correcaoLng) / bboxH

  function dimensoes(ladoMax) {
    return aspecto >= 1
      ? { w: ladoMax, h: Math.max(24, Math.round(ladoMax / aspecto)) }
      : { w: Math.max(24, Math.round(ladoMax * aspecto)), h: ladoMax }
  }

  const grade = dimensoes(GRADE_LADO_MAX)
  const saida = dimensoes(SAIDA_LADO_MAX)
  const corDoValor = construirGradiente()

  // ---- IDW numa grade baixa-resolução -------------------------------------
  const gradeCanvas = document.createElement('canvas')
  gradeCanvas.width = grade.w
  gradeCanvas.height = grade.h
  const gctx = gradeCanvas.getContext('2d')

  for (let j = 0; j < grade.h; j++) {
    const lat = maxLat - ((j + 0.5) / grade.h) * bboxH
    for (let i = 0; i < grade.w; i++) {
      const lng = minLng + ((i + 0.5) / grade.w) * bboxW

      let somaPeso = 0
      let somaValor = 0
      let exato = null
      for (const p of pontos) {
        // Distância aproximada em metros — suficiente para pesar, não para
        // medir: erro de projeção é irrelevante na escala de uma fazenda.
        const dx = (p.lng - lng) * correcaoLng * 111320
        const dy = (p.lat - lat) * 110540
        const distQuad = dx * dx + dy * dy
        if (distQuad < 1) {
          exato = p.valor
          break
        }
        const peso = 1 / distQuad // IDW com expoente 2
        somaPeso += peso
        somaValor += peso * p.valor
      }

      const valor = exato != null ? exato : somaPeso > 0 ? somaValor / somaPeso : 0
      gctx.fillStyle = corDoValor(valor)
      gctx.fillRect(i, j, 1, 1)
    }
  }

  // ---- amplia com suavização, depois recorta na união dos talhões --------
  const final = document.createElement('canvas')
  final.width = saida.w
  final.height = saida.h
  const fctx = final.getContext('2d')
  fctx.imageSmoothingEnabled = true
  if ('imageSmoothingQuality' in fctx) fctx.imageSmoothingQuality = 'high'
  fctx.drawImage(gradeCanvas, 0, 0, grade.w, grade.h, 0, 0, saida.w, saida.h)

  fctx.globalCompositeOperation = 'destination-in'
  fctx.fillStyle = '#000'
  fctx.beginPath()
  for (const geometria of geometrias) {
    for (const anel of aneisDe(geometria)) {
      anel.forEach(([lng, lat], idx) => {
        const x = ((lng - minLng) / bboxW) * saida.w
        const y = ((maxLat - lat) / bboxH) * saida.h
        if (idx === 0) fctx.moveTo(x, y)
        else fctx.lineTo(x, y)
      })
      fctx.closePath()
    }
  }
  // 'evenodd' trata buraco de polígono corretamente sem se importar com a
  // orientação dos anéis — o dado que veio do KML nem sempre segue convenção.
  fctx.fill('evenodd')
  fctx.globalCompositeOperation = 'source-over'

  const bounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng])
  return L.imageOverlay(final.toDataURL('image/png'), bounds, {
    opacity: opacidade,
    interactive: false,
    pane: PANE_CALOR,
  })
}

/**
 * Um quadradinho numerado por ponto de amostra — a mesma linguagem visual de
 * relatório de fertilidade que motivou o pedido do mapa de calor contínuo.
 * A numeração é só a ordem de listagem por talhão, não um código do laudo:
 * existe para localizar o ponto no mapa, não para identificá-lo de outro
 * lugar.
 */
export function criarMarcadoresDeAmostra(talhoesComDado) {
  const grupo = L.layerGroup()
  for (const { pontos } of talhoesComDado) {
    pontos.forEach((p, i) => {
      if (p.lat == null || p.lng == null) return
      const icone = L.divIcon({
        className: 'marcador-amostra',
        html: `<span>${i + 1}</span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      L.marker([p.lat, p.lng], { icon: icone, interactive: false, keyboard: false }).addTo(grupo)
    })
  }
  return grupo
}
