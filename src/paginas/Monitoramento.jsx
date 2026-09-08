import { useMemo, useState } from 'react'
import Abas, { PainelDeAba } from '../componentes/Abas.jsx'
import SeletorGleba from './dados/SeletorGleba.jsx'
import { useSelecaoGleba } from './dados/useSelecaoGleba.js'
import { useBuscaCenas } from './monitoramento/useBuscaCenas.js'
import { pontoRotulo } from '../lib/geo.js'

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
    explicacao: null, // aviso próprio, não a descrição padrão — ver abaixo
  },
]

function AvisoNdwi() {
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="font-medium">Isto não mede umidade do solo.</p>
      <p className="mt-1 text-amber-700 dark:text-amber-300/90">
        O NDWI aqui é o de McFeeters (1996), feito pra achar água superficial — rio, açude, área
        alagada. Os satélites do Planet não carregam banda de infravermelho de ondas curtas nem
        radar, que são o que de fato mede umidade de terra. Ainda assim mostramos o índice porque
        ele foi pedido; o rótulo fica aqui pra não ler o mapa como se fosse outra coisa.
      </p>
    </div>
  )
}

function formatarData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatarNuvem(fracao) {
  if (fracao == null) return '—'
  return `${Math.round(fracao * 100)}%`
}

/**
 * Lista as cenas do Planet que cobrem a área — não o mapa colorido em si.
 *
 * A conta ainda não tem permissão de asset (só de busca), então isto é o
 * que dá pra mostrar de verdade hoje: prova que existe imagem recente da
 * fazenda, sem prometer o índice que a conta ainda não consegue entregar.
 */
function ListaCenas({ cenas, carregando, erro, temPonto }) {
  if (!temPonto) {
    return (
      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Escolha um talhão ou gleba acima pra ver as cenas do Planet disponíveis pra essa área.
      </p>
    )
  }

  if (carregando) {
    return <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Consultando o Planet…</p>
  }

  if (erro) {
    return (
      <p className="mt-1 max-w-md text-sm text-red-700 dark:text-red-400" role="alert">
        {erro}
      </p>
    )
  }

  if (cenas.length === 0) {
    return (
      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Nenhuma cena do Planet cobrindo essa área nos últimos 120 dias.
      </p>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-slate-200 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2">Data</th>
            <th className="px-3 py-2">Nuvem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
          {cenas.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{formatarData(c.adquirida)}</td>
              <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{formatarNuvem(c.nuvem)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Monitoramento() {
  const selecao = useSelecaoGleba()
  const [indiceAtivo, setIndiceAtivo] = useState('ndvi')
  const indice = INDICES.find((i) => i.chave === indiceAtivo)

  // Gleba tem prioridade sobre talhão: quem chegou até a gleba quer a área
  // mais específica, não a média do talhão inteiro.
  const geometriaDeReferencia = selecao.gleba?.geometria ?? selecao.talhao?.geometria ?? null
  const [lat, lng] = useMemo(() => pontoRotulo(geometriaDeReferencia) ?? [null, null], [geometriaDeReferencia])

  const { cenas, carregando, erro } = useBuscaCenas(lat, lng)

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
              Vigor da vegetação por geoprocessamento, a partir de imagens do Planet.
            </p>
          </div>
        </div>

        <div className="mb-3 mt-3">
          <Abas
            abas={INDICES.map((i) => ({ chave: i.chave, rotulo: i.rotulo }))}
            ativa={indiceAtivo}
            aoTrocar={setIndiceAtivo}
            rotulo="Índice"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <SeletorGleba selecao={selecao} />

        {INDICES.map((i) => (
          <PainelDeAba key={i.chave} chave={i.chave} ativa={indiceAtivo}>
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{i.nome}</h2>
              {i.explicacao && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{i.explicacao}</p>
              )}
              {i.chave === 'ndwi' && <AvisoNdwi />}
            </div>
          </PainelDeAba>
        ))}

        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5 dark:border-white/15 dark:bg-white/5">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-xl">
              🛰
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Cenas disponíveis, últimos 120 dias
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Sua conta do Planet ainda só tem permissão de busca, não de visualizar a imagem —
                por isso o mapa de {indice.rotulo} não aparece ainda, só a lista de quando existe
                cobertura de satélite da área.
              </p>
              <ListaCenas cenas={cenas} carregando={carregando} erro={erro} temPonto={lat != null} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
