import { useCallback, useEffect, useState } from 'react'
import { useGeometrias } from '../../mapa/useGeometrias.js'
import { focarGeometria } from '../../mapa/enquadrar.js'
import { primeiraFeature, areaEmHectares } from '../../lib/geo.js'
import { atualizarTalhao, excluirTalhao, resumoCascataTalhao } from '../../dados/talhoes.js'
import { atualizarGleba, excluirGleba, contarAnalisesDaGleba } from '../../dados/glebas.js'

/**
 * O talhão ou gleba selecionado, e tudo que se faz com ele: focar, editar
 * dados, editar vértices e excluir.
 *
 * Compõe `useGeometrias` em vez de recebê-lo pronto porque a dependência é
 * circular: o desenho das camadas precisa de `selecionado` e `revisao`, que
 * moram aqui, e a edição de vértices precisa do `obterCamada`, que sai de lá.
 */
export function useItemSelecionado({
  mapa,
  idFazenda,
  talhoes,
  glebas,
  editor,
  aplicarTalhao,
  aplicarGleba,
  removerTalhao,
  removerGleba,
  mostrarAviso,
  coloracao = null,
  filtro = null,
  // Vêm do FazendaContext: a barra lateral também seleciona, e dois estados
  // separados fariam clicar na árvore não destacar a geometria.
  selecionado,
  setSelecionado,
}) {
  // Chave "tipo:id" da geometria em edição. Guardar a chave, e não um booleano,
  // deixa detectar sozinho quando a seleção muda no meio da edição.
  const [editandoChave, setEditandoChave] = useState(null)
  const [gravandoGeometria, setGravandoGeometria] = useState(false)
  const [editandoDados, setEditandoDados] = useState(null) // null | 'talhao' | 'gleba'
  const [confirmandoItem, setConfirmandoItem] = useState(null)
  const [carregandoExclusao, setCarregandoExclusao] = useState(false)
  // Incrementado para redesenhar as camadas a partir dos dados salvos.
  const [revisao, setRevisao] = useState(0)

  const aoSelecionar = useCallback((alvo) => setSelecionado(alvo), [setSelecionado])
  const { obterCamada } = useGeometrias(mapa, {
    talhoes,
    glebas,
    selecionado,
    aoSelecionar,
    revisao,
    coloracao,
    filtro,
  })

  const chaveSelecionada = selecionado ? `${selecionado.tipo}:${selecionado.id}` : null
  const itemSelecionado = selecionado
    ? selecionado.tipo === 'talhao'
      ? (talhoes.find((t) => t.id === selecionado.id) ?? null)
      : (glebas.find((g) => g.id === selecionado.id) ?? null)
    : null
  const talhaoPai =
    selecionado?.tipo === 'gleba' && itemSelecionado
      ? (talhoes.find((t) => t.id === itemSelecionado.talhao_id) ?? null)
      : null
  const editandoGeometria = Boolean(editandoChave) && editandoChave === chaveSelecionada

  const limparSelecao = useCallback(() => setSelecionado(null), [setSelecionado])

  // Trocar de fazenda zera a seleção: o item de antes não existe mais na tela.
  useEffect(() => {
    setSelecionado(null)
  }, [idFazenda, setSelecionado])

  const desligarEdicao = useCallback(
    (chave) => {
      if (!chave) return
      const [tipo, id] = chave.split(':')
      obterCamada(tipo, id)?.eachLayer((filha) => filha.pm?.disable())
    },
    [obterCamada],
  )

  // Trocar de item no meio de uma edição descarta o que estava sendo arrastado.
  // Sem isto a camada ficaria editável e fora de sincronia com o banco.
  useEffect(() => {
    if (!editandoChave || editandoChave === chaveSelecionada) return
    desligarEdicao(editandoChave)
    setEditandoChave(null)
    setRevisao((r) => r + 1)
  }, [editandoChave, chaveSelecionada, desligarEdicao])

  /**
   * Leva o mapa até o item já selecionado.
   *
   * Existe porque a seleção agora pode vir de fora — da barra lateral — e nesse
   * caso o mapa precisa reagir a um estado que ele não mudou.
   */
  const focarSelecionado = useCallback(() => {
    if (!mapa || !itemSelecionado?.geometria) return
    focarGeometria(mapa, itemSelecionado.geometria)
  }, [mapa, itemSelecionado])

  // Clique na árvore leva o mapa até a geometria.
  const selecionarEFocar = useCallback(
    (alvo) => {
      setSelecionado(alvo)
      if (!mapa) return
      const item =
        alvo.tipo === 'talhao'
          ? talhoes.find((t) => t.id === alvo.id)
          : glebas.find((g) => g.id === alvo.id)
      if (item?.geometria) focarGeometria(mapa, item.geometria)
    },
    [mapa, talhoes, glebas],
  )

  function iniciarEdicaoGeometria() {
    if (!editor || !selecionado) return
    const camada = obterCamada(selecionado.tipo, selecionado.id)
    if (!camada) {
      mostrarAviso('Esta geometria ainda não está desenhada no mapa.')
      return
    }
    // Habilita por camada filha, não no mapa inteiro: o modo global do Geoman
    // deixaria todas as geometrias editáveis de uma vez.
    camada.eachLayer((filha) => filha.pm?.enable({ allowSelfIntersection: false }))
    setEditandoChave(chaveSelecionada)
  }

  async function salvarGeometria() {
    // A guarda de reentrância é o que impede um duplo clique de disparar dois
    // UPDATE. O botão também fica desabilitado, mas dois cliques rápidos
    // chegam antes do re-render.
    if (!selecionado || gravandoGeometria) return
    const camada = obterCamada(selecionado.tipo, selecionado.id)
    if (!camada) return

    // L.geoJSON devolve FeatureCollection mesmo tendo recebido uma Feature.
    const feature = primeiraFeature(camada.toGeoJSON())
    const areaHa = areaEmHectares(feature)

    setGravandoGeometria(true)
    try {
      if (selecionado.tipo === 'talhao') {
        aplicarTalhao(await atualizarTalhao(selecionado.id, { geometria: feature, areaHa }))
      } else {
        aplicarGleba(await atualizarGleba(selecionado.id, { geometria: feature, areaHa }))
      }
      // Só sai do modo de edição depois de gravado. Sair antes daria a impressão
      // de sucesso mesmo quando a gravação falha.
      desligarEdicao(chaveSelecionada)
      setEditandoChave(null)
      mostrarAviso('Geometria gravada.')
    } catch (e) {
      mostrarAviso(e.message)
      // O desenho na tela não corresponde ao banco: volta ao que está salvo em
      // vez de deixar o usuário achar que gravou.
      desligarEdicao(chaveSelecionada)
      setEditandoChave(null)
      setRevisao((r) => r + 1)
    } finally {
      setGravandoGeometria(false)
    }
  }

  function cancelarGeometria() {
    desligarEdicao(chaveSelecionada)
    setEditandoChave(null)
    setRevisao((r) => r + 1)
  }

  async function abrirExclusao() {
    if (!selecionado || carregandoExclusao) return
    setCarregandoExclusao(true)
    try {
      if (selecionado.tipo === 'talhao') {
        const resumo = await resumoCascataTalhao(selecionado.id)
        setConfirmandoItem({
          consequencias: [
            { rotulo: 'glebas', quantidade: resumo.glebas },
            { rotulo: 'análises', quantidade: resumo.analises },
          ],
        })
      } else {
        setConfirmandoItem({
          consequencias: [
            { rotulo: 'análises', quantidade: await contarAnalisesDaGleba(selecionado.id) },
          ],
        })
      }
    } catch (e) {
      mostrarAviso(e.message)
    } finally {
      setCarregandoExclusao(false)
    }
  }

  async function confirmarExclusao() {
    if (!selecionado) return
    if (selecionado.tipo === 'talhao') {
      await excluirTalhao(selecionado.id)
      removerTalhao(selecionado.id)
    } else {
      await excluirGleba(selecionado.id)
      removerGleba(selecionado.id)
    }
    setConfirmandoItem(null)
    setSelecionado(null)
  }

  return {
    selecionado,
    itemSelecionado,
    talhaoPai,
    selecionarEFocar,
    focarSelecionado,
    // Seleciona sem mover o mapa. Usado logo após criar uma geometria: nesse
    // instante ela ainda não está na lista, então não haveria o que focar.
    selecionar: aoSelecionar,
    limparSelecao,

    editandoGeometria,
    gravandoGeometria,
    iniciarEdicaoGeometria,
    salvarGeometria,
    cancelarGeometria,

    editandoDados,
    abrirEdicaoDados: () => setEditandoDados(selecionado?.tipo ?? null),
    fecharEdicaoDados: () => setEditandoDados(null),

    confirmandoItem,
    carregandoExclusao,
    abrirExclusao,
    fecharExclusao: () => setConfirmandoItem(null),
    confirmarExclusao,
  }
}
