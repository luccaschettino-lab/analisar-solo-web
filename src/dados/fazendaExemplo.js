import { supabase, checar } from './cliente.js'
import { criarFazenda, excluirFazenda } from './fazendas.js'
import { criarTalhao } from './talhoes.js'
import { criarPontosColetaEmLote, criarGlebaComPontosColeta } from './pontosColeta.js'
import { criarAnalisesEmLote } from './analises.js'
import { agruparPontosEmGlebas } from '../lib/pontosDeColeta.js'
import {
  NOME_FAZENDA_EXEMPLO,
  sedeExemplo,
  talhoesExemplo,
  pontosExemplo,
  analisesExemplo,
} from '../lib/fazendaExemplo.js'

/**
 * Cria a fazenda de exemplo na conta de quem está logado, pelos mesmos
 * caminhos do uso real: fazenda → talhões → pontos de amostra → glebas
 * automáticas → análises. Se qualquer passo falhar, a fazenda é apagada
 * (talhões, pontos, glebas e análises vão junto, em cascata) — não sobra
 * exemplo pela metade.
 *
 * `aoProgredir(texto)` recebe o passo atual, para a tela mostrar.
 * Devolve a fazenda criada (com `papel` e `exemplo`).
 */
export async function criarFazendaExemplo(aoProgredir) {
  aoProgredir?.('Criando a fazenda…')
  const fazenda = await criarFazenda({ nome: NOME_FAZENDA_EXEMPLO, municipio: 'Sorriso', uf: 'MT' })
  try {
    const sede = sedeExemplo()
    const marcada = checar(
      await supabase
        .from('fazendas')
        .update({ exemplo: true, sede_lat: sede.lat, sede_lng: sede.lng })
        .eq('id', fazenda.id)
        .select()
        .single(),
      'Falha ao marcar a fazenda de exemplo',
    )

    aoProgredir?.('Desenhando os talhões…')
    const talhoes = []
    for (const t of talhoesExemplo()) {
      talhoes.push(await criarTalhao({ fazendaId: fazenda.id, ...t }))
    }

    aoProgredir?.('Importando os pontos de amostra…')
    const porCodigo = pontosExemplo()
    const pontos = []
    for (const talhao of talhoes) {
      pontos.push(...(await criarPontosColetaEmLote(talhao.id, porCodigo.get(talhao.codigo) ?? [])))
    }

    const { glebas: grupos } = agruparPontosEmGlebas(pontos, talhoes)
    const pontoPorId = new Map(pontos.map((p) => [p.id, p]))
    const codigoDoTalhao = new Map(talhoes.map((t) => [t.id, t.codigo]))
    for (const [i, g] of grupos.entries()) {
      aoProgredir?.(`Criando as glebas (${i + 1} de ${grupos.length})…`)
      await criarGlebaComPontosColeta({
        talhaoId: g.talhaoId,
        codigo: g.codigo,
        nome: null,
        geometria: g.geometria,
        areaHa: g.areaHa,
        pontosColetaIds: g.pontoIds,
      })
    }

    const payloads = analisesExemplo(
      grupos.map((g) => ({
        codigo: g.codigo,
        talhaoId: g.talhaoId,
        codigoTalhao: codigoDoTalhao.get(g.talhaoId),
        pontos: g.pontoIds.map((id) => pontoPorId.get(id)?.geometria?.geometry?.coordinates).filter(Boolean),
      })),
    )
    await criarAnalisesEmLote(payloads, (feitas, total) => aoProgredir?.(`Lançando as análises (${feitas} de ${total})…`))

    return { ...fazenda, ...marcada, papel: 'proprietario' }
  } catch (e) {
    try {
      await excluirFazenda(fazenda.id)
    } catch {
      // Sem permissão ou sem rede: o erro original é o que importa contar.
    }
    throw new Error(`Não foi possível criar a fazenda de exemplo. ${e.message}`)
  }
}
