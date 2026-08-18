import { ORIGEM, origemDasFaixas } from '../lib/criterios.js'

/**
 * Quem responde pelas cores que estão na tela.
 *
 * Aparece no rodapé das legendas do mapa e da comparação. Não é enfeite: a
 * cor de uma gleba é uma afirmação sobre a terra de alguém, e até a Fase 7 ela
 * era anônima — saía de uma tabela genérica com um aviso de que não fora
 * validada. Com conjuntos de critérios, passa a ter autor e data.
 *
 * **A assinatura é por parâmetro, não por fazenda.** Um conjunto pode
 * sobrescrever o pH e não falar do zinco; nesse caso a cor do zinco continua
 * vindo do config, e creditá-la ao consultor seria mentira — ele não escreveu
 * aquilo. Por isso a pergunta é feita a `origemDasFaixas` a cada render, com a
 * chave do parâmetro exibido.
 */
export default function AssinaturaCriterio({ criterio, chaveParametro, carregando = false }) {
  // Enquanto o conjunto viaja, o mapa já está pintando pelo padrão. Dizer
  // "padrão do sistema" nesse instante e trocar meio segundo depois seria
  // piscar uma autoria errada — melhor não afirmar nada.
  if (carregando) return null

  const origem = origemDasFaixas(chaveParametro, criterio?.parametros ?? null)

  if (origem === ORIGEM.CRITERIO) {
    const data = criterio.atualizado_em ?? criterio.criado_em
    return (
      <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-tight text-slate-600">
        <span className="font-medium text-slate-800">{criterio.nome}</span>
        {criterio.autor_nome && <span className="block">por {criterio.autor_nome}</span>}
        {data && (
          <span className="block text-slate-500">
            atualizado em {new Date(data).toLocaleDateString('pt-BR')}
          </span>
        )}
      </p>
    )
  }

  // Sem conjunto, ou com um que não fala deste parâmetro: o aviso da Fase 4
  // continua valendo, porque quem está pintando é a tabela não validada.
  return (
    <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-tight text-amber-900">
      Classificação preliminar do sistema, não validada por agrônomo.
      {criterio && (
        <span className="mt-0.5 block">
          O conjunto "{criterio.nome}" está aplicado nesta fazenda, mas não define faixas para este
          parâmetro.
        </span>
      )}
    </p>
  )
}
