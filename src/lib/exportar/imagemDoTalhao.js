import { paraFeature } from '../geo.js'
import { imagemDoIndice, imagemCorReal, distribuicaoPorFaixa, faixasDoIndice } from '../rasterIndice.js'
import logoUrl from '../../assets/marca/moinho-completo.jpg'

/**
 * Imagem "de relatório" de um talhão: a foto de satélite de fundo (Esri World
 * Imagery), o índice da data por cima, recortado no talhão, o contorno, a
 * legenda com quanto do talhão está em cada faixa, a logo do Moinho, a data,
 * a escala e o norte. A mesma visão do Monitoramento, pronta para mandar.
 *
 * O fundo é montado uma vez por talhão (`prepararFundo`) e reaproveitado para
 * cada índice (`desenharImagemDoTalhao`). Sem índice (`indice` = null), sai só
 * a imagem real.
 */

const LARGURA = 1800
const ALTURA = 1200
const CABECALHO = 132
const RODAPE = 46
const MARGEM = 36
const LATERAL = 500
const MAPA = { x: MARGEM, y: CABECALHO + 20, w: LARGURA - LATERAL - MARGEM * 2 - 24, h: ALTURA - CABECALHO - RODAPE - 40 }
const LADO = { x: MAPA.x + MAPA.w + 32, y: MAPA.y, w: LATERAL - 16 }

const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile'
const FONTE = '"Manrope Variable", Manrope, "Segoe UI", system-ui, sans-serif'
const AZUL = '#12456a'
const TEXTO = '#0f172a'
const SUAVE = '#64748b'

export const NOMES_INDICE = {
  ndvi: ['NDVI', 'Vigor da vegetação'],
  evi: ['EVI', 'Vigor da vegetação (dossel fechado)'],
  savi: ['SAVI', 'Vigor ajustado ao solo exposto'],
  ndwi: ['NDWI', 'Água na superfície'],
}

// ---------- Projeção Web Mercator (pixels do mundo no zoom z) ----------
const mx = (lng, z) => ((lng + 180) / 360) * 256 * 2 ** z
const my = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z
}

function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // o servidor de tiles libera (CORS *): o canvas não fica "sujo"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('imagem não carregou'))
    img.src = src
  })
}

let logoPromessa = null
const carregarLogo = () => (logoPromessa ??= carregarImagem(logoUrl).catch(() => null))

function aneisDe(geometria) {
  const g = paraFeature(geometria)?.geometry
  if (!g) return []
  const polis = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  return polis.flat()
}

function caminhoDoTalhao(ctx, aneis, px) {
  ctx.beginPath()
  for (const anel of aneis) {
    anel.forEach(([lng, lat], i) => {
      const [x, y] = px(lng, lat)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
  }
}

/**
 * Fundo do talhão: enquadramento + foto de satélite já desenhada num canvas do
 * tamanho do quadro do mapa. Devolve { canvas, px(lng, lat) → [x, y], z, aneis, latCentro }.
 */
export async function prepararFundo(geometria) {
  const aneis = aneisDe(geometria)
  if (!aneis.length) throw new Error('Talhão sem área desenhada.')
  const lngs = aneis.flat().map((p) => p[0])
  const lats = aneis.flat().map((p) => p[1])
  const [oeste, leste, sul, norte] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)]

  // Zoom (fracionário) que faz o talhão caber no quadro com 8% de folga.
  const folga = 0.84
  const w0 = mx(leste, 0) - mx(oeste, 0)
  const h0 = my(sul, 0) - my(norte, 0)
  const z = Math.min(Math.log2((MAPA.w * folga) / Math.max(w0, 1e-12)), Math.log2((MAPA.h * folga) / Math.max(h0, 1e-12)), 19)
  const cx = (mx(oeste, z) + mx(leste, z)) / 2
  const cy = (my(norte, z) + my(sul, z)) / 2
  const x0 = cx - MAPA.w / 2
  const y0 = cy - MAPA.h / 2
  const px = (lng, lat) => [mx(lng, z) - x0, my(lat, z) - y0]

  const canvas = document.createElement('canvas')
  canvas.width = MAPA.w
  canvas.height = MAPA.h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, MAPA.w, MAPA.h)

  // Tiles do zoom inteiro logo acima (mais nítido), reduzidos para o zoom real.
  const zt = Math.min(19, Math.max(0, Math.ceil(z)))
  const escala = 2 ** (z - zt)
  const tx0 = Math.floor((x0 / escala) / 256)
  const ty0 = Math.floor((y0 / escala) / 256)
  const tx1 = Math.floor(((x0 + MAPA.w) / escala) / 256)
  const ty1 = Math.floor(((y0 + MAPA.h) / escala) / 256)
  const pedidos = []
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      pedidos.push(
        carregarImagem(`${TILE}/${zt}/${ty}/${tx}`)
          .then((img) => {
            const lado = 256 * escala
            ctx.drawImage(img, tx * lado - x0, ty * lado - y0, lado + 0.5, lado + 0.5)
          })
          .catch(() => {}), // um tile faltando não estraga a imagem
      )
    }
  }
  await Promise.all(pedidos)
  return { canvas, px, z, aneis, latCentro: (sul + norte) / 2 }
}

