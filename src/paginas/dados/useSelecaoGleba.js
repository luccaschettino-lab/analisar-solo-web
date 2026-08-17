import { useEffect, useMemo, useState } from 'react'
import { useFazendas } from '../../hooks/useFazendas.js'
import { useHierarquia, glebasDoTalhao } from '../../hooks/useHierarquia.js'
import { podeEditar } from '../../lib/permissoes.js'

/**
 * Seleção em cascata Fazenda › Talhão › Gleba.
 *
 * Mora fora do formulário porque a listagem de análises usa a mesma gleba
 * selecionada — duas fontes de verdade para "qual gleba estou olhando"
 * acabariam divergindo.
 */
export function useSelecaoGleba() {
  const {
    fazendas,
    carregando: carregandoFazendas,
    erro: erroFazendas,
    recarregar: recarregarFazendas,
  } = useFazendas()

  const [fazendaId, setFazendaId] = useState('')
  const [talhaoId, setTalhaoId] = useState('')
  const [glebaId, setGlebaId] = useState('')

  const {
    talhoes,
    glebas,
    carregando: carregandoHierarquia,
    erro: erroHierarquia,
    recarregar: recarregarHierarquia,
  } = useHierarquia(fazendaId || null)

  const glebasDoTalhaoSelecionado = useMemo(
    () => (talhaoId ? glebasDoTalhao(glebas, talhaoId) : []),
    [glebas, talhaoId],
  )

  // Uma opção só é selecionada sozinha, nos três níveis. Quem tem uma fazenda
  // e um talhão não deveria abrir três seletores para chegar na única gleba.
  useEffect(() => {
    if (!fazendaId && fazendas.length === 1) setFazendaId(fazendas[0].id)
  }, [fazendas, fazendaId])

  useEffect(() => {
    if (!talhaoId && talhoes.length === 1) setTalhaoId(talhoes[0].id)
  }, [talhoes, talhaoId])

  useEffect(() => {
    if (!glebaId && glebasDoTalhaoSelecionado.length === 1) {
      setGlebaId(glebasDoTalhaoSelecionado[0].id)
    }
  }, [glebasDoTalhaoSelecionado, glebaId])

  function selecionarFazenda(id) {
    setFazendaId(id)
    // Trocar de fazenda invalida os níveis abaixo: o talhão anterior não
    // existe nesta, e deixar o id antigo produziria uma seleção fantasma.
    setTalhaoId('')
    setGlebaId('')
  }

  function selecionarTalhao(id) {
    setTalhaoId(id)
    setGlebaId('')
  }

  const fazenda = fazendas.find((f) => f.id === fazendaId) ?? null
  const talhao = talhoes.find((t) => t.id === talhaoId) ?? null
  const gleba = glebas.find((g) => g.id === glebaId) ?? null

  return {
    fazendas,
    talhoes,
    glebas: glebasDoTalhaoSelecionado,

    fazendaId,
    talhaoId,
    glebaId,
    fazenda,
    talhao,
    gleba,

    selecionarFazenda,
    selecionarTalhao,
    selecionarGleba: setGlebaId,

    // Escrever análise depende do papel na fazenda, como toda escrita.
    podeLancar: podeEditar(fazenda?.papel),

    carregandoFazendas,
    carregandoHierarquia,

    // Quem consome precisa distinguir "falhou" de "está vazio". Sem separar,
    // uma queda de rede aparece como "você não tem fazendas" — e o usuário
    // conclui que perdeu os dados.
    erro: erroFazendas || erroHierarquia,
    recarregar: () => {
      recarregarFazendas()
      if (fazendaId) recarregarHierarquia()
    },
  }
}
