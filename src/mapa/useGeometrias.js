import { useCallback, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { paraFeature, ehPonto, pontoRotulo } from '../lib/geo.js'
import { variarLuminosidade } from '../lib/cor.js'
import { garantirHachura, PREENCHIMENTO_HACHURA } from './hachura.js'
import { conteudoTooltipTalhao } from './tooltipTalhao.js'
import { conteudoTooltipGleba } from './tooltipGleba.js'
import { conteudoRotuloTalhao, conteudoRotuloGleba } from './rotuloTalhao.js'
import { criarCamadaCalor, criarMarcadoresDeAmostra, PANE_CALOR, Z_CALOR } from './camadaCalor.js'
import { posicaoDoNivel } from '../lib/coloracao.js'
import {
  ZOOM_MINIMO_ROTULO,
  ZOOM_MINIMO_ROTULO_GLEBA,
  ESTILO_TALHAO,
  ESTILO_TALHAO_DESTACADO,
  ESTILO_CONTORNO_TALHAO,
  ESTILO_CONTORNO_TALHAO_DESTACADO,
  ESTILO_GLEBA,
  ESTILO_GLEBA_DESTACADA,
  COR_GLEBA,
  RAIO_PONTO_GLEBA,
} from '../config/mapa.js'

// Pane próprio para o contorno do talhão: acima do overlayPane (400), onde
// vive o polígono do talhão e o mapa de calor, mas abaixo do markerPane (600)
// e do tooltipPane (650). Sem isso, a ordem em que cada camada é adicionada
// ao mapa decidiria a sobreposição — frágil a cada re-render.
const PANE_CONTORNO_TALHAO = 'contornoTalhao'
const Z_CONTORNO_TALHAO = 450

// Pane da gleba: acima do mapa de calor (420), abaixo do contorno do talhão
// (450). A gleba é subdivisão de cadastro, não dado — por isso fica entre a
// superfície colorida e a linha grossa que marca "aqui acaba o talhão", nunca
// escondendo nenhuma das duas.
const PANE_GLEBA = 'glebas'
const Z_GLEBA = 430

function rotulo(talhao) {
  return talhao.nome ? `${talhao.codigo} — ${talhao.nome}` : talhao.codigo
}

/**
 * Desenha talhões e glebas sobre o mapa.
 *
 * O talhão é a unidade que se seleciona, colore e analisa — sem filtro, cada
 * talhão mostra a cor do próprio cadastro; com filtro completo, quem carrega
 * a cor é o mapa de calor por interpolação (`camadaCalor.js`). Nada disso
 * mudou com a volta da gleba: ela é desenhada por cima, como subdivisão do
 * talhão, mas não participa da coloração nem do filtro — é cadastro, não
 * amostra. Ver `ESTILO_GLEBA` em `config/mapa.js`.
 *
 * O destaque (seleção) é aplicado em efeitos próprios, alterando o estilo das
 * camadas que já existem. Reconstruir tudo a cada seleção faria o mapa
 * piscar e perderia o tooltip aberto sob o cursor. O mapa de calor mora num
 * efeito à parte, que não depende da seleção — trocar de talhão selecionado
 * não deveria recalcular um canvas que não mudou.
 *
 * `conteudoTooltip` é opcional e existe para a tela de comparação: o mapa
 * divergente pinta pelas mesmas regras de `cor` e `hachurado`, mas o que ele
 * tem a dizer sobre um talhão é outra coisa — dois valores e a variação
 * entre eles, não uma média e sua classificação.
 */
export function useGeometrias(
  mapa,
  {
    talhoes,
    glebas = [],
    selecionado,
    aoSelecionar,
    revisao = 0,
    coloracao = null,
    filtro = null,
    conteudoTooltip = null,
    mostrarCor = true,
    mostrarAmostras = false,
  },
) {
  const grupoTalhoes = useRef(null)
  const grupoContornoTalhao = useRef(null)
  const grupoGlebas = useRef(null)
  const grupoRotulosGleba = useRef(null)
  const camadaCalor = useRef(null)
  const marcadoresAmostra = useRef(null)
  const porId = useRef(new Map())
  const porIdGleba = useRef(new Map())

  // Mantém o callback fresco sem recriar as camadas a cada render do pai.
  const aoSelecionarRef = useRef(aoSelecionar)
  useEffect(() => {
    aoSelecionarRef.current = aoSelecionar
  }, [aoSelecionar])

  // Cor da gleba sem filtro: herda do talhão-pai, com uma variação de
  // luminosidade entre as glebas do mesmo talhão — é o que deixa cada uma
  // reconhecível sem precisar passar o mouse uma a uma.
  const corPorTalhao = useMemo(() => new Map(talhoes.map((t) => [t.id, t.cor])), [talhoes])

  const corPorGleba = useMemo(() => {
    const glebasPorTalhao = new Map()
    for (const gleba of glebas) {
      if (!glebasPorTalhao.has(gleba.talhao_id)) glebasPorTalhao.set(gleba.talhao_id, [])
      glebasPorTalhao.get(gleba.talhao_id).push(gleba)
    }

    const cores = new Map()
    for (const [talhaoId, lista] of glebasPorTalhao) {
      const corBase = corPorTalhao.get(talhaoId) ?? COR_GLEBA
      // Ordem estável pelo código (numérica quando dá) para a progressão
      // clara→escura não mudar de gleba a cada revisão do mapa.
      const ordenada = [...lista].sort((a, b) => {
        const na = Number(a.codigo)
        const nb = Number(b.codigo)
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
        return String(a.codigo).localeCompare(String(b.codigo))
      })
      const n = ordenada.length
      ordenada.forEach((gleba, i) => {
        const delta = n > 1 ? -0.16 + (0.32 * i) / (n - 1) : 0
        cores.set(gleba.id, variarLuminosidade(corBase, delta))
      })
    }
    return cores
  }, [glebas, corPorTalhao])

  useEffect(() => {
    if (!mapa) return

    if (!mapa.getPane(PANE_CALOR)) {
      const pane = mapa.createPane(PANE_CALOR)
      pane.style.zIndex = Z_CALOR
      pane.style.pointerEvents = 'none'
    }

    if (!mapa.getPane(PANE_GLEBA)) {
      const pane = mapa.createPane(PANE_GLEBA)
      pane.style.zIndex = Z_GLEBA
    }

    if (!mapa.getPane(PANE_CONTORNO_TALHAO)) {
      const pane = mapa.createPane(PANE_CONTORNO_TALHAO)
      pane.style.zIndex = Z_CONTORNO_TALHAO
      // O contorno é só linha: um clique nele tem que atingir o que está por
      // baixo (gleba ou talhão), não a própria linha.
      pane.style.pointerEvents = 'none'
    }

    grupoTalhoes.current = L.layerGroup().addTo(mapa)
    grupoGlebas.current = L.layerGroup().addTo(mapa)
    grupoRotulosGleba.current = L.layerGroup().addTo(mapa)
    grupoContornoTalhao.current = L.layerGroup().addTo(mapa)

    return () => {
      grupoTalhoes.current?.remove()
      grupoGlebas.current?.remove()
      grupoRotulosGleba.current?.remove()
      grupoContornoTalhao.current?.remove()
      camadaCalor.current?.remove()
      marcadoresAmostra.current?.remove()
      grupoTalhoes.current = null
      grupoGlebas.current = null
      grupoRotulosGleba.current = null
      grupoContornoTalhao.current = null
      camadaCalor.current = null
      marcadoresAmostra.current = null
      porId.current.clear()
      porIdGleba.current.clear()
    }
  }, [mapa])

  /**
   * Os rótulos fixos somem quando o mapa se afasta.
   *
   * Uma classe no container e o CSS faz o resto. A alternativa — abrir e
   * fechar dezenas de tooltips a cada zoom — faria o Leaflet destruir e
   * recriar os elementos, com a piscada correspondente.
   */
  useEffect(() => {
    if (!mapa) return
    const container = mapa.getContainer()

    function ajustar() {
      const zoom = mapa.getZoom()
      container.classList.toggle('mapa-sem-rotulos', zoom < ZOOM_MINIMO_ROTULO)
      container.classList.toggle('mapa-sem-rotulos-gleba', zoom < ZOOM_MINIMO_ROTULO_GLEBA)
    }

    ajustar()
    mapa.on('zoomend', ajustar)
    return () => {
      mapa.off('zoomend', ajustar)
      container.classList.remove('mapa-sem-rotulos', 'mapa-sem-rotulos-gleba')
    }
  }, [mapa])

  // Talhões
  useEffect(() => {
    const grupo = grupoTalhoes.current
    const grupoContorno = grupoContornoTalhao.current
    if (!mapa || !grupo || !grupoContorno) return

    grupo.clearLayers()
    grupoContorno.clearLayers()
    porId.current.clear()

    for (const talhao of talhoes) {
      const f = paraFeature(talhao.geometria)
      if (!f?.geometry) continue

      const camada = L.geoJSON(f, {
        style: { ...ESTILO_TALHAO, color: talhao.cor, fillColor: talhao.cor },
      })
      // Conteúdo inicial simples; o efeito de estilo reescreve com o valor do
      // parâmetro assim que houver filtro.
      camada.bindTooltip(rotulo(talhao), { sticky: true })
      camada.on('click', (e) => {
        // Enquanto o Geoman está desenhando, o clique é o vértice que está
        // sendo colocado, não uma seleção. Parar a propagação aqui fazia esse
        // clique nunca chegar ao mapa, que é quem o Geoman escuta: o talhão
        // engolia o clique para se selecionar, e o vértice nunca era
        // colocado. Deixar passar é o que faz o desenho da gleba funcionar.
        if (mapa.pm.globalDrawModeEnabled?.()) return
        L.DomEvent.stopPropagation(e)
        aoSelecionarRef.current?.({ tipo: 'talhao', id: talhao.id })
      })
      camada.addTo(grupo)

      // Contorno grosso, sem preenchimento, numa pane acima — é o que de
      // fato marca "aqui acaba o talhão" por cima do mapa de calor e das
      // glebas.
      const contorno = L.geoJSON(f, {
        pane: PANE_CONTORNO_TALHAO,
        style: ESTILO_CONTORNO_TALHAO,
      })
      contorno.addTo(grupoContorno)

      // Rótulo fixo, ancorado no centro de verdade da geometria (não a caixa
      // delimitadora — ver `pontoRotulo`). Não balão de hover: o produtor
      // reconhece a fazenda dele pela disposição dos talhões, e ter que
      // procurar cada nome com o cursor desfaz esse reconhecimento.
      const ponto = pontoRotulo(f)
      if (ponto) {
        L.circleMarker(ponto, { pane: PANE_CONTORNO_TALHAO, opacity: 0, fillOpacity: 0, interactive: false, radius: 1 })
          .bindTooltip(conteudoRotuloTalhao(talhao), {
            permanent: true,
            direction: 'center',
            className: 'rotulo-talhao',
            // O Leaflet aplica 0.9 por padrão, e isso lava o branco do texto. A
            // legibilidade aqui vem do contorno no CSS, não da opacidade.
            opacity: 1,
          })
          .addTo(grupoContorno)
      }

      porId.current.set(talhao.id, { camada, contorno, cor: talhao.cor, talhao })
    }

    // `revisao` força o redesenho a partir dos dados salvos. É como uma edição
    // de vértices cancelada volta ao lugar: os dados não mudaram, então só a
    // mudança de revisão reconstrói a camada.
  }, [mapa, talhoes, revisao])

  // Glebas — subdivisão do talhão. Camada própria, redesenhada independente
  // do talhão: criar uma gleba não deveria reconstruir o polígono do talhão
  // inteiro, e vice-versa.
  useEffect(() => {
    const grupo = grupoGlebas.current
    const grupoRotulos = grupoRotulosGleba.current
    if (!mapa || !grupo || !grupoRotulos) return

    grupo.clearLayers()
    grupoRotulos.clearLayers()
    porIdGleba.current.clear()

    for (const gleba of glebas) {
      const f = paraFeature(gleba.geometria)
      if (!f?.geometry) continue

      const corHerdada = corPorGleba.get(gleba.id) ?? COR_GLEBA
      const ponto = ehPonto(f)

      const camada = L.geoJSON(f, {
        pane: PANE_GLEBA,
        style: { ...ESTILO_GLEBA, fillColor: corHerdada },
        // Ponto vira circleMarker, não marker: é SVG, dispensa arquivo de
        // ícone (que quebra com bundler) e aceita as mesmas opções de estilo.
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            pane: PANE_GLEBA,
            ...ESTILO_GLEBA,
            fillColor: corHerdada,
            radius: RAIO_PONTO_GLEBA,
          }),
      })
      camada.bindTooltip(conteudoTooltipGleba(gleba, null), { sticky: true })
      camada.on('click', (e) => {
        // Mesmo motivo do talhão: uma gleba nova pode ser desenhada perto ou
        // sobre uma já existente, e o clique de desenho não pode ser
        // engolido pela seleção da que já está lá.
        if (mapa.pm.globalDrawModeEnabled?.()) return
        L.DomEvent.stopPropagation(e)
        aoSelecionarRef.current?.({ tipo: 'gleba', id: gleba.id })
      })
      camada.addTo(grupo)

      porIdGleba.current.set(gleba.id, { camada, cor: corHerdada, ponto, gleba })

      // Marcador só do rótulo: invisível e sem eventos, existe unicamente
      // para ancorar o tooltip permanente num ponto certo — ver `pontoRotulo`.
      const pontoRot = pontoRotulo(f)
      if (pontoRot) {
        L.circleMarker(pontoRot, {
          pane: PANE_CONTORNO_TALHAO,
          opacity: 0,
          fillOpacity: 0,
          interactive: false,
          radius: 1,
        })
          .bindTooltip(conteudoRotuloGleba(gleba), {
            permanent: true,
            direction: 'center',
            className: 'rotulo-gleba',
            opacity: 1,
          })
          .addTo(grupoRotulos)
      }
    }
  }, [mapa, glebas, revisao, corPorGleba])

  /**
   * Destaque e coloração do talhão no mesmo efeito.
   *
   * Os dois escrevem `fillColor` na mesma camada; separados, o último a rodar
   * apagaria o outro. Foi exatamente o que aconteceu no primeiro teste da
   * hachura — o destaque repintava o talhão logo depois.
   */
  useEffect(() => {
    if (!mapa) return
    const idAtivo = selecionado?.tipo === 'talhao' ? selecionado.id : null

    // O SVG só existe depois da primeira camada vetorial entrar no mapa, por
    // isso a injeção do pattern acontece aqui e não na criação do mapa.
    if (coloracao) garantirHachura(mapa)

    for (const [id, registro] of porId.current) {
      const ativo = id === idAtivo
      const base = ativo ? ESTILO_TALHAO_DESTACADO : ESTILO_TALHAO
      const info = coloracao ? coloracao(id) : null

      let estilo
      if (!info) {
        // Sem filtro: a cor é a do cadastro, moldura de identidade, não dado.
        estilo = { ...base, color: registro.cor, fillColor: registro.cor, dashArray: null }
      } else if (info.hachurado) {
        // Polígono: hachura com opacidade cheia. Translúcida sobre o satélite,
        // as listras somem e viram um borrão cinza.
        estilo = { ...base, color: registro.cor, fillColor: PREENCHIMENTO_HACHURA, fillOpacity: 1, dashArray: null }
      } else {
        // Tem dado: o preenchimento do próprio talhão praticamente some —
        // quem carrega a cor é o mapa de calor por interpolação, desenhado
        // por cima em efeito à parte, cobrindo o talhão inteiro (não só
        // perto de cada ponto). Não é zero: o renderizador SVG do Leaflet só
        // captura clique dentro de um preenchimento com opacidade acima de
        // zero — `fillOpacity: 0` deixaria o meio do talhão inclicável,
        // funcionando só na borda.
        estilo = { ...base, color: registro.cor, fillColor: info.cor, fillOpacity: 0.02, dashArray: null }
      }

      // Mesmo motivo do 0.02 acima: zero de verdade tiraria o clique do
      // meio do talhão, não só a cor.
      if (!mostrarCor) estilo.fillOpacity = 0.02

      registro.camada.setStyle(estilo)
      registro.camada.setTooltipContent(
        conteudoTooltip
          ? conteudoTooltip(registro.talhao, info)
          : conteudoTooltipTalhao(registro.talhao, info, filtro?.chaveParametro),
      )

      registro.contorno?.setStyle(ativo ? ESTILO_CONTORNO_TALHAO_DESTACADO : ESTILO_CONTORNO_TALHAO)
      if (ativo) {
        registro.contorno?.bringToFront()
        registro.camada.bringToFront()
      }
    }
  }, [mapa, selecionado, talhoes, revisao, coloracao, filtro, conteudoTooltip, mostrarCor])

  /**
   * Destaque da gleba — efeito próprio e mais simples que o do talhão: gleba
   * não participa de coloração nem de hachura, só existe versão normal e
   * selecionada.
   */
  useEffect(() => {
    if (!mapa) return
    const idAtivo = selecionado?.tipo === 'gleba' ? selecionado.id : null

    for (const [id, registro] of porIdGleba.current) {
      const ativo = id === idAtivo
      const estilo = ativo
        ? { ...ESTILO_GLEBA_DESTACADA, fillColor: registro.cor }
        : { ...ESTILO_GLEBA, fillColor: registro.cor }
      if (registro.ponto) estilo.radius = ativo ? RAIO_PONTO_GLEBA + 3 : RAIO_PONTO_GLEBA

      registro.camada.setStyle(estilo)
      if (ativo) registro.camada.bringToFront()
    }
  }, [mapa, selecionado, glebas, revisao])

  /**
   * Mapa de calor: uma superfície contínua por interpolação (IDW), cobrindo
   * cada talhão colorido inteiro — não um borrão em volta de cada ponto.
   *
   * À parte do efeito de destaque de propósito — reconstruir o raster a cada
   * troca de talhão selecionado seria trabalho para um resultado que não
   * mudou. Refeito do zero a cada troca real de dado.
   */
  useEffect(() => {
    if (!mapa) return

    camadaCalor.current?.remove()
    camadaCalor.current = null
    marcadoresAmostra.current?.remove()
    marcadoresAmostra.current = null

    if (!mostrarCor || !coloracao) return

    const talhoesComDado = []
    for (const talhao of talhoes) {
      const info = coloracao(talhao.id)
      // `info.pontos` só existe na coloração por classificação (Fase 4). A
      // coloração de variação (tela de comparação) usa a mesma `coloracao`
      // genérica mas não tem pontos por amostra — nesse caso não há raster
      // nem marcador nenhum, e o preenchimento do talhão já basta.
      if (!info || info.hachurado || !info.pontos?.length) continue
      const geometry = paraFeature(talhao.geometria)?.geometry
      if (!geometry) continue
      talhoesComDado.push({
        geometry,
        pontos: info.pontos
          .map((p) => ({ lat: p.lat, lng: p.lng, valor: posicaoDoNivel(p.nivel) }))
          .filter((p) => p.lat != null && p.lng != null && p.valor != null),
      })
    }

    const raster = criarCamadaCalor(talhoesComDado)
    if (raster) {
      camadaCalor.current = raster.addTo(mapa)
      if (mostrarAmostras) marcadoresAmostra.current = criarMarcadoresDeAmostra(talhoesComDado).addTo(mapa)
    }

    return () => {
      camadaCalor.current?.remove()
      camadaCalor.current = null
      marcadoresAmostra.current?.remove()
      marcadoresAmostra.current = null
    }
  }, [mapa, talhoes, coloracao, mostrarCor, mostrarAmostras])

  // Dá acesso à camada Leaflet de um item, para o Geoman editar aquela
  // geometria em vez de ligar o modo de edição global do mapa.
  const obterCamada = useCallback(
    (tipo, id) =>
      tipo === 'talhao'
        ? (porId.current.get(id)?.camada ?? null)
        : tipo === 'gleba'
          ? (porIdGleba.current.get(id)?.camada ?? null)
          : null,
    [],
  )

  return { obterCamada }
}