function textoAjustado(ctx, texto, larguraMax) {
  if (ctx.measureText(texto).width <= larguraMax) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > larguraMax) t = t.slice(0, -1)
  return `${t}…`
}

function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

const num = (v, casas = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }))

function escalaGrafica(ctx, fundo) {
  // Metros por pixel no centro do talhão.
  const mpp = (156543.03392 * Math.cos((fundo.latCentro * Math.PI) / 180)) / 2 ** fundo.z
  const alvo = mpp * 180
  const passos = [10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]
  const metros = passos.reduce((m, p) => (p <= alvo ? p : m), passos[0])
  const w = metros / mpp
  const x = MAPA.x + MAPA.w - w - 24
  const y = MAPA.y + MAPA.h - 30
  ctx.fillStyle = 'rgba(15,23,42,0.6)'
  retanguloArredondado(ctx, x - 12, y - 30, w + 24, 46, 8)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, w, 5)
  ctx.fillRect(x, y - 6, 2, 11)
  ctx.fillRect(x + w - 2, y - 6, 2, 11)
  ctx.font = `600 15px ${FONTE}`
  ctx.textAlign = 'center'
  ctx.fillText(metros >= 1000 ? `${metros / 1000} km` : `${metros} m`, x + w / 2, y - 10)
  ctx.textAlign = 'left'
}

