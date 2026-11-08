import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

// URL de volta usada nos e-mails do Supabase (recuperação de senha).
// BASE_URL vem do vite.config.js, então isso resolve para
// http://localhost:5173/analisar-solo-web/ em dev e para o endereço do
// GitHub Pages em produção, sem precisar de variável extra.
const urlDeRetorno = () => `${window.location.origin}${import.meta.env.BASE_URL}`

// Marca posta no link do e-mail de recuperação de senha. O Supabase acrescenta
// o `?code=...` a esse endereço; a marca diz ao app que a sessão que vai nascer
// desse código é para trocar a senha, mesmo que o evento PASSWORD_RECOVERY
// chegue antes de a tela estar escutando.
const MARCA_RECUPERACAO = 'recuperar'
const urlDeRecuperacao = () => `${urlDeRetorno()}?${MARCA_RECUPERACAO}=1`
const veioDoLinkDeRecuperacao = () => new URLSearchParams(window.location.search).has(MARCA_RECUPERACAO)

// Erro que o Supabase devolve no endereço quando o link venceu ou já foi usado.
function erroDoLink() {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#\/?/, '').split('?').pop())
  const descricao = params.get('error_description') ?? hash.get('error_description')
  const codigo = params.get('error_code') ?? hash.get('error_code')
  if (!descricao && !codigo) return null
  if (codigo === 'otp_expired' || /expired|invalid/i.test(descricao ?? '')) {
    return 'Este link venceu ou já foi usado. Peça um novo.'
  }
  return 'Não foi possível usar este link. Peça um novo.'
}

/**
 * Link de e-mail que o app trata por conta própria, lido UMA vez ao carregar.
 *
 * O convite feito pelo painel do Supabase (Authentication > Users > Invite
 * user) volta com a sessão no fim do endereço (`#access_token=…&type=invite`),
 * o fluxo "implicit". O cliente deste app usa PKCE e recusa esse formato
 * ("Not a valid PKCE flow url"): quem fosse convidado cairia no login sem
 * conseguir entrar. O modelo de e-mail com `token_hash` (o recomendado pelo
 * Supabase para PKCE) chega como `?token_hash=…&type=invite`. Os dois são
 * aceitos aqui.
 *
 * O `?code=…` da recuperação de senha pedida pelo próprio app NÃO entra: esse
 * é PKCE de verdade e o supabase-js troca o código sozinho.
 */
