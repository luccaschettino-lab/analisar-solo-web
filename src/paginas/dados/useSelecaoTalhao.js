import { useEffect, useState } from 'react'
import { useFazendas } from '../../hooks/useFazendas.js'
import { useHierarquia } from '../../hooks/useHierarquia.js'
import { podeEditar } from '../../lib/permissoes.js'

/**
 * Seleção em cascata Fazenda › Talhão.
 *
 * Mora fora do formulário porque a listagem de análises usa o mesmo talhão
 * selecionado — duas fontes de verdade para "qual talhão estou olhando"
 * acabariam divergindo.
 */
export function useSelecaoTalhao() {
  const {
    fazendas,
    carregando: carregandoFazendas,
    erro: erroFazendas,
    recarregar: recarregarFazendas,
  } = useFazendas()

  const [fazendaId, setFazendaId] = useState('')
  const [talhaoId, setTalhaoId] = useState('')

  const {
    talhoes,
    carregando: carregandoHierarquia,
    erro: erroHierarquia,
    recarregar: recarregarHierarquia,
  } = useHierarquia(fazendaId || null)

  // Uma opção só é selecionada sozinha, nos dois níveis. Quem tem uma
  // fazenda só não deveria abrir dois seletores pra chegar no único talhão.
  useEffect(() => {
    if (!fazendaId && fazendas.length === 1) setFazendaId(fazendas[0].id)
  }, [fazendas, fazendaId])

  useEffect(() => {
    if (!talhaoId && talhoes.length === 1) setTalhaoId(talhoes[0].id)
  }, [talhoes, talhaoId])

  function selecionarFazenda(id) {
    setFazendaId(id)
    // Trocar de fazenda invalida o nível abaixo: o talhão anterior não
    // existe nesta, e deixar o id antigo produziria uma seleção fantasma.
    setTalhaoId('')
  }

  const fazenda = fazendas.find((f) => f.id === fazendaId) ?? null
  const talhao = talhoes.find((t) => t.id === talhaoId) ?? null

  return {
    fazendas,
    talhoes,

    fazendaId,
    talhaoId,
    fazenda,
    talhao,

    selecionarFazenda,
    selecionarTalhao: setTalhaoId,

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
