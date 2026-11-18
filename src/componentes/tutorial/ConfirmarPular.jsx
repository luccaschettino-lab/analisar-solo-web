import Modal from '../Modal.jsx'

/**
 * Antes de pular o tutorial: recomenda continuar. "Continuar" é o botão
 * principal (e o que recebe o foco); pular fica disponível, mas discreto.
 */
export default function ConfirmarPular({ aoContinuar, aoPular }) {
  return (
    <Modal titulo="Tem certeza que quer pular?" aoFechar={aoContinuar}>
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          <strong className="text-slate-800 dark:text-slate-100">Não recomendamos pular.</strong> Em cerca de 10 minutos o
          tutorial monta com você uma fazenda de exemplo, passo a passo, e ensina tudo o que vai precisar para cadastrar a sua:
          talhões, pontos de amostra, análises e o mapa.
        </p>
        <p>Quem pula costuma travar justamente na ordem de importar os arquivos.</p>
      </div>
      {/* "Continuar" vem primeiro no código para receber o foco do Modal
          (Enter continua); na tela fica à direita. */}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
        <button
          type="button"
          onClick={aoContinuar}
          className="rounded-md bg-solo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-solo-800 dark:bg-solo-600 dark:hover:bg-solo-700"
        >
          Continuar o tutorial
        </button>
        <button
          type="button"
          onClick={aoPular}
          className="rounded-md px-3 py-2 text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
        >
          Pular mesmo assim
        </button>
      </div>
    </Modal>
  )
}