function lerLinkDoEmail() {
  const busca = new URLSearchParams(window.location.search)
  if (busca.get('token_hash') && busca.get('type')) {
    return { formato: 'token_hash', tokenHash: busca.get('token_hash'), tipo: busca.get('type') }
  }
  const bruto = window.location.hash.replace(/^#/, '')
  if (bruto && !bruto.startsWith('/')) {
    const hash = new URLSearchParams(bruto)
    if (hash.get('access_token') && hash.get('refresh_token')) {
      return {
        formato: 'sessao',
        accessToken: hash.get('access_token'),
        refreshToken: hash.get('refresh_token'),
        tipo: hash.get('type') ?? '',
      }
    }
    if (hash.get('error') || hash.get('error_code')) return { formato: 'erro', tipo: hash.get('type') ?? '' }
  }
  return null
}

// Lido antes de o roteador montar: `#access_token=…` no lugar da rota faria o
// roteador (por hash) mostrar "página não encontrada".
const LINK_DO_EMAIL = lerLinkDoEmail()
const ERRO_DO_LINK = erroDoLink()
const PEDE_SENHA = (tipo) => tipo === 'invite' || tipo === 'recovery'
if (LINK_DO_EMAIL) {
  const destino = PEDE_SENHA(LINK_DO_EMAIL.tipo) || LINK_DO_EMAIL.formato === 'erro' ? '#/nova-senha' : '#/'
  window.history.replaceState(null, '', `${import.meta.env.BASE_URL}${destino}`)
}

// Tira do endereço a marca, o código e o erro, mantendo a rota do hash.
function limparEnderecoDaRecuperacao() {
  window.history.replaceState(null, '', `${import.meta.env.BASE_URL}${window.location.hash}`)
}

// O Supabase responde em inglês e com mensagens genéricas por decisão de
// segurança (não revela se o e-mail existe). Traduzimos o que é acionável.
function traduzirErro(erro) {
  const msg = erro?.message ?? ''
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.'
  if (/user already registered/i.test(msg)) return 'Já existe uma conta com este e-mail.'
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter no mínimo 8 caracteres, com letras e números.'
  if (/unable to validate email/i.test(msg)) return 'E-mail inválido.'
  if (/rate limit|too many requests/i.test(msg)) return 'Muitas tentativas. Aguarde um minuto.'
  // Falha de rede mostra o endereço tentado. Sem isso, um erro de digitação na
  // URL do Supabase vira "sem conexão" genérico, e a causa só aparece no
  // console do navegador — foi exatamente o que aconteceu com um `.supabase.com`
  // no lugar de `.supabase.co` na primeira publicação.
  if (/failed to fetch|networkerror/i.test(msg)) {
    return `Sem conexão com o servidor (${servidorConfigurado()}).`
  }
  return msg || 'Não foi possível concluir a operação.'
}

function servidorConfigurado() {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).host
  } catch {
    return 'endereço inválido'
  }
}

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null)
  // Começa true: até sabermos se há sessão salva, não dá para decidir se o
  // usuário fica na rota ou vai para o login. Sem isso, um F5 em uma rota
  // protegida joga o usuário logado para a tela de login por um instante.
  const [carregando, setCarregando] = useState(true)
  // A pessoa abriu o link de "esqueci minha senha": a sessão existe, mas antes
  // de qualquer outra tela ela precisa escolher a senha nova.
  // Também liga para quem chega por convite: a conta existe, a senha não.
  const [recuperando, setRecuperando] = useState(
    () => veioDoLinkDeRecuperacao() || PEDE_SENHA(LINK_DO_EMAIL?.tipo) || LINK_DO_EMAIL?.formato === 'erro',
  )
  const [convite] = useState(() => LINK_DO_EMAIL?.tipo === 'invite')
  const [erroRecuperacao, setErroRecuperacao] = useState(ERRO_DO_LINK)

  useEffect(() => {
    let ativo = true

    async function iniciar() {
      // Convite (ou outro link de e-mail) no formato que o PKCE recusa: o app
      // abre a sessão com o que veio no link, antes de ler a sessão salva.
      if (LINK_DO_EMAIL?.formato === 'token_hash' || LINK_DO_EMAIL?.formato === 'sessao') {
        const { error } =
          LINK_DO_EMAIL.formato === 'token_hash'
            ? await supabase.auth.verifyOtp({ token_hash: LINK_DO_EMAIL.tokenHash, type: LINK_DO_EMAIL.tipo })
            : await supabase.auth.setSession({
                access_token: LINK_DO_EMAIL.accessToken,
                refresh_token: LINK_DO_EMAIL.refreshToken,
              })
        if (error && ativo) {
          setErroRecuperacao(
            LINK_DO_EMAIL.tipo === 'invite'
              ? 'Este convite venceu ou já foi usado. Peça um novo convite a quem administra o sistema.'
              : 'Este link venceu ou já foi usado. Peça um novo.',
          )
        }
      }

      // Sessão persistida no localStorage (pode incluir refresh do token).
      const { data } = await supabase.auth.getSession()
      if (!ativo) return
      setSessao(data.session)
      setCarregando(false)
    }
    iniciar()

    // Mantém o estado em dia depois disso: login, logout, refresh de token e
    // logout feito em outra aba do navegador.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao)
      setCarregando(false)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      if (evento === 'SIGNED_OUT') setRecuperando(false)
    })

    return () => {
      ativo = false
      subscription.unsubscribe()
    }
  }, [])

  const valor = useMemo(
    () => ({
      sessao,
      usuario: sessao?.user ?? null,
      carregando,
      recuperando,
      convite,
      erroRecuperacao,

      /**
       * Manda o e-mail com o link para criar uma senha nova. Não diz se o
       * e-mail tem conta (a tela mostra a mesma mensagem nos dois casos).
       *
       * O endereço de volta precisa estar em Authentication > URL
       * Configuration > Redirect URLs no Supabase, senão o link cai no Site URL
       * sem a marca (o evento PASSWORD_RECOVERY ainda leva à tela certa).
       */
      async pedirRecuperacaoDeSenha(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: urlDeRecuperacao(),
        })
        if (error) throw new Error(traduzirErro(error))
      },

      /** Grava a senha nova de quem abriu o link de recuperação. */
      async definirNovaSenha(senha) {
        const { error } = await supabase.auth.updateUser({ password: senha })
        if (error) {
          if (/session missing|not authenticated/i.test(error.message ?? '')) {
            throw new Error('O link venceu antes de você salvar. Peça um novo em "Esqueci minha senha".')
          }
          if (/should be different|same.*password/i.test(error.message ?? '')) {
            throw new Error('A senha nova precisa ser diferente da antiga.')
          }
          throw new Error(traduzirErro(error))
        }
        setRecuperando(false)
        limparEnderecoDaRecuperacao()
      },

      /** Desiste de trocar a senha: sai da sessão aberta pelo link. */
      async cancelarRecuperacao() {
        setRecuperando(false)
        limparEnderecoDaRecuperacao()
        await supabase.auth.signOut()
      },

      async entrar(email, senha) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        })
        if (error) throw new Error(traduzirErro(error))
      },

      /**
       * Confere a senha de quem está logado, antes de uma exclusão. O Supabase
       * não tem um "só conferir senha": entrar de novo com o mesmo e-mail é o
       * jeito, e a sessão continua a mesma pessoa. Senha errada lança erro.
       *
       * É uma barreira da tela contra exclusão por engano ou por alguém no
       * computador destravado; o banco continua aceitando a exclusão de quem
       * tem a sessão (ver docs/decisoes.md).
       */
      async confirmarSenha(senha) {
        const email = sessao?.user?.email
        if (!email) throw new Error('Sessão expirada. Entre de novo.')
        if (!senha) throw new Error('Digite sua senha para confirmar.')
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) {
          if (/invalid login credentials/i.test(error.message ?? '')) throw new Error('Senha incorreta.')
          throw new Error(traduzirErro(error))
        }
      },

      async sair() {
        const { error } = await supabase.auth.signOut()
        if (error) throw new Error(traduzirErro(error))
      },
    }),
    [sessao, carregando, recuperando, convite, erroRecuperacao],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  return ctx
}
