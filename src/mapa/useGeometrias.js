import { useCallback, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { paraFeature, ehPonto, pontoRotulo } from '../lib/geo.js'
import { variarLuminosidade } from '../lib/cor.js'
import { garantirHachura, PREENCHIMENTO_HACHURA } from './hachura.js'
import { conteudoTooltipGleba } from './tooltipGleba.js'
import { conteudoRotuloTalhao, conteudoRotuloGleba } from './rotuloTalhao.js'
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
  ESTILO_PONTO_SEM_DADO,
} from '../config/mapa.js'

// Pane próprio para o contorno do talhão: acima do overlayPane (400), onde
// vivem os polígonos de talhão e gleba, mas abaixo do markerPane (600) e do
// tooltipPane (650). Sem isso, a ordem em que cada camada é adicionada ao
// mapa decidiria a sobreposição — frágil a cada re-render.
const PANE_CONTORNO_TALHAO = 'contornoTalhao'
const Z_CONTORNO_TALHAO = 450

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
    mostrarCor = true,
  },
) {
  const grupoTalhoes = useRef(null)
  const grupoGlebas = useRef(null)
  const grupoContornoTalhao = useRef(null)
  const porChave = useRef(new Map())

  // Cor da gleba sem filtro: herda do talhão-pai, não um âmbar único — é o
  // que deixa cada talhão reconhecível na visão geral da fazenda, agora que a
  // gleba cobre o talhão inteiro em vez de aparecer só como ponto.
  const corPorTalhao = useMemo(() => new Map(talhoes.map((t) => [t.id, t.cor])), [talhoes])

  /**
   * Dentro do mesmo talhão, cada gleba recebe uma variação de luminosidade
   * da cor herdada — mais clara ou mais escura, nunca outro matiz. Um talhão
   * com quatro glebas amarelas continua "amarelo": a primeira sai mais clara,
   * a última mais escura, e as do meio numa progressão entre as duas. Sem
   * isso, glebas vizinhas do mesmo talhão eram indistinguíveis sem passar o
   * mouse uma a uma.
   */
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
      // O contorno é só linha: um clique nele tem que atingir o que está por
      // baixo (gleba ou talhão), não a própria linha.
      pane.style.pointerEvents = 'none'
    }

    grupoTalhoes.current = L.layerGroup().addTo(mapa)
    grupoGlebas.current = L.layerGroup().addTo(mapa)
    grupoContornoTalhao.current = L.layerGroup().addTo(mapa)

    return () => {
      grupoTalhoes.current?.remove()
      grupoGlebas.current?.remove()
      grupoContornoTalhao.current?.remove()
      grupoTalhoes.current = null
      grupoGlebas.current = null
      grupoContornoTalhao.current = null
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
    for (const [chave] of porChave.current) {
      if (chave.startsWith('talhao:')) porChave.current.delete(chave)
    }

    for (const talhao of talhoes) {
      const f = paraFeature(talhao.geometria)
      if (!f?.geometry) continue

      const camada = L.geoJSON(f, {
        style: { ...ESTILO_TALHAO, color: talhao.cor, fillColor: talhao.cor },
      })
      camada.on('click', (e) => {
        // Enquanto o Geoman está desenhando, o clique é o vértice que está
        // sendo colocado, não uma seleção — e é sempre sobre um talhão,
        // porque é dentro dele que toda gleba existe. Parar a propagação
        // aqui fazia esse clique nunca chegar ao mapa, que é quem o Geoman
        // escuta: o talhão engolia o clique para se selecionar, e o vértice
        // nunca era colocado. Deixar passar é o que faz o desenho funcionar.
        if (mapa.pm.globalDrawModeEnabled?.()) return
        L.DomEvent.stopPropagation(e)
        aoSelecionarRef.current?.({ tipo: 'talhao', id: talhao.id })
      })
      camada.addTo(grupo)

      // Contorno grosso, sem preenchimento, na pane acima das glebas — é o
      // que de fato se vê como "aqui acaba o talhão", já que a área em si
      // fica coberta pelo mosaico das glebas.
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

      porChave.current.set(`talhao:${talhao.id}`, { camada, contorno, cor: talhao.cor })
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

      const corHerdada = corPorGleba.get(gleba.id) ?? COR_GLEBA

      const camada = L.geoJSON(f, {
        style: { ...ESTILO_GLEBA, fillColor: corHerdada },
        // Ponto vira circleMarker, não marker: é SVG, dispensa arquivo de
        // ícone (que quebra com bundler) e aceita as mesmas opções de estilo.
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            ...ESTILO_GLEBA,
            fillColor: corHerdada,
            radius: RAIO_PONTO_GLEBA,
          }),
      })
      // Conteúdo inicial simples; o efeito de estilo reescreve com o valor do
      // parâmetro assim que houver filtro.
      camada.bindTooltip(rotulo(gleba), { sticky: true })
      camada.on('click', (e) => {
        // Mesmo motivo do talhão: uma gleba nova pode ser desenhada perto ou
        // sobre uma já existente, e o clique de desenho não pode ser
        // engolido pela seleção da que já está lá.
        if (mapa.pm.globalDrawModeEnabled?.()) return
        L.DomEvent.stopPropagation(e)
        aoSelecionarRef.current?.({ tipo: 'gleba', id: gleba.id })
      })

      camada.addTo(grupo)
      // Guarda a gleba junto: o tooltip precisa do código e do nome a cada
      // troca de filtro, e reconsultar a lista por id a cada render seria
      // varredura desnecessária.
      porChave.current.set(`gleba:${gleba.id}`, { camada, ponto: ehPonto(f), gleba })

      // Marcador só do rótulo: invisível e sem eventos, existe unicamente
      // para ancorar o tooltip permanente num ponto certo — ver `pontoRotulo`.
      // A camada visível já tem o tooltip de hover (sticky) com o detalhe do
      // filtro, e o Leaflet só aceita um tooltip por camada — daria pra
      // trocar um pelo outro, não somar os dois.
      const ponto = pontoRotulo(f)
      if (ponto) {
        L.circleMarker(ponto, { opacity: 0, fillOpacity: 0, interactive: false, radius: 1 })
          .bindTooltip(conteudoRotuloGleba(gleba), {
            permanent: true,
            direction: 'center',
            className: 'rotulo-gleba',
            opacity: 1,
          })
          .addTo(grupo)
      }
    }
  }, [mapa, glebas, revisao, corPorGleba])

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
        // `mostrarCor` só zera o preenchimento — o contorno (linha) e o
        // rótulo (nome) continuam de qualquer jeito, em efeitos próprios que
        // isto nem toca. "Ver mapa puro" tira a cor, não a grade.
        registro.camada.setStyle({
          ...(ativo ? ESTILO_TALHAO_DESTACADO : ESTILO_TALHAO),
          color: registro.cor,
          fillColor: registro.cor,
          fillOpacity: mostrarCor ? (ativo ? ESTILO_TALHAO_DESTACADO.fillOpacity : ESTILO_TALHAO.fillOpacity) : 0,
        })
        // O contorno por cima das glebas segue o mesmo destaque — é ele que
        // de fato aparece, já que a área do talhão está coberta.
        registro.contorno?.setStyle(ativo ? ESTILO_CONTORNO_TALHAO_DESTACADO : ESTILO_CONTORNO_TALHAO)
        if (ativo) registro.contorno?.bringToFront()
        continue
      }

      const info = coloracao ? coloracao(registro.gleba.id) : null
      const base = ativo ? ESTILO_GLEBA_DESTACADA : ESTILO_GLEBA
      const semDado = Boolean(info?.hachurado)

      let estilo
      if (!semDado) {
        // `dashArray: null` explícito: setStyle mescla com o estilo anterior,
        // então um tracejado deixado por um filtro anterior sobreviveria. Sem
        // filtro, a cor vem do talhão-pai com a variação por gleba — ver
        // `corPorGleba` acima.
        const corSemFiltro = corPorGleba.get(registro.gleba.id) ?? COR_GLEBA
        estilo = { ...base, fillColor: info ? info.cor : corSemFiltro, dashArray: null }
      } else if (registro.ponto) {
        // Ponto vazado e tracejado — a hachura não se lê num círculo de 14 px.
        estilo = { ...base, ...ESTILO_PONTO_SEM_DADO, weight: ativo ? 4 : ESTILO_PONTO_SEM_DADO.weight }
      } else {
        // Polígono: hachura com opacidade cheia. Translúcida sobre o satélite,
        // as listras somem e viram um borrão cinza.
        estilo = { ...base, fillColor: PREENCHIMENTO_HACHURA, fillOpacity: 1, dashArray: null }
      }

      if (registro.ponto) estilo.radius = ativo ? RAIO_PONTO_GLEBA + 3 : RAIO_PONTO_GLEBA

      // Mesma regra do talhão: sem cor é só o preenchimento que some. A
      // borda (branca) e o rótulo (código) continuam — são a "grade", não
      // o dado, e "ver mapa puro" não deveria apagar os dois de propósito.
      if (!mostrarCor) estilo.fillOpacity = 0

      registro.camada.setStyle(estilo)

      registro.camada.setTooltipContent(
        conteudoTooltip
          ? conteudoTooltip(registro.gleba, info)
          : conteudoTooltipGleba(registro.gleba, info, filtro?.chaveParametro),
      )

      if (ativo) registro.camada.bringToFront()
    }
  }, [mapa, selecionado, talhoes, glebas, revisao, coloracao, filtro, conteudoTooltip, corPorGleba, mostrarCor])

  // Dá acesso à camada Leaflet de um item, para o Geoman editar aquela
  // geometria em vez de ligar o modo de edição global do mapa.
  const obterCamada = useCallback((tipo, id) => porChave.current.get(`${tipo}:${id}`)?.camada ?? null, [])

  return { obterCamada }
}
