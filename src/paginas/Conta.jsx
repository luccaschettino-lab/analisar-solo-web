import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { validarSenha } from '../lib/senha.js'
import { Campo, BotaoPrincipal, Aviso } from '../componentes/formulario.jsx'

export default function Conta() {
  const { usuario, alterarSenha } = useAuth()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setOk(false)
    if (nova !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }
    const problema = validarSenha(nova)
    if (problema) {
      setErro(problema)
      return
    }
    setEnviando(true)
    try {
      await alterarSenha(atual, nova)
      setOk(true)
      setAtual('')
      setNova('')
      setConfirmacao('')
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-sm px-6 py-8">
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Minha conta</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{usuario?.email}</p>

        <form onSubmit={aoEnviar} className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Alterar senha</h2>

          <Aviso>{erro}</Aviso>
          {ok && <Aviso tipo="sucesso">Senha alterada.</Aviso>}

          <Campo
            id="senha-atual"
            rotulo="Senha atual"
            type="password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            autoComplete="current-password"
            required
            disabled={enviando}
          />
          <Campo
            id="senha-nova"
            rotulo="Nova senha"
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            disabled={enviando}
          />
          <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">Mínimo de 8 caracteres, com letras e números.</p>
          <Campo
            id="senha-confirmacao"
            rotulo="Confirmar nova senha"
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="new-password"
            required
            disabled={enviando}
          />

          <BotaoPrincipal type="submit" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Alterar senha'}
          </BotaoPrincipal>
        </form>
      </div>
    </div>
  )
}
