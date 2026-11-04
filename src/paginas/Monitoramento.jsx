import { useEffect, useMemo, useState } from 'react'
import Abas, { PainelDeAba } from '../componentes/Abas.jsx'
import SeletorTalhao from './dados/SeletorTalhao.jsx'
import { useSelecaoTalhao } from './dados/useSelecaoTalhao.js'
import { useCenasCbers } from './monitoramento/useCenasCbers.js'
import { useIndicesCbers } from './monitoramento/useIndicesCbers.js'
import SeletorDeData from './monitoramento/SeletorDeData.jsx'
import MapaDoTalhao from './monitoramento/MapaDoTalhao.jsx'
import { distribuicaoPorFaixa } from '../lib/rasterIndice.js'

const INDICES = [
  {
    chave: 'ndvi',
    rotulo: 'NDVI',
    nome: 'Índice de vegetação por diferença normalizada',
    explicacao:
      'Vigor da vegetação: quanto mais denso e verde o dossel, mais alto o valor. É o índice mais comum pra acompanhar o desenvolvimento da lavoura ao longo da safra.',
  },
  {
    chave: 'evi',
    rotulo: 'EVI',
    nome: 'Índice de vegetação otimizado',
    explicacao:
      'Como o NDVI, mas corrige a influência do solo exposto e da atmosfera. Mais confiável quando o dossel já está fechado e o NDVI satura.',
  },
  {
    chave: 'savi',
    rotulo: 'SAVI',
    nome: 'Índice de vegetação ajustado ao solo',
    explicacao:
      'NDVI ajustado pra solo exposto. Mais confiável no início da safra ou em área de falha, onde solo claro apareceria como se fosse planta estressada.',
  },
  {
    chave: 'ndwi',
    rotulo: 'NDWI',
    nome: 'Índice de água por diferença normalizada',
    explicacao: null,
  },
]

function formatarData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatarNuvem(percentual) {
  return percentual == null ? 'indisponível' : `${Math.round(percentual)}%`
}

const numero = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

function AvisoNdwi() {
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="font-medium">O NDWI não mede umidade do solo.</p>
      <p className="mt-1 text-amber-700 dark:text-amber-300/90">
        Com as bandas verde e infravermelho próximo do CBERS, o NDWI de McFeeters
        ajuda a identificar água superficial, como rios, açudes e áreas alagadas.
        Não substitui medição de umidade do solo.
      </p>
    </div>
  )
}

