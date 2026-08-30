import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { isProfileComplete } from '../lib/profile'
import RastreioPanel from '../components/RastreioPanel'
import PainelUsuarios from './PainelUsuarios'
import PainelCadastro from './PainelCadastro'
import PainelCidadesAdmin from './PainelCidadesAdmin'
import PainelVeiculos from './PainelVeiculos'
import PainelCotacoes from './PainelCotacoes'
import PainelAtendimento from './PainelAtendimento'
import { useAtendimentoNaoLidas } from '../lib/atendimento'
import { BRAND } from '../lib/brand'
import './AuthPages.css'
import './Painel.css'

function formatMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num) || value == null || value === '') return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  track: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10a2 2 0 0 1 2 2v14l-3.2-2.2L12.6 20 9.4 17.8 6 20V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  cities: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V8l6-3v15M10 20V5l10 4v11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 11h0M7 15h0M14 12h0M14 16h0M17 14h0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="9.2" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 19c1.3-2.8 3.3-4.2 5.2-4.2s3.9 1.4 5.2 4.2M13.2 14.2c1.1-.5 2.3-.7 3.5-.5 1.6.3 3 1.4 4 3.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a7 7 0 0 0-7 7v2.5A2.5 2.5 0 0 0 7.5 15H9v-4H6.2A5.8 5.8 0 0 1 12 5a5.8 5.8 0 0 1 5.8 6H15v4h1.5A2.5 2.5 0 0 0 19 12.5V10a7 7 0 0 0-7-7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 19h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7.5h11v9H3zM14 10.5h4.2L21 13.8V16.5h-7v-6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="7" cy="17.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="17.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
}

function resolveSection(pathname) {
  const rest = pathname.replace(/^\/painel\/?/, '')
  const id = rest.split('/')[0] || 'inicio'
  return id || 'inicio'
}

function PainelInicio({
  isApproved,
  canUseCotacao,
  busy,
  resumo,
  onNavigate,
}) {
  return (
    <div className="painel-section">
      <header className="painel-section-head">
        <div>
          <h2>Resumo da operação</h2>
        </div>
      </header>

      <section className="painel-cards" aria-label="Atalhos">
        {canUseCotacao ? (
          <Link to="/cotacao" className="painel-card is-action is-primary">
            <strong>Nova cotação</strong>
          </Link>
        ) : (
          <button type="button" className="painel-card is-action" onClick={() => onNavigate('cadastro')}>
            <strong>Nova cotação</strong>
          </button>
        )}
        <button type="button" className="painel-card is-action" onClick={() => onNavigate('rastreamento')}>
          <strong>Rastrear</strong>
        </button>
      </section>

      {isApproved ? (
        <section className="painel-cards painel-cards-stats" aria-label="Indicadores">
          <button
            type="button"
            className="painel-card is-stat is-clickable"
            onClick={() => onNavigate('cotacoes')}
          >
            <span>Cotações</span>
            <strong>{busy ? '…' : resumo.cotacoes}</strong>
          </button>
          <button
            type="button"
            className="painel-card is-stat is-clickable"
            onClick={() => onNavigate('cotacoes', 'aba=coletas')}
          >
            <span>Coletas</span>
            <strong>{busy ? '…' : resumo.coletas}</strong>
          </button>
          <article className="painel-card is-stat">
            <span>Último frete</span>
            <strong>{busy ? '…' : formatMoney(resumo.ultimoFrete)}</strong>
            {resumo.ultimaData ? <small>{formatDate(resumo.ultimaData)}</small> : null}
          </article>
        </section>
      ) : null}
    </div>
  )
}

