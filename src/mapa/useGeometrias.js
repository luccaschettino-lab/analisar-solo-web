import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import { paraFeature, ehPonto } from '../lib/geo.js'
import { garantirHachura, PREENCHIMENTO_HACHURA } from './hachura.js'
import { conteudoTooltipGleba } from './tooltipGleba.js'
import { conteudoRotuloTalhao } from './rotuloTalhao.js'
import {
  ZOOM_MINIMO_ROTULO,
  ESTILO_TALHAO,
  ESTILO_TALHAO_DESTACADO,
  ESTILO_GLEBA,
  ESTILO_GLEBA_DESTACADA,
  COR_GLEBA,
  RAIO_PONTO_GLEBA,
  ESTILO_PONTO_SEM_DADO,
} from '../config/mapa.js'

function rotulo(item) {
  return item.nome ? `${item.codigo} — ${item.nome}` : item.codigo
}

/**
 * Desenha talhões e glebas sobre o mapa.
 *
 * Duas camadas separadas e nesta ordem: talhões embaixo, glebas em cima.
 * Sem isso o polígono translúcido do talhão cobriria os pontos de coleta,
 * que são justamente o que o usuário precisa clicar.
 *
 * O destaque é aplicado num efeito próprio, alterando o estilo das camadas
 * que já existem. Reconstruir tudo a cada seleção faria o mapa piscar e
 * perderia o tooltip aberto sob o cursor.
 *
 * `conteudoTooltip` é opcional e existe para a tela de comparação: o mapa
 * divergente pinta pelas mesmas regras de `cor` e `hachurado`, mas o que ele
 * tem a dizer sobre uma gleba é outra coisa — dois valores e a variação entre
 * eles, não um valor e sua classificação. Sem ele, vale o tooltip da Fase 4.
 */
