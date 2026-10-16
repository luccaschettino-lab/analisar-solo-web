import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Campo, BotaoPrincipal, Aviso } from '../componentes/formulario.jsx'

export default function EsqueciSenha() {
  const { pedirRecuperacaoDeSenha } = useAuth()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await pedirRecuperacaoDeSenha(email)
      setEnviado(true)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Verifique seu e-mail</h1>
        {/* Mesma resposta exista a conta ou não: dizer "e-mail não cadastrado"
            deixaria qualquer um descobrir quem tem conta. */}
        <Aviso tipo="sucesso">
          Se existir uma conta para <strong>{email}</strong>, enviamos um link para criar uma nova senha. Ele vale por
          1 hora.
        </Aviso>
        <Link to="/login" className="block text-center text-sm font-medium text-solo-700 hover:underline dark:text-solo-400">
          Voltar ao login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Esqueci minha senha</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
        </p>
      </header>

      <Aviso>{erro}</Aviso>

      <Campo
        id="email"
        rotulo="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar link'}
      </BotaoPrincipal>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        <Link to="/login" className="font-medium text-solo-700 hover:underline dark:text-solo-400">
          Voltar ao login
        </Link>
      </p>
    </form>
  )
}