function Painel() {
  const {
    user,
    loading,
    signOut,
    isMaster,
    isApproved,
    isRejected,
    canUseCotacao,
    profile,
    profileComplete,
    refreshProfile,
  } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [cotacoesCount, setCotacoesCount] = useState(0)
  const [coletasCount, setColetasCount] = useState(0)
  const [ultimaCotacao, setUltimaCotacao] = useState(null)
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(true)
  const [avisoCadastroAberto, setAvisoCadastroAberto] = useState(false)
  const avisoLoginRef = useRef('')
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState(0)
  const atendimentoNaoLidas = useAtendimentoNaoLidas(user?.id, isMaster)

  const section = resolveSection(location.pathname)

  const carregarPendenciasAprovacao = useCallback(async () => {
    if (!isMaster) {
      setAguardandoAprovacao(0)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, status, nome_completo, endereco, cpf, cnpj, telefone, whatsapp')
      .eq('status', 'pending')

    if (error) {
      console.error('Erro ao carregar pendências de aprovação:', error.message)
      return
    }

    const total = (data || []).filter(
      (item) => item.role !== 'master' && isProfileComplete(item),
    ).length
    setAguardandoAprovacao(total)
  }, [isMaster])

  useEffect(() => {
    if (!user) {
      avisoLoginRef.current = ''
      setAvisoCadastroAberto(false)
      return undefined
    }

    if (loading || !profile || isMaster || isRejected) return undefined

    if (profileComplete && isApproved) {
      setAvisoCadastroAberto(false)
      return undefined
    }

    if (avisoLoginRef.current === user.id) return undefined

    avisoLoginRef.current = user.id
    setAvisoCadastroAberto(true)
    return undefined
  }, [user, profile, loading, isMaster, isRejected, profileComplete, isApproved])

  useEffect(() => {
    if (!isMaster || !user) return undefined
    carregarPendenciasAprovacao()
    const timer = window.setInterval(carregarPendenciasAprovacao, 30000)
    return () => window.clearInterval(timer)
  }, [isMaster, user, carregarPendenciasAprovacao, section])

  const navItems = useMemo(() => {
    const items = [
      { id: 'inicio', label: 'Início', icon: ICONS.home },
      { id: 'rastreamento', label: 'Rastreamento', icon: ICONS.track },
      { id: 'cotacoes', label: 'Cotações', icon: ICONS.quote },
    ]

    if (isMaster) {
      items.push(
        {
          id: 'usuarios',
          label: 'Usuários',
          icon: ICONS.users,
          alertaAprovacao: aguardandoAprovacao > 0,
        },
        { id: 'cobertura', label: 'Cobertura', icon: ICONS.cities },
        { id: 'veiculos', label: 'Veículos', icon: ICONS.truck },
      )
    }

    items.push(
      { id: 'cadastro', label: 'Cadastro', icon: ICONS.profile },
      {
        id: 'atendimento',
        label: 'Atendimento',
        icon: ICONS.support,
        alertaAtendimento: atendimentoNaoLidas > 0,
      },
    )
    return items
  }, [isMaster, aguardandoAprovacao, atendimentoNaoLidas])

  useEffect(() => {
    setMenuOpen(false)
  }, [section])

  useEffect(() => {
    if (!user || !isApproved) return undefined

    let active = true
    setBusy(true)
    setErro('')

    Promise.all([
      supabase.from('cotacoes').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(1),
      supabase.from('coletas').select('id', { count: 'exact', head: true }),
    ])
      .then(([cotacaoRes, coletaRes]) => {
        if (!active) return
        if (cotacaoRes.error) throw cotacaoRes.error
        if (coletaRes.error) throw coletaRes.error
        setCotacoesCount(cotacaoRes.count || 0)
        setColetasCount(coletaRes.count || 0)
        setUltimaCotacao(cotacaoRes.data?.[0] || null)
      })
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível carregar o painel.')
      })
      .finally(() => {
        if (active) setBusy(false)
      })

    return () => {
      active = false
    }
  }, [user, isApproved])

  const resumo = useMemo(
    () => ({
      cotacoes: cotacoesCount,
      coletas: coletasCount,
      ultimoFrete: ultimaCotacao?.total_frete,
      ultimaData: ultimaCotacao?.created_at,
    }),
    [cotacoesCount, coletasCount, ultimaCotacao],
  )

  if (!loading && !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (
    !loading &&
    user &&
    profile &&
    !isMaster &&
    !isRejected &&
    !profileComplete &&
    section !== 'cadastro'
  ) {
    return <Navigate to="/painel/cadastro" replace />
  }

  if (
    !loading &&
    user &&
    !isMaster &&
    (section === 'usuarios' || section === 'cobertura' || section === 'veiculos')
  ) {
    return <Navigate to="/painel" replace />
  }

  const knownSections = new Set(navItems.map((item) => item.id))
  if (!loading && user && !knownSections.has(section)) {
    return <Navigate to="/painel" replace />
  }

  function goSection(id, query) {
    const path = id === 'inicio' ? '/painel' : `/painel/${id}`
    navigate(query ? `${path}?${query}` : path)
  }

  function fecharAvisoCadastro() {
    setAvisoCadastroAberto(false)
  }

  function irParaCadastro() {
    setAvisoCadastroAberto(false)
    navigate('/painel/cadastro')
  }

  const currentNav = navItems.find((item) => item.id === section) || navItems[0]

  return (
    <div className="page-shell">
    <div className="painel-page">
    <div className="painel-admin-shell">
      {avisoCadastroAberto ? (
        <div className="painel-aviso-backdrop" role="presentation" onClick={fecharAvisoCadastro}>
          <div
            className="painel-aviso-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="painel-aviso-cadastro-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="painel-aviso-cadastro-titulo">Complete o cadastro</h3>
            <p>
              {profileComplete
                ? 'Seus dados foram enviados. Aguarde a aprovação do master para ter acesso às cotações.'
                : 'Complete o cadastro da sua conta para ter acesso às cotações.'}
            </p>
            <div className="painel-aviso-actions">
              <button type="button" className="painel-section-cta is-ghost" onClick={fecharAvisoCadastro}>
                Fechar
              </button>
              <button type="button" className="painel-section-cta" onClick={irParaCadastro}>
                {profileComplete ? 'Ver cadastro' : 'Completar cadastro'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <aside className={`painel-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="painel-sidebar-brand">
          <img src={BRAND.logo} alt={BRAND.name} />
        </div>

        <nav className="painel-nav" aria-label="Menu do painel">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.id === 'inicio' ? '/painel' : `/painel/${item.id}`}
              end={item.id === 'inicio'}
              className={({ isActive }) =>
                `painel-nav-link ${isActive ? 'is-active' : ''}${
                  item.alertaAprovacao || item.alertaAtendimento ? ' has-alerta' : ''
                }`
              }
              title={
                item.alertaAprovacao
                  ? `${aguardandoAprovacao} cadastro(s) completo(s) aguardando aprovação`
                  : item.alertaAtendimento
                    ? `${atendimentoNaoLidas} mensagem(ns) não lida(s)`
                    : undefined
              }
            >
              <span
                className={`painel-nav-icon${item.alertaAprovacao || item.alertaAtendimento ? ' is-alerta' : ''}`}
              >
                {item.icon}
              </span>
              {item.label}
              {item.alertaAtendimento ? (
                <span className="painel-nav-badge">{atendimentoNaoLidas}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="painel-sidebar-foot">
          <button type="button" className="painel-login-chip" onClick={() => signOut()}>
            <span className="painel-avatar" aria-hidden="true">
              {(profile?.nome_completo || user?.email || 'J').slice(0, 1).toUpperCase()}
            </span>
            Sair da conta
          </button>
        </div>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className="painel-sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="painel-main">
        <header className={`painel-main-bar${section === 'cobertura' ? ' is-titleless' : ''}`}>
          <button
            type="button"
            className="painel-menu-toggle"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>
          {section !== 'cobertura' ? (
            <div>
              <h1>{currentNav.label}</h1>
            </div>
          ) : null}
          {section === 'cotacoes' && canUseCotacao ? (
            <Link to="/cotacao" className="painel-section-cta">
              Nova cotação
            </Link>
          ) : null}
        </header>

        <div className="painel-content">
          {isRejected && (
            <p className="auth-alert" role="alert">
              Sua conta foi recusada. Fale com o administrador Lopesul.
            </p>
          )}

          {erro && (
            <p className="auth-alert" role="alert">
              {erro}
            </p>
          )}

          {!isRejected && section === 'inicio' && (
            <PainelInicio
              isApproved={isApproved}
              canUseCotacao={canUseCotacao}
              busy={busy}
              resumo={resumo}
              onNavigate={goSection}
            />
          )}

          {!isRejected && section === 'rastreamento' && (
            <div className="painel-section">
              <header className="painel-section-head">
                <div>
                  <h2>Localize sua encomenda</h2>
                </div>
              </header>
              <RastreioPanel />
            </div>
          )}

          {!isRejected && section === 'cotacoes' && (
            <PainelCotacoes
              isApproved={isApproved}
              busyResumo={busy}
              resumo={resumo}
            />
          )}

          {!isRejected && section === 'cadastro' && profile && (
            <div className="painel-section">
              <PainelCadastro profile={profile} canDelete={!isMaster} onSaved={refreshProfile} />
            </div>
          )}

          {isMaster && section === 'veiculos' && (
            <div className="painel-section">
              <PainelVeiculos isMaster={isMaster} />
            </div>
          )}

          {isMaster && section === 'usuarios' && (
            <div className="painel-section">
              <PainelUsuarios masterId={user.id} onChanged={carregarPendenciasAprovacao} />
            </div>
          )}

          {isMaster && section === 'cobertura' && (
            <div className="painel-section">
              <PainelCidadesAdmin />
            </div>
          )}

          {!isRejected && section === 'atendimento' && user && (
            <PainelAtendimento isMaster={isMaster} user={user} />
          )}
        </div>
      </div>
    </div>
    </div>
    </div>
  )
}

export default Painel