function LinhaDoTempo({ cenas, cenaSelecionada, talhaoCodigo, aoSelecionar }) {
  if (cenas.length === 0) return null

  const cenaAtual = cenas.find((cena) => cena.id === cenaSelecionada?.id)

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Linha do tempo CBERS-4A
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {cenas.length} {cenas.length === 1 ? 'cena encontrada' : 'cenas encontradas'} que
            cruzam o formato real de {talhaoCodigo
              ? `talhão ${talhaoCodigo}`
              : 'este talhão'}. As datas disponíveis dependem da cobertura do satélite.
          </p>
        </div>
        {cenaAtual && (
          <p className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200">
            {formatarData(cenaAtual.data)} · nuvens {formatarNuvem(cenaAtual.nuvens)}
          </p>
        )}
      </div>

      <div className="mt-4">
        <SeletorDeData cenas={cenas} selecionadaId={cenaSelecionada?.id} aoSelecionar={aoSelecionar} />
      </div>

      {/* A barra é o jeito principal de escolher a data; a lista fica para quem
          prefere ler todas de uma vez. */}
      <details className="mt-4 rounded-md border border-slate-200 dark:border-white/10">
        <summary className="cursor-pointer px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          Ver todas as datas em lista
        </summary>
        <div className="max-h-56 overflow-auto border-t border-slate-200 dark:border-white/10">
          <ul className="divide-y divide-slate-100 dark:divide-white/10">
            {cenas.map((cena) => {
              const selecionada = cena.id === cenaSelecionada?.id
              return (
                <li key={cena.id}>
                  <button
                    type="button"
                    aria-pressed={selecionada}
                    onClick={() => aoSelecionar(cena)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                      selecionada
                        ? 'bg-solo-50 text-solo-900 dark:bg-solo-500/15 dark:text-solo-200'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{formatarData(cena.data)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Nuvens: {formatarNuvem(cena.nuvens)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </details>
    </section>
  )
}

function Legenda({ dados, indice }) {
  const faixas = useMemo(() => distribuicaoPorFaixa(dados, indice), [dados, indice])
  return (
    <ul className="mt-3 grid gap-1 text-xs text-slate-700 dark:text-slate-300 sm:grid-cols-5">
      {faixas.map((f) => (
        <li key={f.rotulo} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm border border-black/10" style={{ background: f.cor }} />
          <span>
            {f.rotulo} · {Math.round(f.pct)}%
          </span>
        </li>
      ))}
    </ul>
  )
}

function ResultadoDoIndice({ dados, indice, rotulo }) {
  const est = dados.estatisticas[indice]
  const q = dados.qualidade
  return (
    <div className="mt-3">
      {est ? (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            ['Média', est.media],
            ['Mínimo', est.minimo],
            ['Máximo', est.maximo],
            ['Desvio', est.desvio],
          ].map(([nome, valor]) => (
            <div key={nome} className="rounded-md bg-slate-100 px-3 py-2 dark:bg-white/10">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                {rotulo} · {nome.toLowerCase()}
              </dt>
              <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{numero(valor)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          Não há pixel limpo dentro do talhão nesta data
          {q.possivelNuvemPct > 0 ? ` (${q.possivelNuvemPct}% parece nuvem)` : ''}. Escolha outra data na linha do tempo.
        </p>
      )}
      <Legenda dados={dados} indice={indice} />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {q.validos.toLocaleString('pt-BR')} de {q.pixelsNoTalhao.toLocaleString('pt-BR')} pixels de 16 m dentro do
        talhão entram na conta
        {q.possivelNuvemPct > 0 ? `; ${q.possivelNuvemPct}% parece nuvem (cinza no mapa) e fica de fora` : ''}.
      </p>
    </div>
  )
}

export default function Monitoramento() {
  const selecao = useSelecaoTalhao()
  const [indiceAtivo, setIndiceAtivo] = useState('ndvi')
  const [cenaAtivaId, setCenaAtivaId] = useState('')
  const geometria = selecao.talhao?.geometria ?? null
  const { cenas, carregando, erro } = useCenasCbers(selecao.talhaoId, geometria)
  const cenaSelecionada = cenas.find((cena) => cena.id === cenaAtivaId) ?? cenas.at(-1) ?? null
  const { dados, carregando: calculando, erro: erroCalculo } = useIndicesCbers(
    selecao.talhaoId,
    cenaSelecionada?.id,
    geometria,
  )

  useEffect(() => {
    if (cenas.length > 0 && !cenas.some((cena) => cena.id === cenaAtivaId)) {
      setCenaAtivaId(cenas[cenas.length - 1].id)
    }
  }, [cenas, cenaAtivaId])

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 pt-4 dark:border-white/10 dark:bg-noite-900">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solo-50 text-lg dark:bg-solo-500/15"
          >
            🛰
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Monitoramento por satélite
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Índices calculados a partir das bandas CBERS-4A do INPE, só dentro do talhão escolhido.
            </p>
          </div>
        </div>

        <div className="mb-3 mt-3">
          <Abas
            abas={INDICES.map((item) => ({ chave: item.chave, rotulo: item.rotulo }))}
            ativa={indiceAtivo}
            aoTrocar={setIndiceAtivo}
            rotulo="Índice"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <SeletorTalhao selecao={selecao} />

        {INDICES.map((item) => (
          <PainelDeAba key={item.chave} chave={item.chave} ativa={indiceAtivo}>
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.nome}</h2>
              {item.explicacao && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.explicacao}</p>
              )}
              {item.chave === 'ndwi' && <AvisoNdwi />}
            </div>
          </PainelDeAba>
        ))}

        {!geometria && (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Escolha um talhão com área desenhada para ver os índices.
          </p>
        )}

        {geometria && (
          <section className="mt-4">
            <div className="relative">
              <MapaDoTalhao geometria={geometria} dados={dados} indice={indiceAtivo} />
              {calculando && (
                <p
                  role="status"
                  className="absolute left-3 top-3 z-[1000] rounded-md bg-white/95 px-3 py-1.5 text-sm text-slate-700 shadow dark:bg-noite-900/95 dark:text-slate-200"
                >
                  Calculando os índices desta data…
                </p>
              )}
            </div>
            {erroCalculo && (
              <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
                {erroCalculo}
              </p>
            )}
            {dados && (
              <ResultadoDoIndice
                dados={dados}
                indice={indiceAtivo}
                rotulo={INDICES.find((i) => i.chave === indiceAtivo).rotulo}
              />
            )}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Valores de reflectância no topo da atmosfera, sem correção atmosférica: servem para acompanhar a
              lavoura ao longo da safra, mas ficam um pouco abaixo dos de reflectância de superfície. Cada
              quadrado do mapa tem 16 m. Imagens: CBERS-4A MUX, INPE (
              <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="underline">
                CC BY-SA 4.0
              </a>
              ).
            </p>
          </section>
        )}

        <section className="mt-2">
          {geometria && carregando && (
            <p role="status" className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Consultando as datas disponíveis no catálogo do INPE…
            </p>
          )}
          {erro && (
            <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
              {erro}
            </p>
          )}
          {geometria && !carregando && !erro && cenas.length === 0 && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Nenhuma cena CBERS encontrada para a região deste talhão.
            </p>
          )}

          <LinhaDoTempo
            cenas={cenas}
            cenaSelecionada={cenaSelecionada}
            talhaoCodigo={selecao.talhao?.codigo}
            aoSelecionar={(cena) => setCenaAtivaId(cena.id)}
          />
        </section>
      </div>
    </div>
  )
}
