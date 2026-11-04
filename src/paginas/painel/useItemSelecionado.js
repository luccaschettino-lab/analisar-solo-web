import { useCallback, useEffect, useRef, useState } from 'react'
import { useGeometrias } from '../../mapa/useGeometrias.js'
import { focarGeometria } from '../../mapa/enquadrar.js'
import { primeiraFeature, areaEmHectares, avaliarContencao, CONTENCAO, mesmaGeometria } from '../../lib/geo.js'
import { SNAP_DISTANCIA } from '../../config/mapa.js'
import { planejarDivisa } from '../../lib/divisaCompartilhada.js'
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
  pontosAmostra = [],
  coloracao = null,
  filtro = null,
  mostrarCor = true,
  mostrarPontosAmostra = false,
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
  // Encaixe dos vértices nas divisas vizinhas durante a edição. Ligado ajuda a
  // fechar divisa sem fresta; desligado deixa ajustar poucos pixels sem o
  // vértice ser puxado de volta (ver `iniciarEdicaoGeometria`).
  const [encaixar, setEncaixar] = useState(true)
  // Clicaram em outro item com vértices arrastados e ainda não gravados: a
  // seleção volta para o item em edição e o diálogo pergunta o que fazer.
  const [descartePendente, setDescartePendente] = useState(null)
  // O que a pessoa moveu também é divisa de outra gleba: pergunta se leva junto.
  const [divisaPendente, setDivisaPendente] = useState(null)
  const ultimoAvisoDeCruzamento = useRef(0)

  const aoSelecionar = useCallback((alvo) => setSelecionado(alvo), [setSelecionado])
  const { obterCamada } = useGeometrias(mapa, {
    talhoes,
    glebas,
    selecionado,
    aoSelecionar,
    revisao,
    pontosAmostra,
    coloracao,
    filtro,
    mostrarCor,
    mostrarPontosAmostra,
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

  // O Geoman recusa em silêncio o vértice que faria a linha cruzar a si mesma:
  // quem arrasta vê o ponto voltar e acha que travou. Avisa, no máximo uma vez
  // a cada poucos segundos (o evento dispara a cada movimento do mouse).
  const aoCruzar = useCallback(() => {
    const agora = Date.now()
    if (agora - ultimoAvisoDeCruzamento.current < 4000) return
    ultimoAvisoDeCruzamento.current = agora
    mostrarAviso('A linha não pode cruzar a si mesma. Afaste um pouco o vértice.')
  }, [mostrarAviso])

  const desligarEdicao = useCallback(
    (chave) => {
      if (!chave) return
      const [tipo, id] = chave.split(':')
      obterCamada(tipo, id)?.eachLayer((filha) => {
        filha.pm?.disable()
        filha.off('pm:intersect', aoCruzar)
      })
    },
    [obterCamada, aoCruzar],
  )

  // Trocar de item no meio de uma edição encerra a edição: sem isto a camada
  // ficaria editável e fora de sincronia com o banco.
  //
  // Se a pessoa já tinha arrastado vértices sem gravar, isso apagaria o
  // trabalho em silêncio — e numa divisão de terra, com glebas coladas, um
  // clique que cai na vizinha basta para acontecer. Então a seleção VOLTA para
  // o item em edição e o diálogo pergunta; só descarta se a pessoa confirmar.
  useEffect(() => {
    if (!editandoChave || editandoChave === chaveSelecionada) return

    const [tipo, id] = editandoChave.split(':')
    const original = tipo === 'talhao' ? talhoes.find((t) => t.id === id) : glebas.find((g) => g.id === id)
    const camada = obterCamada(tipo, id)
    // Item que já não existe (trocou de fazenda, foi excluído) não tem o que proteger.
    if (original && camada) {
      const atual = primeiraFeature(camada.toGeoJSON())
      if (!mesmaGeometria(atual, original.geometria)) {
        if (!descartePendente) {
          setDescartePendente({
            destino: selecionado,
            rotulo: `${tipo === 'talhao' ? 'talhão' : 'gleba'} ${original.codigo}`,
          })
        }
        setSelecionado({ tipo, id })
        return
      }
    }

    desligarEdicao(editandoChave)
    setEditandoChave(null)
    setRevisao((r) => r + 1)
  }, [editandoChave, chaveSelecionada, desligarEdicao, obterCamada, talhoes, glebas, selecionado, descartePendente, setSelecionado])

  const continuarEditando = useCallback(() => setDescartePendente(null), [])

  const descartarEIr = useCallback(() => {
    const destino = descartePendente?.destino ?? null
    desligarEdicao(editandoChave)
    setEditandoChave(null)
    setRevisao((r) => r + 1)
    setDescartePendente(null)
    setSelecionado(destino)
  }, [descartePendente, editandoChave, desligarEdicao, setSelecionado])

  const alternarEncaixe = useCallback(
    (valor) => {
      setEncaixar(valor)
      if (!editandoChave) return
      const [tipo, id] = editandoChave.split(':')
      // `pm.setOptions` não muda o encaixe de uma edição que já está aberta (o
      // Geoman lê a opção ao habilitar), então a edição é reaberta com a opção
      // nova. Os vértices já arrastados ficam: eles vivem na camada, não nas
      // opções.
      obterCamada(tipo, id)?.eachLayer((filha) => {
        filha.pm?.disable()
        filha.pm?.enable({ allowSelfIntersection: false, snappable: valor, snapDistance: SNAP_DISTANCIA })
      })
    },
    [editandoChave, obterCamada],
  )

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
    //
    // `snapDistance` é explícito de propósito. Sem ele o Geoman usa 20 px, e
    // numa gleba dividida todo vértice coincide com um da vizinha ou do talhão:
    // qualquer arrasto de até ~22 px era desfeito (o vértice voltava ao lugar) e
    // só se movia passando de ~26 px. Com a mesma distância que já vale ao
    // desenhar, a zona morta cai para ~6 px.
    camada.eachLayer((filha) => {
      filha.pm?.enable({ allowSelfIntersection: false, snappable: encaixar, snapDistance: SNAP_DISTANCIA })
      filha.on('pm:intersect', aoCruzar)
    })
    setEditandoChave(chaveSelecionada)
  }

  // Grava o que está na camada. Com `plano`, leva a divisa mexida também às
  // glebas vizinhas que a compartilhavam.
  async function gravarGeometria({ feature, areaHa, plano = null }) {
    const alteradas = []
    setGravandoGeometria(true)
    try {
      if (selecionado.tipo === 'talhao') {
        aplicarTalhao(await atualizarTalhao(selecionado.id, { geometria: feature, areaHa }))
      } else {
        aplicarGleba(await atualizarGleba(selecionado.id, { geometria: feature, areaHa }))
      }
      for (const vizinha of plano?.afetadas ?? []) {
        aplicarGleba(await atualizarGleba(vizinha.gleba.id, { geometria: vizinha.geometria, areaHa: vizinha.areaHa }))
        alteradas.push(vizinha.gleba.codigo)
      }
      // Só sai do modo de edição depois de gravado. Sair antes daria a impressão
      // de sucesso mesmo quando a gravação falha.
      desligarEdicao(chaveSelecionada)
      setEditandoChave(null)
      mostrarAviso(
        alteradas.length > 0
          ? `Geometria gravada, e a divisa também na gleba ${alteradas.join(', ')}.`
          : 'Geometria gravada.',
      )
    } catch (e) {
      mostrarAviso(
        alteradas.length > 0
          ? `${e.message} A divisa já tinha sido levada para a gleba ${alteradas.join(', ')}: confira as vizinhas.`
          : e.message,
      )
      // O desenho na tela não corresponde ao banco: volta ao que está salvo em
      // vez de deixar o usuário achar que gravou.
      desligarEdicao(chaveSelecionada)
      setEditandoChave(null)
      setRevisao((r) => r + 1)
    } finally {
      setGravandoGeometria(false)
    }
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

    // A mesma regra de quando a gleba é criada: tem que ficar dentro do talhão
    // (com a tolerância da divisa). Sem isto dava para gravar uma gleba para
    // fora, e depois nem o nome dela podia ser editado, porque "Editar dados"
    // aplica esta regra. `nao_verificavel` não bloqueia.
    if (selecionado.tipo === 'gleba' && talhaoPai?.geometria) {
      const contencao = avaliarContencao(feature, talhaoPai.geometria)
      if (contencao.situacao === CONTENCAO.FORA) {
        mostrarAviso(
          contencao.areaForaHa != null
            ? `Não gravei: ${contencao.areaForaHa.toLocaleString('pt-BR')} ha (${Math.max(1, Math.round(contencao.fracaoFora * 100))}%) da gleba ficariam fora do talhão ${talhaoPai.codigo}. Traga os vértices de volta para dentro e grave de novo.`
            : `Não gravei: o ponto ficaria fora do talhão ${talhaoPai.codigo}. Traga-o de volta para dentro e grave de novo.`,
        )
        return
      }
    }

    // Divisa compartilhada: num talhão dividido, o vértice que a pessoa moveu
    // costuma ser também da gleba ao lado. Mexer só em uma abre buraco entre as
    // duas, então pergunta antes de gravar.
    if (selecionado.tipo === 'gleba' && itemSelecionado?.geometria) {
      const vizinhas = glebas.filter((g) => g.talhao_id === itemSelecionado.talhao_id && g.id !== itemSelecionado.id)
      const plano = planejarDivisa({ antes: itemSelecionado.geometria, depois: feature, vizinhas })
      if (plano) {
        setDivisaPendente({ feature, areaHa, plano })
        return
      }
    }

    await gravarGeometria({ feature, areaHa })
  }

  // Resposta do diálogo da divisa: grava (levando ou não a divisa às vizinhas).
  async function confirmarDivisa(levarNasVizinhas) {
    if (!divisaPendente || gravandoGeometria) return
    const { feature, areaHa, plano } = divisaPendente
    setDivisaPendente(null)
    await gravarGeometria({ feature, areaHa, plano: levarNasVizinhas ? plano : null })
  }

  const voltarAEditar = useCallback(() => setDivisaPendente(null), [])

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
    encaixar,
    alternarEncaixe,
    descartePendente,
    continuarEditando,
    descartarEIr,
    divisaPendente,
    confirmarDivisa,
    voltarAEditar,
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
