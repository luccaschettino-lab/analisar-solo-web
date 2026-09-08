import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.heat'
import { paraFeature, pontoRotulo } from '../lib/geo.js'
import { garantirHachura, PREENCHIMENTO_HACHURA } from './hachura.js'
import { conteudoTooltipTalhao } from './tooltipTalhao.js'
import { conteudoRotuloTalhao } from './rotuloTalhao.js'
import { posicaoDoNivel, gradienteDeNiveis } from '../lib/coloracao.js'
import {
  ZOOM_MINIMO_ROTULO,
  ESTILO_TALHAO,
  ESTILO_TALHAO_DESTACADO,
  ESTILO_CONTORNO_TALHAO,
  ESTILO_CONTORNO_TALHAO_DESTACADO,
} from '../config/mapa.js'

// Pane próprio para o contorno do talhão: acima do overlayPane (400), onde
// vive o polígono do talhão e o mapa de calor, mas abaixo do markerPane (600)
// e do tooltipPane (650). Sem isso, a ordem em que cada camada é adicionada
// ao mapa decidiria a sobreposição — frágil a cada re-render.
const PANE_CONTORNO_TALHAO = 'contornoTalhao'
const Z_CONTORNO_TALHAO = 450

function rotulo(talhao) {
  return talhao.nome ? `${talhao.codigo} — ${talhao.nome}` : talhao.codigo
}

/**
 * Desenha os talhões sobre o mapa.
 *
 * Gleba saiu de cena: o talhão é a unidade que se seleciona, colore e
 * analisa agora. Sem filtro, cada talhão mostra a cor do próprio cadastro.
 * Com filtro completo, a área ganha um tom de fundo fraco na cor média das
 * amostras (para não sumir onde não há ponto perto) e um mapa de calor por
 * cima — um gradiente entre os pontos de coleta reais do talhão, não uma
 * cor sólida — desenhado numa camada só para o mapa inteiro.
 *
 * O destaque (seleção) é aplicado num efeito próprio, alterando o estilo das
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
    selecionado,
    aoSelecionar,
    revisao = 0,
    coloracao = null,
    filtro = null,
    conteudoTooltip = null,
    mostrarCor = true,
  },
) {
  const grupoTalhoes = useRef(null)
  const grupoContornoTalhao = useRef(null)
  const camadaCalor = useRef(null)
  const porId = useRef(new Map())

  // Mantém o callback fresco sem recriar as camadas a cada render do pai.
  const aoSelecionarRef = useRef(aoSelecionar)
  useEffect(() => {
    aoSelecionarRef.current = aoSelecionar
  }, [aoSelecionar])

  useEffect(() => {
    if (!mapa) return

    if (!mapa.getPane(PANE_CONTORNO_TALHAO)) {
      const pane = mapa.createPane(PANE_CONTORNO_TALHAO)
      pane.style.zIndex = Z_CONTORNO_TALHAO
      // O contorno é só linha: um clique nele tem que atingir o talhão por
      // baixo, não a própria linha.
      pane.style.pointerEvents = 'none'
    }

    grupoTalhoes.current = L.layerGroup().addTo(mapa)
    grupoContornoTalhao.current = L.layerGroup().addTo(mapa)

    return () => {
      grupoTalhoes.current?.remove()
      grupoContornoTalhao.current?.remove()
      camadaCalor.current?.remove()
      grupoTalhoes.current = null
      grupoContornoTalhao.current = null
      camadaCalor.current = null
      porId.current.clear()
    }
  }, [mapa])

  /**
   * O rótulo fixo some quando o mapa se afasta.
   *
   * Uma classe no container e o CSS faz o resto. A alternativa — abrir e
   * fechar dezenas de tooltips a cada zoom — faria o Leaflet destruir e
   * recriar os elementos, com a piscada correspondente.
   */
  useEffect(() => {
    if (!mapa) return
    const container = mapa.getContainer()

    function ajustar() {
      container.classList.toggle('mapa-sem-rotulos', mapa.getZoom() < ZOOM_MINIMO_ROTULO)
    }

    ajustar()
    mapa.on('zoomend', ajustar)
    return () => {
      mapa.off('zoomend', ajustar)
      container.classList.remove('mapa-sem-rotulos')
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
      // fato marca "aqui acaba o talhão" por cima do mapa de calor.
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

  /**
   * Destaque e coloração no mesmo efeito.
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
        // Tem dado: o preenchimento vira só um tom de fundo fraco, na cor
        // média — quem carrega a informação de verdade é o mapa de calor,
        // desenhado por cima em efeito à parte. Sem o tom de fundo, a área
        // longe de qualquer ponto de coleta ficaria com a foto de satélite
        // crua, como se o talhão não tivesse cor nenhuma ali.
        estilo = {
          ...base,
          color: registro.cor,
          fillColor: info.cor,
          fillOpacity: base.fillOpacity * 0.55,
          dashArray: null,
        }
      }

      if (!mostrarCor) estilo.fillOpacity = 0

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
   * Mapa de calor: uma camada só, para o mapa inteiro, com todos os pontos de
   * amostra de todos os talhões coloridos no filtro atual.
   *
   * À parte do efeito de destaque de propósito — reconstruir o canvas inteiro
   * a cada troca de talhão selecionado seria trabalho para um resultado que
   * não mudou. Refeita do zero a cada troca real de dado, porque
   * `leaflet.heat` não tem um jeito barato de só atualizar pontos.
   */
  useEffect(() => {
    if (!mapa) return

    camadaCalor.current?.remove()
    camadaCalor.current = null

    if (!mostrarCor || !coloracao) return

    const pontos = []
    for (const talhao of talhoes) {
      const info = coloracao(talhao.id)
      // `info.pontos` só existe na coloração por classificação (Fase 4). A
      // coloração de variação (tela de comparação) usa a mesma `coloracao`
      // genérica mas não tem pontos por amostra — nesse caso o mapa de calor
      // simplesmente não desenha nada, e o preenchimento do talhão já basta.
      if (!info || info.hachurado || !info.pontos) continue
      for (const ponto of info.pontos) {
        const posicao = posicaoDoNivel(ponto.nivel)
        if (posicao == null || ponto.lat == null || ponto.lng == null) continue
        // Mínimo de 0.05, não zero: um ponto "muito baixo" (posição 0) tem
        // que aparecer no mapa de calor — intensidade zero é o mesmo que
        // não desenhar nada, e "muito baixo" é justamente o que mais importa
        // mostrar.
        pontos.push([ponto.lat, ponto.lng, Math.max(0.05, posicao)])
      }
    }

    if (pontos.length === 0) return

    camadaCalor.current = L.heatLayer(pontos, {
      radius: 45,
      blur: 35,
      max: 1,
      minOpacity: 0.35,
      gradient: gradienteDeNiveis(),
    }).addTo(mapa)

    return () => {
      camadaCalor.current?.remove()
      camadaCalor.current = null
    }
  }, [mapa, talhoes, coloracao, mostrarCor])

  // Dá acesso à camada Leaflet do talhão, para o Geoman editar aquela
  // geometria em vez de ligar o modo de edição global do mapa.
  const obterCamada = useCallback(
    (tipo, id) => (tipo === 'talhao' ? (porId.current.get(id)?.camada ?? null) : null),
    [],
  )

  return { obterCamada }
}
