import { useState } from 'react'
import Abas, { PainelDeAba } from '../componentes/Abas.jsx'
import SeletorGleba from './dados/SeletorGleba.jsx'
import { useSelecaoGleba } from './dados/useSelecaoGleba.js'

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

/**
 * Vigor da lavoura por geoprocessamento, a partir de imagens do Planet.
 *
 * Ainda sem conexão: o Planet cobra pela imagem e exige uma chave de API, que
 * fica só no backend (Edge Function), nunca no código do site. A tela existe
 * pronta pra ligar assim que a chave estiver configurada — ver
 * `supabase/functions/` quando essa parte entrar.
 */
export default function Monitoramento() {
  const selecao = useSelecaoGleba()
  const [indiceAtivo, setIndiceAtivo] = useState('ndvi')
  const indice = INDICES.find((i) => i.chave === indiceAtivo)

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

        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center dark:border-white/15 dark:bg-white/5">
          <span aria-hidden="true" className="text-3xl">
            🔌
          </span>
          <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Aguardando conexão com o Planet
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            {selecao.gleba
              ? `Assim que a chave de API estiver configurada, o mapa de ${indice.rotulo} da gleba ${selecao.gleba.codigo} aparece aqui.`
              : `Escolha uma gleba acima. Assim que a chave de API estiver configurada, o mapa de ${indice.rotulo} aparece aqui.`}
          </p>
        </div>
      </div>
    </div>
  )
}
