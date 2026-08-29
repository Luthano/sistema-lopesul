import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BRAND } from '../lib/brand'
import './AuthPages.css'

function Login() {
  const { configured, user, loading, signIn, signUp, profileComplete, isMaster, isRejected, profile } =
    useAuth()
  const location = useLocation()
  const redirectTo = location.state?.from || '/painel'
  const [modo, setModo] = useState('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [sending, setSending] = useState(false)

  if (!loading && user) {
    const precisaCadastro = Boolean(profile) && !isMaster && !isRejected && !profileComplete
    return <Navigate to={precisaCadastro ? '/painel/cadastro' : redirectTo} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setInfo('')
    setSending(true)

    try {
      if (modo === 'entrar') {
        const { error } = await signIn(email.trim(), password)
        if (error) throw error
      } else {
        const { data, error } = await signUp(email.trim(), password)
        if (error) throw error
        if (!data.session) {
          setInfo('Conta criada. Confirme o e-mail, entre no painel e complete seus dados para liberar as cotações.')
        } else {
          setInfo('Conta criada. Complete seus dados no painel para solicitar o acesso às cotações.')
        }
      }
    } catch (error) {
      setErro(error.message || 'Não foi possível autenticar.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page-shell auth-page">
      <div className="auth-frame">
        <img className="auth-logo" src={BRAND.logo} alt={BRAND.name} />
        <form className="auth-card" onSubmit={handleSubmit}>
        <p className="auth-kicker">{modo === 'entrar' ? 'Acesso' : 'Cadastro'}</p>
        <h1>{modo === 'entrar' ? 'Entrar na conta' : 'Criar conta'}</h1>

        {!configured && (
          <p className="auth-alert" role="alert">
            Faltam as chaves do Supabase neste ambiente. Na Vercel, cadastre VITE_SUPABASE_URL e
            VITE_SUPABASE_PUBLISHABLE_KEY e faça um novo deploy.
          </p>
        )}

        <label>
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Senha</span>
          <input
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        {erro && (
          <p className="auth-alert" role="alert">
            {erro}
          </p>
        )}
        {info && <p className="auth-info">{info}</p>}

        <button type="submit" className="auth-submit" disabled={sending || !configured}>
          {sending ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setModo((prev) => (prev === 'entrar' ? 'cadastrar' : 'entrar'))
            setErro('')
            setInfo('')
          }}
        >
          {modo === 'entrar' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
        </form>
      </div>
    </div>
  )
}

export default Login