function setaNorte(ctx) {
  const x = MAPA.x + MAPA.w - 44
  const y = MAPA.y + 30
  ctx.fillStyle = 'rgba(15,23,42,0.6)'
  ctx.beginPath()
  ctx.arc(x, y + 14, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(x, y - 2)
  ctx.lineTo(x + 9, y + 22)
  ctx.lineTo(x, y + 16)
  ctx.lineTo(x - 9, y + 22)
  ctx.closePath()
  ctx.fill()
  ctx.font = `700 13px ${FONTE}`
  ctx.textAlign = 'center'
  ctx.fillText('N', x, y + 36)
  ctx.textAlign = 'left'
}

/**
 * opcoes: { fazenda, talhao, fundo, dados (resposta da função) | null,
 *           indice ('ndvi'…) | null, data (ISO da cena) | null }
 * Devolve um Blob JPEG.
 */
export async function desenharImagemDoTalhao({ fazenda, talhao, fundo, dados, indice, data }) {
  if (document.fonts?.ready) await document.fonts.ready
  const logo = await carregarLogo()
  const canvas = document.createElement('canvas')
  canvas.width = LARGURA
  canvas.height = ALTURA
  const ctx = canvas.getContext('2d')
  const comIndice = Boolean(indice && dados?.indices?.[indice])
  // Sem índice mas com a cena: a cor real daquela data por cima do fundo.
  const corReal = !indice && Boolean(dados?.cor)
  const comData = comIndice || corReal

  // Fundo da página
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, LARGURA, ALTURA)

  // ---- Cabeçalho ----
  ctx.fillStyle = AZUL
  ctx.fillRect(0, CABECALHO - 6, LARGURA, 6)
  let xTitulo = MARGEM
  if (logo) {
    const h = 104
    const w = (logo.width / logo.height) * h
    ctx.drawImage(logo, MARGEM, 12, w, h)
    xTitulo = MARGEM + w + 28
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(xTitulo - 14, 26, 2, 76)
  }
  const nomeIndice = comIndice ? NOMES_INDICE[indice]?.[0] ?? indice.toUpperCase() : corReal ? 'Imagem real' : 'Imagem de satélite'
  ctx.fillStyle = TEXTO
  ctx.font = `800 40px ${FONTE}`
  ctx.fillText(textoAjustado(ctx, `Talhão ${talhao.codigo}${talhao.nome ? ` · ${talhao.nome}` : ''} — ${nomeIndice}`, LARGURA - xTitulo - MARGEM), xTitulo, 62)
  ctx.fillStyle = SUAVE
  ctx.font = `500 22px ${FONTE}`
  const dataTexto = data ? new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : null
  const subtitulo = [`Fazenda ${fazenda.nome}`, comData && dataTexto ? `imagem de ${dataTexto}` : null, comData ? 'Sentinel-2' : null].filter(Boolean).join('  ·  ')
  ctx.fillText(textoAjustado(ctx, subtitulo, LARGURA - xTitulo - MARGEM), xTitulo, 100)

  // ---- Mapa ----
  ctx.save()
  retanguloArredondado(ctx, MAPA.x, MAPA.y, MAPA.w, MAPA.h, 14)
  ctx.clip()
  ctx.drawImage(fundo.canvas, MAPA.x, MAPA.y)
  const px = (lng, lat) => {
    const [x, y] = fundo.px(lng, lat)
    return [x + MAPA.x, y + MAPA.y]
  }
  // Fora do talhão escurecido: o olho vai direto para a lavoura.
  ctx.beginPath()
  ctx.rect(MAPA.x, MAPA.y, MAPA.w, MAPA.h)
  for (const anel of fundo.aneis) {
    anel.forEach(([lng, lat], i) => {
      const [x, y] = px(lng, lat)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
  }
  ctx.fillStyle = comData ? 'rgba(15,23,42,0.55)' : 'rgba(15,23,42,0.35)'
  ctx.fill('evenodd')

  if (comData) {
    const img = await carregarImagem(corReal ? imagemCorReal(dados) : imagemDoIndice(dados, indice))
    const [oeste, sul, leste, norte] = dados.janela.bbox
    const [xa, ya] = px(oeste, norte)
    const [xb, yb] = px(leste, sul)
    ctx.save()
    caminhoDoTalhao(ctx, fundo.aneis, px)
    ctx.clip('evenodd')
    // Índice: pixel de 10 m como ele é, sem borrar. Cor real: suave, como foto.
    ctx.imageSmoothingEnabled = corReal
    ctx.imageSmoothingQuality = 'high'
    ctx.globalAlpha = corReal ? 1 : 0.95
    ctx.drawImage(img, xa, ya, xb - xa, yb - ya)
    ctx.restore()
  }
  // Contorno: sombra escura + linha branca, aparece em qualquer fundo.
  caminhoDoTalhao(ctx, fundo.aneis, px)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(15,23,42,0.7)'
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.5
  ctx.stroke()
  escalaGrafica(ctx, fundo)
  setaNorte(ctx)
  ctx.restore()

  // ---- Lateral ----
  let y = LADO.y + 8
  const rotuloLateral = (t) => {
    ctx.fillStyle = SUAVE
    ctx.font = `700 15px ${FONTE}`
    ctx.fillText(t.toUpperCase(), LADO.x, y)
    y += 12
  }
  const area = talhao.area_ha != null ? Number(talhao.area_ha) : null
  rotuloLateral('Talhão')
  ctx.fillStyle = TEXTO
  ctx.font = `800 54px ${FONTE}`
  ctx.fillText(textoAjustado(ctx, String(talhao.codigo), LADO.w), LADO.x, y + 48)
  y += 64
  if (area) {
    ctx.fillStyle = SUAVE
    ctx.font = `500 22px ${FONTE}`
    ctx.fillText(`${num(area, 1)} ha`, LADO.x, y + 18)
    y += 30
  }
  y += 26

  if (comIndice) {
    const [sigla, descricao] = NOMES_INDICE[indice] ?? [indice.toUpperCase(), '']
    rotuloLateral(`${sigla} · ${descricao}`)
    const est = dados.estatisticas?.[indice]
    ctx.fillStyle = AZUL
    ctx.font = `800 64px ${FONTE}`
    ctx.fillText(num(est?.media), LADO.x, y + 58)
    const larguraMedia = ctx.measureText(num(est?.media)).width
    ctx.fillStyle = SUAVE
    ctx.font = `600 20px ${FONTE}`
    ctx.fillText('médio', LADO.x + larguraMedia + 12, y + 56)
    y += 78
    ctx.font = `500 18px ${FONTE}`
    ctx.fillText(`mín. ${num(est?.minimo)}   ·   máx. ${num(est?.maximo)}`, LADO.x, y + 14)
    y += 46

    // Legenda: cor, faixa e quanto do talhão está nela.
    rotuloLateral('Quanto do talhão em cada faixa')
    y += 10
    const distrib = distribuicaoPorFaixa(dados, indice)
    const faixas = faixasDoIndice(indice)
    let anterior = null
    for (const [k, f] of distrib.entries()) {
      const limite = faixas[k].ate
      const intervalo = limite === null ? `> ${num(anterior)}` : anterior === null ? `≤ ${num(limite)}` : `${num(anterior)} a ${num(limite)}`
      anterior = limite
      ctx.fillStyle = f.cor
      retanguloArredondado(ctx, LADO.x, y, 26, 26, 6)
      ctx.fill()
      ctx.fillStyle = TEXTO
      ctx.font = `700 19px ${FONTE}`
      ctx.fillText(f.rotulo, LADO.x + 40, y + 13)
      ctx.fillStyle = SUAVE
      ctx.font = `500 14px ${FONTE}`
      ctx.fillText(intervalo, LADO.x + 40, y + 32)
      // Barra do percentual
      const bx = LADO.x + 230
      const bw = LADO.w - 230 - 70
      ctx.fillStyle = '#f1f5f9'
      retanguloArredondado(ctx, bx, y + 6, bw, 14, 7)
      ctx.fill()
      if (f.pct > 0) {
        ctx.fillStyle = f.cor
        retanguloArredondado(ctx, bx, y + 6, Math.max(6, (bw * f.pct) / 100), 14, 7)
        ctx.fill()
      }
      ctx.fillStyle = TEXTO
      ctx.font = `700 18px ${FONTE}`
      ctx.textAlign = 'right'
      ctx.fillText(`${Math.round(f.pct)}%`, LADO.x + LADO.w, y + 19)
      ctx.textAlign = 'left'
      y += 52
    }
    const q = dados.qualidade
    if (q?.pixelsNoTalhao) {
      const limpo = (q.validos / q.pixelsNoTalhao) * 100
      y += 6
      ctx.fillStyle = '#94a3b8'
      retanguloArredondado(ctx, LADO.x, y, 26, 26, 6)
      ctx.fill()
      ctx.fillStyle = TEXTO
      ctx.font = `600 17px ${FONTE}`
      ctx.fillText(limpo >= 99.5 ? 'Talhão todo sem nuvem' : `Nuvem / sem leitura: ${Math.round(100 - limpo)}% do talhão`, LADO.x + 40, y + 19)
      y += 44
    }
  } else if (corReal) {
    rotuloLateral('Imagem real')
    ctx.fillStyle = TEXTO
    ctx.font = `700 26px ${FONTE}`
    ctx.fillText(dataTexto ?? '', LADO.x, y + 22)
    y += 44
    ctx.font = `500 19px ${FONTE}`
    for (const linha of ['O talhão como o satélite Sentinel-2', 'o fotografou nesta data, em cor real.', 'Nuvem aparece branca.']) {
      ctx.fillText(linha, LADO.x, y + 18)
      y += 28
    }
    const q = dados.qualidade
    if (q?.pixelsNoTalhao) {
      const limpo = (q.validos / q.pixelsNoTalhao) * 100
      y += 16
      ctx.font = `600 17px ${FONTE}`
      ctx.fillText(limpo >= 99.5 ? 'Talhão todo sem nuvem' : `Nuvem / sem leitura: ${Math.round(100 - limpo)}% do talhão`, LADO.x, y + 18)
    }
  } else {
    rotuloLateral('Imagem real')
    ctx.fillStyle = TEXTO
    ctx.font = `500 19px ${FONTE}`
    for (const linha of ['Foto de satélite de alta resolução', 'do mapa de fundo (Esri World Imagery).', 'A data da foto varia por região e não', 'é a mesma das imagens de índice.']) {
      ctx.fillText(linha, LADO.x, y + 18)
      y += 28
    }
  }

  // ---- Rodapé ----
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, ALTURA - RODAPE, LARGURA, RODAPE)
  ctx.fillStyle = SUAVE
  ctx.font = `500 15px ${FONTE}`
  const creditos = comIndice
    ? 'Índice: Sentinel-2 L2A (Copernicus/ESA), 10 m por pixel, nuvem marcada pela própria cena  ·  Fundo: Esri World Imagery'
    : corReal
      ? 'Talhão: Sentinel-2 L2A (Copernicus/ESA), cor real, 10 m por pixel  ·  Fundo: Esri World Imagery'
      : 'Imagem: Esri, Maxar, Earthstar Geographics (World Imagery)'
  ctx.fillText(creditos, MARGEM, ALTURA - RODAPE / 2 + 5)
  ctx.textAlign = 'right'
  ctx.fillStyle = AZUL
  ctx.font = `700 15px ${FONTE}`
  ctx.fillText(`Moinho · gerado em ${new Date().toLocaleDateString('pt-BR')}`, LARGURA - MARGEM, ALTURA - RODAPE / 2 + 5)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/jpeg', 0.92))
}

/** Nome de arquivo da imagem pronta. */
export function nomeDaImagem(talhao, indice, data) {
  const limpar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')
  return `talhao_${limpar(talhao.codigo)}_${indice ?? 'imagem_real'}${data ? `_${String(data).slice(0, 10)}` : ''}.jpg`
}
