/**
 * Placeholder da importação de laudo em PDF.
 *
 * Sem lógica de propósito: a extração está sendo feita por outro time. O
 * contrato esperado está em README.md, ao lado deste arquivo.
 *
 * A área de arrastar e soltar é desenhada mas inerte — nenhum handler de
 * drag, nenhum input de arquivo. Um alvo que aceita o arquivo e não faz nada
 * seria pior que um alvo visivelmente desligado.
 */
export default function ImportarPdf() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div
        aria-disabled="true"
        className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center"
      >
        <p className="text-3xl text-slate-300" aria-hidden="true">
          ⬆
        </p>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Arraste o laudo em PDF aqui
        </p>
        <p className="mt-1 text-sm text-slate-400">ou clique para escolher o arquivo</p>

        <button
          type="button"
          disabled
          className="mt-4 cursor-not-allowed rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
        >
          Escolher arquivo
        </button>
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">Em desenvolvimento</p>
        <p className="mt-1 text-sm text-amber-800">
          Outro time está implementando a extração por IA. Enquanto isso, lance os
          laudos pela aba <strong>Entrada manual</strong>.
        </p>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Quando estiver pronto, o PDF será lido e cada amostra virará uma análise,
        com sugestão de vínculo de gleba pelo número da amostra do laboratório —
        sempre para você conferir antes de gravar.
      </p>
    </div>
  )
}
