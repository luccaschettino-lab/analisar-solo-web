import { useCallback, useEffect, useState } from 'react'

const CHAVE_ULTIMA = 'analisar-solo:ultima-fazenda'

function lerUltima() {
  // localStorage lança em modo de privacidade restrito de alguns navegadores.
  // Perder a preferência é aceitável; derrubar a tela por causa dela não é.
  try {
    return localStorage.getItem(CHAVE_ULTIMA) ?? ''
  } catch {
    return ''
  }
}

function gravarUltima(id) {
  try {
    localStorage.setItem(CHAVE_ULTIMA, id)
  } catch {
    // silencioso de propósito: é só uma conveniência
  }
}

/**
 * Deixa o mapa abrir numa fazenda específica.
 *
 * Usado pela trilha de navegação da tela de gleba: sem isso, clicar no nome da
 * fazenda levaria ao mapa mostrando a última aberta, que pode ser outra.
 */
export function lembrarFazenda(id) {
  if (id) gravarUltima(id)
}

/**
 * Fazenda aberta no momento, lembrada entre visitas.
 *
 * Quem tem uma fazenda só não deveria precisar selecioná-la toda vez. Se a
 * fazenda lembrada não existir mais — apagada, ou acesso revogado — cai na
 * primeira da lista.
 */
export function useSelecaoFazenda(fazendas, carregando) {
  const [idSelecionada, setIdSelecionada] = useState(lerUltima)

  const fazendaSelecionada = fazendas.find((f) => f.id === idSelecionada) ?? null

  useEffect(() => {
    if (carregando || fazendas.length === 0) return
    if (fazendas.some((f) => f.id === idSelecionada)) return
    setIdSelecionada(fazendas[0].id)
  }, [carregando, fazendas, idSelecionada])

  useEffect(() => {
    if (idSelecionada) gravarUltima(idSelecionada)
  }, [idSelecionada])

  const selecionarFazenda = useCallback((id) => setIdSelecionada(id ?? ''), [])

  return { idSelecionada, fazendaSelecionada, selecionarFazenda }
}
