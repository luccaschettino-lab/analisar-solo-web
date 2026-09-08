import { useState } from 'react'
import Abas, { PainelDeAba } from '../../componentes/Abas.jsx'
import TabelaAnalises from '../gleba/TabelaAnalises.jsx'
import HistoricoGraficos from '../gleba/HistoricoGraficos.jsx'
import { useAnalises } from '../../hooks/useAnalises.js'

const ABAS = [
  { chave: 'analises', rotulo: 'Análises' },
  { chave: 'historico', rotulo: 'Histórico' },
]

/**
 * Conteúdo do talhão selecionado, ao lado do mapa.
 *
 * As mesmas duas abas de `/#/talhoes/:id` — reaproveitadas, não reescritas,
 * para as duas telas nunca divergirem no que mostram. A página continua
 * existindo para link direto (a barra lateral aponta pra lá); este painel é
 * o atalho de quem já está com o mapa aberto e não quer sair dele.
 *
 * Sem aba de foto — era um recurso da gleba, que saiu de cena.
 *
 * Largura em duas faixas, não livre: um `resize` arrastável exigiria guardar
 * preferência e ainda ficaria torto no celular. Duas larguras fixas — e o
 * celular vira tela cheia — cobrem o que se pede aqui: "dá pra ver mais se eu
 * quiser".
 */
export default function PainelTalhao({ talhao, expandido, aoAlternarExpandido, aoFechar }) {
  const [aba, setAba] = useState('analises')
  const { analises, carregando, erro } = useAnalises(talhao.id)

  return (
    <div
      className={`vidro-forte fixed inset-0 z-[1200] flex flex-col sm:static sm:z-auto sm:h-full sm:border-l sm:border-slate-200 sm:transition-[width] sm:duration-200 dark:sm:border-white/15 ${
        expandido ? 'sm:w-[52rem]' : 'sm:w-[28rem]'
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Talhão
          </p>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {talhao.codigo}
            {talhao.nome && <span className="font-normal text-slate-500 dark:text-slate-400"> · {talhao.nome}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={aoAlternarExpandido}
            aria-label={expandido ? 'Encolher painel' : 'Expandir painel'}
            title={expandido ? 'Encolher painel' : 'Expandir painel'}
            className="hidden rounded px-2 py-1 text-base text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100 sm:block"
          >
            {expandido ? '»' : '«'}
          </button>
          <button
            onClick={aoFechar}
            aria-label="Fechar painel do talhão"
            className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="shrink-0 border-b border-slate-200 px-2 dark:border-white/10">
        <Abas abas={ABAS} ativa={aba} aoTrocar={setAba} rotulo="Seções do talhão" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {carregando ? (
          <p className="p-6 text-sm text-slate-400 dark:text-slate-500">Carregando análises…</p>
        ) : erro ? (
          <p
            role="alert"
            className="m-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300"
          >
            {erro}
          </p>
        ) : analises.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Nenhuma análise neste talhão ainda.</p>
        ) : (
          <>
            <PainelDeAba chave="analises" ativa={aba}>
              <TabelaAnalises analises={analises} />
            </PainelDeAba>
            <PainelDeAba chave="historico" ativa={aba}>
              <HistoricoGraficos analises={analises} />
            </PainelDeAba>
          </>
        )}
      </div>
    </div>
  )
}