export function useGeometrias(
  mapa,
  {
    talhoes,
    glebas,
    selecionado,
    aoSelecionar,
    revisao = 0,
    coloracao = null,
    filtro = null,
    conteudoTooltip = null,
  },
) {
  const grupoTalhoes = useRef(null)
  const grupoGlebas = useRef(null)
  const porChave = useRef(new Map())

  // Mantém o callback fresco sem recriar as camadas a cada render do pai.
  const aoSelecionarRef = useRef(aoSelecionar)
  useEffect(() => {
    aoSelecionarRef.current = aoSelecionar
  }, [aoSelecionar])

  useEffect(() => {
    if (!mapa) return

    grupoTalhoes.current = L.layerGroup().addTo(mapa)
    grupoGlebas.current = L.layerGroup().addTo(mapa)

    return () => {
      grupoTalhoes.current?.remove()
      grupoGlebas.current?.remove()
      grupoTalhoes.current = null
      grupoGlebas.current = null
      porChave.current.clear()
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
    if (!mapa || !grupo) return

    grupo.clearLayers()
    for (const [chave] of porChave.current) {
      if (chave.startsWith('talhao:')) porChave.current.delete(chave)
    }

    for (const talhao of talhoes) {
      const f = paraFeature(talhao.geometria)
      if (!f?.geometry) continue

      const camada = L.geoJSON(f, {
        style: { ...ESTILO_TALHAO, color: talhao.cor, fillColor: talhao.cor },
      })
      // Rótulo fixo, centrado na geometria — não balão de hover. O produtor
      // reconhece a fazenda dele pela disposição dos talhões, e ter que
      // procurar cada nome com o cursor desfaz esse reconhecimento.
      camada.bindTooltip(conteudoRotuloTalhao(talhao), {
        permanent: true,
        direction: 'center',
        className: 'rotulo-talhao',
        // O Leaflet aplica 0.9 por padrão, e isso lava o branco do texto. A
        // legibilidade aqui vem do contorno no CSS, não da opacidade.
        opacity: 1,
      })
      camada.on('click', (e) => {
        // Sem isto o clique atravessa para o mapa e o modo de marcar centro
        // ou de desenho receberia um clique que era para a geometria.
        L.DomEvent.stopPropagation(e)
        aoSelecionarRef.current?.({ tipo: 'talhao', id: talhao.id })
      })

      camada.addTo(grupo)
      porChave.current.set(`talhao:${talhao.id}`, { camada, cor: talhao.cor })
    }

    // `revisao` força o redesenho a partir dos dados salvos. É como uma edição
    // de vértices cancelada volta ao lugar: os dados não mudaram, então só a
    // mudança de revisão reconstrói a camada.
  }, [mapa, talhoes, revisao])

  // Glebas
  useEffect(() => {
    const grupo = grupoGlebas.current
    if (!mapa || !grupo) return

    grupo.clearLayers()
    for (const [chave] of porChave.current) {
      if (chave.startsWith('gleba:')) porChave.current.delete(chave)
    }

    for (const gleba of glebas) {
      const f = paraFeature(gleba.geometria)
      if (!f?.geometry) continue

      const camada = L.geoJSON(f, {
        style: { ...ESTILO_GLEBA, fillColor: COR_GLEBA },
        // Ponto vira circleMarker, não marker: é SVG, dispensa arquivo de
        // ícone (que quebra com bundler) e aceita as mesmas opções de estilo.
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            ...ESTILO_GLEBA,
            fillColor: COR_GLEBA,
            radius: RAIO_PONTO_GLEBA,
          }),
      })
      // Conteúdo inicial simples; o efeito de estilo reescreve com o valor do
      // parâmetro assim que houver filtro.
      camada.bindTooltip(rotulo(gleba), { sticky: true })
      camada.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        aoSelecionarRef.current?.({ tipo: 'gleba', id: gleba.id })
      })

      camada.addTo(grupo)
      // Guarda a gleba junto: o tooltip precisa do código e do nome a cada
      // troca de filtro, e reconsultar a lista por id a cada render seria
      // varredura desnecessária.
      porChave.current.set(`gleba:${gleba.id}`, { camada, ponto: ehPonto(f), gleba })
    }
  }, [mapa, glebas, revisao])

  /**
   * Destaque e coloração no mesmo efeito.
   *
   * Os dois escrevem `fillColor` na mesma camada; separados, o último a rodar
   * apagaria o outro. Foi exatamente o que aconteceu no primeiro teste da
   * hachura — o destaque repintava o talhão logo depois.
   */
  useEffect(() => {
    if (!mapa) return
    const chaveAtiva = selecionado ? `${selecionado.tipo}:${selecionado.id}` : null

    // O SVG só existe depois da primeira camada vetorial entrar no mapa, por
    // isso a injeção do pattern acontece aqui e não na criação do mapa.
    if (coloracao) garantirHachura(mapa)

    for (const [chave, registro] of porChave.current) {
      const ativo = chave === chaveAtiva

      if (chave.startsWith('talhao:')) {
        // Talhão mantém a cor do cadastro: ele é a moldura, não o dado.
        registro.camada.setStyle({
          ...(ativo ? ESTILO_TALHAO_DESTACADO : ESTILO_TALHAO),
          color: registro.cor,
          fillColor: registro.cor,
        })
        continue
      }

      const info = coloracao ? coloracao(registro.gleba.id) : null
      const base = ativo ? ESTILO_GLEBA_DESTACADA : ESTILO_GLEBA
      const semDado = Boolean(info?.hachurado)

      let estilo
      if (!semDado) {
        // `dashArray: null` explícito: setStyle mescla com o estilo anterior,
        // então um tracejado deixado por um filtro anterior sobreviveria.
        estilo = { ...base, fillColor: info ? info.cor : COR_GLEBA, dashArray: null }
      } else if (registro.ponto) {
        // Ponto vazado e tracejado — a hachura não se lê num círculo de 14 px.
        estilo = { ...base, ...ESTILO_PONTO_SEM_DADO, weight: ativo ? 4 : ESTILO_PONTO_SEM_DADO.weight }
      } else {
        // Polígono: hachura com opacidade cheia. Translúcida sobre o satélite,
        // as listras somem e viram um borrão cinza.
        estilo = { ...base, fillColor: PREENCHIMENTO_HACHURA, fillOpacity: 1, dashArray: null }
      }

      if (registro.ponto) estilo.radius = ativo ? RAIO_PONTO_GLEBA + 3 : RAIO_PONTO_GLEBA

      registro.camada.setStyle(estilo)

      registro.camada.setTooltipContent(
        conteudoTooltip
          ? conteudoTooltip(registro.gleba, info)
          : conteudoTooltipGleba(registro.gleba, info, filtro?.chaveParametro),
      )

      if (ativo) registro.camada.bringToFront()
    }
  }, [mapa, selecionado, talhoes, glebas, revisao, coloracao, filtro, conteudoTooltip])

  // Dá acesso à camada Leaflet de um item, para o Geoman editar aquela
  // geometria em vez de ligar o modo de edição global do mapa.
  const obterCamada = useCallback((tipo, id) => porChave.current.get(`${tipo}:${id}`)?.camada ?? null, [])

  return { obterCamada }
}
