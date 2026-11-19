import { useCallback, useEffect, useMemo, useState } from 'react'
import { listarAjustesDePragas, listarVistorias, listarRegistros } from '../../dados/pragas.js'
import { listaDaFazenda, resumoDaVistoria, piorStatus, faseDoEstadio } from '../../lib/pragas.js'

/**
 * Tudo do monitoramento de pragas da fazenda aberta: a lista de pragas
 * (referência + ajustes), as vistorias de todos os talhões e os registros.
 * Uma carga só, porque a visão geral precisa da última vistoria de cada
 * talhão e o histórico precisa de todas as do talhão.
 */
export function usePragas(fazendaId, talhoes) {
  const [estado, setEstado] = useState({ ajustes: [], vistorias: [], registros: [], carregando: true, erro: null })
  const [versao, setVersao] = useState(0)
  const idsTalhoes = useMemo(() => talhoes.map((t) => t.id).sort().join(','), [talhoes])

  useEffect(() => {
    if (!fazendaId) return
    let ativo = true
    setEstado((e) => ({ ...e, carregando: true, erro: null }))
    ;(async () => {
      try {
        const ids = idsTalhoes ? idsTalhoes.split(',') : []
        const [ajustes, vistorias] = await Promise.all([listarAjustesDePragas(fazendaId), listarVistorias(ids)])
        const registros = await listarRegistros(vistorias.map((v) => v.id))
        if (ativo) setEstado({ ajustes, vistorias, registros, carregando: false, erro: null })
      } catch (e) {
        if (ativo) setEstado((s) => ({ ...s, carregando: false, erro: e.message }))
      }
    })()
    return () => {
      ativo = false
    }
  }, [fazendaId, idsTalhoes, versao])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  const pragas = useMemo(() => listaDaFazenda(estado.ajustes), [estado.ajustes])

  const registrosPorVistoria = useMemo(() => {
    const m = new Map()
    for (const r of estado.registros) {
      if (!m.has(r.vistoria_id)) m.set(r.vistoria_id, [])
      m.get(r.vistoria_id).push(r)
    }
    return m
  }, [estado.registros])

  // Resumo de cada vistoria (semáforo por praga e o pior do talhão).
  const resumos = useMemo(() => {
    const m = new Map()
    for (const v of estado.vistorias) {
      const linhas = resumoDaVistoria(registrosPorVistoria.get(v.id) ?? [], pragas, faseDoEstadio(v.cultura, v.estadio))
      m.set(v.id, { linhas, pior: piorStatus(linhas) })
    }
    return m
  }, [estado.vistorias, registrosPorVistoria, pragas])

  // Mudanças locais sem recarregar tudo (o ponto recém-gravado aparece na hora).
  const aplicar = useCallback((mudar) => setEstado((e) => ({ ...e, ...mudar(e) })), [])

  return {
    ...estado,
    pragas,
    registrosPorVistoria,
    resumos,
    recarregar,
    aplicar,
  }
}
