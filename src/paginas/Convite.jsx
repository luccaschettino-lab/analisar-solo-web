import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Campo, BotaoPrincipal, Aviso, CabecalhoEntrada } from '../componentes/formulario.jsx'
import { IconeEmail, IconeCadeado, IconeUsuario, IconeSeta } from '../componentes/icones.jsx'
import { verConvite, aceitarConvite, criarContaPorConvite } from '../dados/equipe.js'
import { lembrarFazenda } from '../hooks/useSelecaoFazenda.js'

/**
 * Quem abre o link de convite cai aqui. Sem conta: cria (nome, e-mail, senha)
 * e já entra na fazenda. Com conta: entra com ela (ou usa a sessão aberta) e
 * aceita. Fica fora das guardas de rota: serve aos dois casos.
 */
export default function Convite() {
  const { token } = useParams()
  const { sessao, usuario, entrar, sair } = useAuth()
  const navegar = useNavigate()

  const [convite, setConvite] = useState(null)
  const [erroConvite, setErroConvite] = useState('')
  const [modo, setModo] = useState('nova') // 'nova' | 'existente'
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    verConvite(token)
      .then((c) => ativo && setConvite(c))
      .catch((e) => ativo && setErroConvite(e.message))
    return () => {
      ativo = false
    }
  }, [token])

  function concluir(resultado) {
    lembrarFazenda(resultado.fazendaId)
    navegar('/', { replace: true })
  }

  async function aceitarComSessao() {
    setErro('')
    setEnviando(true)
    try {
      concluir(await aceitarConvite(token))
    } catch (e) {
      setErro(e.message)
      setEnviando(false)
    }
  }

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      if (modo === 'nova') {
        const r = await criarContaPorConvite(token, { nome, email, senha })
        await entrar(email, senha)
        concluir(r)
      } else {
        await entrar(email, senha)
        concluir(await aceitarConvite(token))
      }
    } catch (e) {
      setErro(e.message)
      if (/já tem conta/i.test(e.message)) setModo('existente')
      setEnviando(false)
    }
  }

  if (erroConvite) {
    return (
      <div className="space-y-6">
        <CabecalhoEntrada rotulo="Convite" titulo="Link indisponível" />
        <Aviso>{erroConvite}</Aviso>
        <a href="#/login" className="inline-block text-sm font-semibold text-solo-300 hover:underline">
          Ir para a entrada do Moinho
        </a>
      </div>
    )
  }
  if (!convite) return <p className="text-sm text-slate-400">Conferindo o convite…</p>

  const apoio = `${convite.convidadoPor ? `${convite.convidadoPor} convidou você` : 'Você foi convidado(a)'} para a fazenda ${convite.fazenda}, como ${convite.cargo}.`

  if (sessao) {
    return (
      <div className="space-y-6">
        <CabecalhoEntrada rotulo="Convite" titulo={`Entrar em ${convite.fazenda}`} apoio={apoio} />
        <Aviso>{erro}</Aviso>
        <p className="text-sm text-slate-300">
          Você está conectado como <strong className="text-white">{usuario?.email}</strong>.
        </p>
        <BotaoPrincipal type="button" tom="folha" grande disabled={enviando} onClick={aceitarComSessao}>
          {enviando ? 'Entrando…' : <>Aceitar o convite <IconeSeta /></>}
        </BotaoPrincipal>
        <button type="button" onClick={() => sair()} className="text-sm font-semibold text-solo-300 hover:underline">
          Não é você? Sair e usar outra conta
        </button>
      </div>
    )
  }

  const aba = (valor, texto) => (
    <button
      type="button"
      role="tab"
      aria-selected={modo === valor}
      onClick={() => {
        setModo(valor)
        setErro('')
      }}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${modo === valor ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}
    >
      {texto}
    </button>
  )

  return (
    <form onSubmit={aoEnviar} className="space-y-6">
      <CabecalhoEntrada rotulo="Convite" titulo={`Bem-vindo à ${convite.fazenda}`} apoio={apoio} />

      <div role="tablist" className="flex gap-1 rounded-xl bg-white/5 p-1">
        {aba('nova', 'Criar minha conta')}
        {aba('existente', 'Já tenho conta')}
      </div>

      <Aviso>{erro}</Aviso>

      {modo === 'nova' && (
        <Campo id="nome" rotulo="Seu nome" icone={<IconeUsuario />} grande placeholder="Como você quer ser chamado" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required disabled={enviando} />
      )}
      <Campo id="email" rotulo="E-mail" type="email" icone={<IconeEmail />} grande placeholder="voce@fazenda.com.br" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={enviando} />
      <Campo
        id="senha"
        rotulo={modo === 'nova' ? 'Crie uma senha' : 'Senha'}
        type="password"
        icone={<IconeCadeado />}
        grande
        placeholder={modo === 'nova' ? 'Pelo menos 8 caracteres' : 'Sua senha'}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete={modo === 'nova' ? 'new-password' : 'current-password'}
        minLength={modo === 'nova' ? 8 : undefined}
        required
        disabled={enviando}
      />

      <BotaoPrincipal type="submit" tom="folha" grande disabled={enviando}>
        {enviando ? 'Entrando…' : <>{modo === 'nova' ? 'Criar conta e entrar' : 'Entrar e aceitar'} <IconeSeta /></>}
      </BotaoPrincipal>
      <p className="text-xs text-slate-500">O link vale para uma pessoa só. Depois de usar, ele deixa de funcionar.</p>
    </form>
  )
}
