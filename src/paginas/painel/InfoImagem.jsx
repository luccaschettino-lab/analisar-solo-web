import { useEffect, useState } from 'react'
import { CAMADAS_BASE } from '../../config/mapa.js'
import { metadadosDaImagem } from '../../dados/metadadosImagem.js'

/**
 * Diz de quando é a imagem que está na tela.
 *
 * O satélite parece atual, e não é: o mosaico do Esri traz cada região de uma
 * data diferente, às vezes de anos atrás. Quem desenha um talhão está
 * desenhando sobre o terreno daquele dia — se a cerca mudou desde então,
 * ninguém percebe. Esta linha existe para responder "isso aqui é de quando?".
 *
 * Só consulta quando a camada ativa declara `info.tipo === 'esri'`. As demais
 * ou têm data fixa e conhecida, ou não têm data nenhuma.
 */
export default function InfoImagem({ camadaAtiva, centro }) {
  const [meta, setMeta] = useState(null)
  const [consultando, setConsultando] = useState(false)

  const cfg = camadaAtiva ? CAMADAS_BASE[camadaAtiva] : null
  const info = cfg?.info ?? null

  useEffect(() => {
    if (info?.tipo !== 'esri' || !centro) {
      setMeta(null)
      return
    }

    let ativo = true
    setConsultando(true)
    metadadosDaImagem(centro.lat, centro.lng)
      .then((m) => ativo && setMeta(m))
      .finally(() => ativo && setConsultando(false))

    return () => {
      ativo = false
    }
  }, [info?.tipo, centro?.lat, centro?.lng])

  if (!info) return null

  let texto
  if (info.tipo === 'fixo') {
    texto = info.texto
  } else if (consultando) {
    texto = 'consultando a data da imagem…'
  } else if (meta) {
    const partes = [`Imagem de ${meta.data}`]
    if (meta.resolucao) partes.push(`${meta.resolucao} m/pixel`)
    if (meta.satelite) partes.push(meta.satelite)
    texto = partes.join(' · ')
  } else {
    // Não inventa: se o serviço não respondeu, diz que não sabe.
    texto = 'data da imagem não disponível aqui'
  }

  return (
    <div
      // Acima dos controles do Leaflet, colado à barra de atribuição.
      className="pointer-events-none absolute bottom-8 left-3 z-[1100] rounded bg-slate-900/70 px-2 py-1 text-[11px] text-white"
      title={
        meta?.precisaoM
          ? `Precisão de posição da imagem: ${meta.precisaoM} m. Fornecedor: ${meta.fornecedor ?? '—'}`
          : undefined
      }
    >
      {texto}
    </div>
  )
}
