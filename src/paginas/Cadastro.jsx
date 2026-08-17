import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Campo, BotaoPrincipal, Aviso } from '../componentes/formulario.jsx'

export default function Cadastro() {
  const { cadastrar } = useAuth()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')

    // Validações locais antes de gastar uma ida ao servidor.
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }
    if (senha.length < 6) {
      setErro('A senha precisa ter no mínimo 6 caracteres.')
      return
    }

    setEnviando(true)
    try {
      const { precisaConfirmarEmail } = await cadastrar(nome, email, senha)
      if (precisaConfirmarEmail) {
        setAguardandoConfirmacao(true)
        setEnviando(false)
      }
      // Caso contrário a sessão já veio: onAuthStateChange dispara, RotaPublica
      // detecta a sessão e redireciona para o painel. Nada a fazer aqui.
    } catch (e) {
      setErro(e.message)
      setEnviando(false)
    }
  }

  if (aguardandoConfirmacao) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Confirme seu e-mail</h1>
        <Aviso tipo="sucesso">
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra o link para ativar a
          conta e depois faça login.
        </Aviso>
        <Link to="/login" className="block text-center text-sm font-medium text-solo-700 hover:underline">
          Ir para o login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Criar conta</h1>
        <p className="text-sm text-slate-500">Cadastre-se para gerenciar suas fazendas.</p>
      </header>

      <Aviso>{erro}</Aviso>

      <Campo
        id="nome"
        rotulo="Nome"
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoComplete="name"
        required
        disabled={enviando}
      />
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
      <Campo
        id="senha"
        rotulo="Senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="new-password"
        minLength={6}
        required
        disabled={enviando}
      />
      <Campo
        id="confirmacao"
        rotulo="Confirmar senha"
        type="password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        autoComplete="new-password"
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" disabled={enviando}>
        {enviando ? 'Criando conta…' : 'Criar conta'}
      </BotaoPrincipal>

      <p className="text-center text-sm text-slate-500">
        Já tem conta?{' '}
        <Link to="/login" className="font-medium text-solo-700 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}
