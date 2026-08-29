import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { isProfileComplete } from '../lib/profile'
import { UFS_ATENDIDAS } from '../lib/ufsAtendidas'
import RastreioPanel from '../components/RastreioPanel'
import PainelUsuarios from './PainelUsuarios'
import PainelCadastro from './PainelCadastro'
import PainelDacte from './PainelDacte'
import PainelEtiquetas from './PainelEtiquetas'
import PainelCidadesAdmin from './PainelCidadesAdmin'
import PainelVeiculos from './PainelVeiculos'
import PainelCotacoes from './PainelCotacoes'
import { BRAND, mailtoComercial, mailtoOperacional } from '../lib/brand'
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
  dacte: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3.5V8h4.5M8.5 12h7M8.5 15.5h7M8.5 19h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  tags: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 12.5 12 4h6.5V10.5L10.5 20.5 3.5 12.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="15.2" cy="8.8" r="1.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
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
  profileComplete,
  busy,
  resumo,
  onNavigate,
}) {
  return (
    <div className="painel-section">
      <header className="painel-section-head">
        <div>
          <h2>Resumo da operação</h2>
          <p>Acompanhe atalhos e o movimento recente da sua conta.</p>
        </div>
      </header>

      <section className="painel-cards" aria-label="Atalhos">
        {canUseCotacao ? (
          <Link to="/cotacao" className="painel-card is-action is-primary">
            <strong>Nova cotação</strong>
            <span>Calcular frete e gravar no SSW</span>
          </Link>
        ) : (
          <button type="button" className="painel-card is-action" onClick={() => onNavigate('cadastro')}>
            <strong>Nova cotação</strong>
            <span>
              {profileComplete
                ? 'Aguarde a aprovação do master para cotar.'
                : 'Complete o cadastro para liberar as cotações.'}
            </span>
          </button>
        )}
        <button type="button" className="painel-card is-action" onClick={() => onNavigate('rastreamento')}>
          <strong>Rastrear</strong>
          <span>Localizar encomenda por DANFE ou NF</span>
        </button>
        <button type="button" className="painel-card is-action" onClick={() => onNavigate('cidades')}>
          <strong>Cidades</strong>
          <span>Consultar cobertura Lopesul</span>
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
            <small>Ver histórico</small>
          </button>
          <article className="painel-card is-stat">
            <span>Coletas</span>
            <strong>{busy ? '…' : resumo.coletas}</strong>
            <small>Total na conta</small>
          </article>
          <article className="painel-card is-stat">
            <span>Último frete</span>
            <strong>{busy ? '…' : formatMoney(resumo.ultimoFrete)}</strong>
            <small>{resumo.ultimaData ? formatDate(resumo.ultimaData) : 'Sem registros'}</small>
          </article>
        </section>
      ) : null}
    </div>
  )
}

