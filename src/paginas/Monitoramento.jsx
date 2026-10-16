import { useEffect, useState } from 'react'
import Abas, { PainelDeAba } from '../componentes/Abas.jsx'
import SeletorTalhao from './dados/SeletorTalhao.jsx'
import { useSelecaoTalhao } from './dados/useSelecaoTalhao.js'
import { useCenasCbers } from './monitoramento/useCenasCbers.js'

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

  const indiceSelecionado = cenas.findIndex((cena) => cena.id === cenaSelecionada?.id)
  const cenaAtual = cenas[indiceSelecionado]

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
        <label
          htmlFor="linha-tempo-cbers"
          className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          <span>Data da cena</span>
          <span>{indiceSelecionado + 1} de {cenas.length}</span>
        </label>
        <input
          id="linha-tempo-cbers"
          aria-label="Data da cena CBERS"
          type="range"
          min="0"
          max={cenas.length - 1}
          step="1"
          value={indiceSelecionado}
          onChange={(evento) => aoSelecionar(cenas[Number(evento.target.value)])}
          className="mt-2 w-full accent-solo-700"
        />
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{formatarData(cenas[0].data)}</span>
          <span>{formatarData(cenas[cenas.length - 1].data)}</span>
        </div>
      </div>

      <div className="mt-4 max-h-56 overflow-auto rounded-md border border-slate-200 dark:border-white/10">
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
    </section>
  )
}

function PreviaCena({ cena }) {
  if (!cena) return null

  return (
    <section className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Prévia da cena selecionada
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          CBERS-4A MUX · {formatarData(cena.data)} · nuvens {formatarNuvem(cena.nuvens)}
        </span>
      </div>
      <img
        src={cena.previa}
        alt={`Prévia CBERS-4A da cena de ${formatarData(cena.data)}`}
        className="mt-3 max-h-80 w-full rounded bg-slate-100 object-contain dark:bg-noite-900"
        loading="lazy"
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Prévia da cena CBERS completa do catálogo do INPE — o retângulo é a cena
        orbital, não o formato do talhão. Ainda não é um mapa de índice nem um recorte
        georreferenciado do talhão. Fonte:{' '}
        <a
          href="https://www.gov.br/inpe/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          INPE
        </a>
        {' · '}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          CC BY-SA 4.0
        </a>
      </p>
    </section>
  )
}

export default function Monitoramento() {
  const selecao = useSelecaoTalhao()
  const [indiceAtivo, setIndiceAtivo] = useState('ndvi')
  const [cenaAtivaId, setCenaAtivaId] = useState('')
  const indice = INDICES.find((item) => item.chave === indiceAtivo)
  const geometria = selecao.talhao?.geometria ?? null
  const { cenas, carregando, erro } = useCenasCbers(selecao.talhaoId, geometria)
  const cenaSelecionada = cenas.find((cena) => cena.id === cenaAtivaId) ?? cenas.at(-1) ?? null

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
              Cenas CBERS-4A do catálogo do INPE. Os índices serão processados a partir
              das bandas originais numa próxima etapa.
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
              <p className="mt-3 rounded-md border border-solo-200 bg-solo-50 px-3 py-2 text-sm text-solo-900 dark:border-solo-500/30 dark:bg-solo-500/10 dark:text-solo-200">
                {item.rotulo} selecionado. O cálculo e a camada colorida ainda dependem
                do processamento das bandas CBERS no servidor; por enquanto, esta tela
                mostra as cenas e suas prévias.
              </p>
            </div>
          </PainelDeAba>
        ))}

        <section className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5 dark:border-white/15 dark:bg-white/5">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Imagens CBERS-4A disponíveis
          </h2>
          {!geometria && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Escolha um talhão com área desenhada para consultar as cenas do INPE.
            </p>
          )}
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
          <PreviaCena cena={cenaSelecionada} />
        </section>
      </div>
    </div>
  )
}
