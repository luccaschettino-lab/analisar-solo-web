import { supabase, checar } from './cliente.js'
import { criarAnalisesEmLote, listarIdentidadesDaFazenda } from './analises.js'
import { listarPontosColetaDaFazenda } from './pontosColeta.js'
import { analisesExemplo, centroDaGleba } from '../lib/fazendaExemplo.js'
import { chaveDeDuplicidade } from '../lib/importacaoLaudo.js'

/** Apaga várias glebas de uma vez (desfazer uma importação errada no tutorial). */
export async function excluirGlebas(ids) {
  if (ids.length === 0) return
  checar(await supabase.from('glebas').delete().in('id', ids), 'Falha ao apagar as glebas')
}

/**
 * A fazenda criada no tutorial guiado vira "de exemplo": ganha a faixa de
 * dados fictícios e fica fora dos primeiros passos.
 */
export async function marcarFazendaComoExemplo(id) {
  return checar(
    await supabase.from('fazendas').update({ exemplo: true }).eq('id', id).select().single(),
    'Falha ao marcar a fazenda do tutorial',
  )
}

/**
 * "O laboratório mandou o laudo": depois que a pessoa digita uma análise no
 * tutorial, as demais entram de uma vez — fictícias, nas posições das glebas
 * que ela mesma criou. A que ela digitou (mesmo talhão, safra, profundidade e
 * nº de amostra) é pulada, nunca sobrescrita.
 *
 * `talhoes` e `glebas` vêm do contexto da fazenda. Devolve quantas entraram.
 */
export async function receberLaudoExemplo(fazendaId, talhoes, glebas, aoProgredir, { safra } = {}) {
  const [pontos, existentes] = await Promise.all([
    listarPontosColetaDaFazenda(fazendaId),
    listarIdentidadesDaFazenda(fazendaId),
  ])
  const codigoDoTalhao = new Map(talhoes.map((t) => [t.id, t.codigo]))
  const pontosDaGleba = new Map()
  for (const p of pontos) {
    if (!p.gleba_id) continue
    if (!pontosDaGleba.has(p.gleba_id)) pontosDaGleba.set(p.gleba_id, [])
    pontosDaGleba.get(p.gleba_id).push(p.geometria?.geometry?.coordinates)
  }

  const jaGravadas = new Set(
    existentes.map((a) =>
      chaveDeDuplicidade({ talhaoId: a.talhao_id, anoSafra: a.ano_safra, profundidade: a.profundidade, numeroAmostraLab: a.numero_amostra_lab }),
    ),
  )
  const payloads = analisesExemplo(
    glebas.map((g) => ({
      codigo: g.codigo,
      talhaoId: g.talhao_id,
      codigoTalhao: codigoDoTalhao.get(g.talhao_id),
      // Sem pontos ligados, a amostra fica no centro do desenho da gleba.
      pontos: pontosDaGleba.get(g.id)?.filter(Boolean).length
        ? pontosDaGleba.get(g.id).filter(Boolean)
        : [centroDaGleba(g.geometria)].filter(Boolean),
    })),
  ).filter(
    (a) =>
      (!safra || a.ano_safra === safra) &&
      !jaGravadas.has(
        chaveDeDuplicidade({ talhaoId: a.talhao_id, anoSafra: a.ano_safra, profundidade: a.profundidade, numeroAmostraLab: a.numero_amostra_lab }),
      ),
  )
  return criarAnalisesEmLote(payloads, aoProgredir)
}
