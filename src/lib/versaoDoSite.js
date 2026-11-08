/**
 * Site publicado de novo com uma aba aberta.
 *
 * As telas e o leitor de PDF são baixados sob demanda, e cada arquivo leva no
 * nome um código que muda a cada versão. Depois de uma publicação, o GitHub
 * Pages já não tem os arquivos da versão anterior: a aba antiga pede um que
 * não existe e o navegador diz "Failed to fetch dynamically imported module"
 * (Chrome/Edge), "Importing a module script failed" (Safari) ou "error loading
 * dynamically imported module" (Firefox).
 */

export const MENSAGEM_SITE_ATUALIZADO =
  'O site foi atualizado enquanto esta página estava aberta. Recarregue a página (Ctrl+F5) e tente de novo. Nada foi gravado.'

export function ehSiteDesatualizado(erro) {
  return /dynamically imported module|importing a module script failed/i.test(erro?.message ?? String(erro ?? ''))
}

const CHAVE = 'moinho-recarregou-versao'
const JANELA_MS = 30_000

/**
 * Recarrega a página UMA vez quando um arquivo da versão anterior falha
 * (evento `vite:preloadError`, disparado pelo Vite em todo import dinâmico).
 * Se acabou de recarregar e falhou de novo (sem internet, por exemplo), deixa
 * o erro seguir — a tela mostra a mensagem com o botão — em vez de entrar
 * num laço de recarregamentos.
 */
export function instalarRecarregarAoAtualizar() {
  window.addEventListener('vite:preloadError', (evento) => {
    let ultima = 0
    try {
      ultima = Number(sessionStorage.getItem(CHAVE) ?? 0)
      if (Date.now() - ultima < JANELA_MS) return
      sessionStorage.setItem(CHAVE, String(Date.now()))
    } catch {
      return
    }
    evento.preventDefault()
    window.location.reload()
  })
}
