import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RequireAuth, RootRedirect } from './components/RequireAuth'
import Cotacao from './pages/Cotacao'
import Rastrear from './pages/Rastrear'
import CidadesAtendidas from './pages/CidadesAtendidas'
import Login from './pages/Login'
import Historico from './pages/Historico'
import Painel from './pages/Painel'
import SiteFooter from './components/SiteFooter'
import { BRAND } from './lib/brand'
import './App.css'

const TABS = [
  { to: '/cotacao', label: 'Cotação', short: 'Cotação' },
  { to: '/rastrear', label: 'Rastrear', short: 'Rastrear' },
  { to: '/cidades-atendidas', label: 'Cidades atendidas', short: 'Cidades' },
  { to: '/painel', label: 'Painel', short: 'Painel' },
]

function isTabActive(pathname, to) {
  if (to === '/painel') return pathname === '/painel' || pathname.startsWith('/painel/')
  return pathname === to || pathname.startsWith(`${to}/`)
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

function AppHeader({ scrolled }) {
  const { pathname } = useLocation()
  const { user, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const showNav = !loading && Boolean(user)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <header className={`app-header ${scrolled ? 'is-scrolled' : ''} ${menuOpen ? 'is-menu-open' : ''}`}>
      <div className="app-header-bar">
      <Link to={user ? '/cotacao' : '/login'} className="app-brand">
        <img className="app-brand-logo" src={BRAND.logo} alt={BRAND.name} />
      </Link>

      {showNav ? (
        <>
          <nav className="tabs tabs-desktop" aria-label="Navegação principal">
            {TABS.map((tab) => {
              const active = isTabActive(pathname, tab.to)
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={active ? 'tab is-active' : 'tab'}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="tab-label-full">{tab.label}</span>
                  <span className="tab-label-short">{tab.short}</span>
                </Link>
              )
            })}
          </nav>

          <button
            type="button"
            className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>
        </>
      ) : null}
      </div>

      {showNav ? (
        <>
          <div
            className={`menu-backdrop ${menuOpen ? 'is-open' : ''}`}
            aria-hidden={!menuOpen}
            onClick={() => setMenuOpen(false)}
          />

          <nav
            id="menu-mobile"
            className={`menu-mobile ${menuOpen ? 'is-open' : ''}`}
            aria-label="Menu mobile"
            aria-hidden={!menuOpen}
          >
            {TABS.map((tab) => {
              const active = isTabActive(pathname, tab.to)
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={active ? 'menu-mobile-link is-active' : 'menu-mobile-link'}
                  aria-current={active ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </>
      ) : null}
    </header>
  )
}

function AppShell() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="app-shell">
      <AppHeader scrolled={scrolled} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/hub-logistico" element={<RootRedirect />} />
          <Route path="/cadastrar-veiculo" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/rastrear"
            element={
              <RequireAuth>
                <Rastrear />
              </RequireAuth>
            }
          />
          <Route
            path="/cotacao"
            element={
              <RequireAuth>
                <Cotacao />
              </RequireAuth>
            }
          />
          <Route
            path="/cidades-atendidas"
            element={
              <RequireAuth>
                <CidadesAtendidas />
              </RequireAuth>
            }
          />
          <Route
            path="/painel/*"
            element={
              <RequireAuth>
                <Painel />
              </RequireAuth>
            }
          />
          <Route
            path="/historico"
            element={
              <RequireAuth>
                <Historico />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
