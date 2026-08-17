import { useState } from 'react'
import { interpretarBusca } from '../../lib/busca.js'
import { buscarLugares } from '../../dados/geocodificacao.js'

/**
 * Busca no mapa: coordenadas ou nome de lugar, no mesmo campo.
 *
 * Quem decide o tipo é o texto. Colar `-20.7546, -42.8825` leva direto; digitar
 * "Viçosa MG" consulta o serviço de lugares. O usuário não precisa saber de
 * antemão o que o sistema aceita.
 *
 * A consulta remota só dispara no envio do formulário, nunca a cada tecla —
 * é o que a política de uso do Nominatim pede, e evita rajada de requisição.
 */
export default function BuscaLocal({ aoIrPara }) {
  const [texto, setTexto] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultados, setResultados] = useState(null)
  const [inversao, setInversao] = useState(null)

  function limpar() {
    setErro('')
    setResultados(null)
    setInversao(null)
  }

  async function enviar(evento) {
    evento.preventDefault()
    limpar()

    const leitura = interpretarBusca(texto)

    if (leitura.tipo === 'erro') return setErro(leitura.motivo)

    if (leitura.tipo === 'coordenada') {
      aoIrPara({ lat: leitura.lat, lng: leitura.lng, rotulo: 'Coordenada' })
      // Não recusamos a coordenada suspeita: levamos até ela e oferecemos a
      // troca. Quem digitou pode estar certo.
      if (leitura.invertidaProvavel) setInversao({ lat: leitura.lng, lng: leitura.lat })
      return
    }

    setBuscando(true)
    try {
      const achados = await buscarLugares(leitura.consulta)
      setResultados(achados)
      if (achados.length === 1) aoIrPara(achados[0])
    } catch (e) {
      setErro(e.message)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
      <form onSubmit={enviar} className="flex gap-1 p-2">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Lugar ou -20.7546, -42.8825"
          aria-label="Buscar lugar ou coordenada"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100"
        />
        <button
          type="submit"
          disabled={buscando}
          className="shrink-0 rounded-md bg-solo-700 px-3 text-sm font-medium text-white hover:bg-solo-800 disabled:bg-slate-300"
        >
          {buscando ? '…' : 'Ir'}
        </button>
      </form>

      {erro && (
        <p role="alert" className="border-t border-slate-200 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      )}

      {inversao && (
        <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Esse ponto cai fora do Brasil. Latitude e longitude podem estar trocadas.{' '}
          <button
            onClick={() => {
              aoIrPara({ ...inversao, rotulo: 'Coordenada trocada' })
              setInversao(null)
            }}
            className="font-medium underline"
          >
            Ir para o ponto invertido
          </button>
        </div>
      )}

      {resultados && resultados.length === 0 && (
        <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          Nada encontrado. Propriedade rural quase nunca está no mapa por nome — tente
          o município, ou cole a coordenada.
        </p>
      )}

      {resultados && resultados.length > 0 && (
        <>
          <ul className="max-h-60 overflow-y-auto border-t border-slate-200">
            {resultados.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => aoIrPara(r)}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                >
                  <span className="block font-medium text-slate-800">
                    {r.nome.split(',')[0]}
                  </span>
                  <span className="block truncate text-slate-500">{r.nome}</span>
                </button>
              </li>
            ))}
          </ul>
          {/* Crédito exigido pela política de uso do Nominatim. */}
          <p className="border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-400">
            Resultados de busca ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              OpenStreetMap
            </a>
          </p>
        </>
      )}
    </div>
  )
}
