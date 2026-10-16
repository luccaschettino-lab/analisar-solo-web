import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { validarSenha } from '../lib/senha.js'
import { Campo, BotaoPrincipal, Aviso } from '../componentes/formulario.jsx'

/**
 * Destino do link do e-mail de recuperação. Só abre quando o Supabase confirmou
 * o link (evento PASSWORD_RECOVERY) — aberta direto, sem link, volta ao login.
 */
export default function NovaSenha() {
  const { recuperando, carregando, definirNovaSenha } = useAuth()
  const navegar = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (carregando) return <p className="text-center text-sm text-slate-400">Carregando…</p>
  if (!recuperando) return <Navigate to="/login" replace />

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }
    const problema = validarSenha(senha)
    if (problema) {
      setErro(problema)
      return
    }
    setEnviando(true)
    try {
      await definirNovaSenha(senha)
      navegar('/', { replace: true })
    } catch (e) {
      setErro(e.message)
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Criar nova senha</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Escolha a senha que você vai usar daqui para frente.</p>
      </header>

      <Aviso>{erro}</Aviso>

      <Campo
        id="senha"
        rotulo="Nova senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
        disabled={enviando}
      />
      <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">Mínimo de 8 caracteres, com letras e números.</p>
      <Campo
        id="confirmacao"
        rotulo="Confirmar nova senha"
        type="password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        autoComplete="new-password"
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar nova senha'}
      </BotaoPrincipal>
    </form>
  )
}