function PainelCidades() {
  const [ufs, setUfs] = useState([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/cidades?meta=ufs')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.ufs)) setUfs(data.ufs)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="painel-section">
      <header className="painel-section-head">
        <div>
          <h2>Cobertura Lopesul</h2>
          <p>Estados com municípios cadastrados e consulta completa.</p>
        </div>
        <Link to="/cidades-atendidas" className="painel-section-cta">
          Abrir consulta completa
        </Link>
      </header>

      <div className="painel-uf-grid">
        {(ufs.length ? ufs : UFS_ATENDIDAS.slice(0, 8)).map((uf) => (
          <Link key={uf} to="/cidades-atendidas" className="painel-uf-card">
            <strong>{uf}</strong>
            <span>Ver cidades</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function PainelAtendimento() {
  return (
    <div className="painel-section">
      <header className="painel-section-head">
        <div>
          <h2>Fale com a Lopesul</h2>
          <p>Canais para suporte comercial e operacional.</p>
        </div>
      </header>

      <div className="painel-support-grid">
        <article className="painel-support-card">
          <strong>Comercial</strong>
          <p>Cotações, tabelas e onboarding de clientes.</p>
          <a href={mailtoComercial()}>{BRAND.emailComercial}</a>
        </article>
        <article className="painel-support-card">
          <strong>Operacional</strong>
          <p>Coletas, prazos e ocorrências de transporte.</p>
          <a href={mailtoOperacional()}>{BRAND.emailOperacional}</a>
        </article>
        <article className="painel-support-card">
          <strong>Site</strong>
          <p>Conteúdo institucional e canais oficiais.</p>
          <a href={BRAND.siteUrl} target="_blank" rel="noreferrer">
            {BRAND.siteLabel}
          </a>
        </article>
      </div>
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
    isPending,
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
      { id: 'dacte', label: 'DACTE', icon: ICONS.dacte },
      { id: 'etiquetas', label: 'Etiquetas', icon: ICONS.tags },
      { id: 'cotacoes', label: 'Cotações', icon: ICONS.quote },
      { id: 'cidades', label: 'Cidades', icon: ICONS.cities },
      { id: 'veiculos', label: 'Veículos', icon: ICONS.truck },
      { id: 'cadastro', label: 'Cadastro', icon: ICONS.profile },
      { id: 'atendimento', label: 'Atendimento', icon: ICONS.support },
    ]
    if (isMaster) {
      items.splice(5, 0, {
        id: 'usuarios',
        label: 'Usuários',
        icon: ICONS.users,
        alertaAprovacao: aguardandoAprovacao > 0,
      })
      items.splice(7, 0, { id: 'cobertura', label: 'Cobertura', icon: ICONS.cities })
    }
    return items
  }, [isMaster, aguardandoAprovacao])

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

  if (!loading && user && (section === 'usuarios' || section === 'cobertura') && !isMaster) {
    return <Navigate to="/painel" replace />
  }

  const knownSections = new Set(navItems.map((item) => item.id))
  if (!loading && user && !knownSections.has(section)) {
    return <Navigate to="/painel" replace />
  }

  function goSection(id) {
    navigate(id === 'inicio' ? '/painel' : `/painel/${id}`)
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
          <img src={BRAND.icon} alt="" />
          <div>
            <strong>{BRAND.name}</strong>
            <span>{isMaster ? 'Painel master' : 'Painel do cliente'}</span>
          </div>
        </div>

        <nav className="painel-nav" aria-label="Menu do painel">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.id === 'inicio' ? '/painel' : `/painel/${item.id}`}
              end={item.id === 'inicio'}
              className={({ isActive }) =>
                `painel-nav-link ${isActive ? 'is-active' : ''}${item.alertaAprovacao ? ' has-alerta' : ''}`
              }
              title={
                item.alertaAprovacao
                  ? `${aguardandoAprovacao} cadastro(s) completo(s) aguardando aprovação`
                  : undefined
              }
            >
              <span className={`painel-nav-icon${item.alertaAprovacao ? ' is-alerta' : ''}`}>{item.icon}</span>
              {item.label}
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
        <header className="painel-main-bar">
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
          <div>
            <h1>{currentNav.label}</h1>
          </div>
        </header>

        <div className="painel-content">
          {isRejected && (
            <p className="auth-alert" role="alert">
              Sua conta foi recusada. Fale com o administrador Lopesul.
            </p>
          )}

          {isPending && profileComplete && section === 'inicio' && (
            <p className="auth-info">Dados enviados. Aguarde a aprovação do master para usar as cotações.</p>
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
              profileComplete={profileComplete}
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
                  <p>Consulte por chave DANFE ou NF + CPF/CNPJ.</p>
                </div>
              </header>
              <RastreioPanel />
            </div>
          )}

          {!isRejected && section === 'dacte' && <PainelDacte />}

          {!isRejected && section === 'etiquetas' && <PainelEtiquetas />}

          {!isRejected && section === 'cotacoes' && (
            <PainelCotacoes
              canUseCotacao={canUseCotacao}
              profileComplete={profileComplete}
              isApproved={isApproved}
              busyResumo={busy}
              resumo={resumo}
            />
          )}

          {!isRejected && section === 'cidades' && <PainelCidades />}

          {!isRejected && section === 'cadastro' && profile && (
            <div className="painel-section">
              <header className="painel-section-head">
                <div>
                  <h2>Dados da conta</h2>
                  <p>Mantenha telefone, documentos e endereço atualizados.</p>
                </div>
              </header>
              <PainelCadastro profile={profile} canDelete={!isMaster} onSaved={refreshProfile} />
            </div>
          )}

          {!isRejected && section === 'veiculos' && (
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

          {!isRejected && section === 'atendimento' && <PainelAtendimento />}
        </div>
      </div>
    </div>
  )
}

export default Painel
