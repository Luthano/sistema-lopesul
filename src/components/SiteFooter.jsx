import { Link } from 'react-router-dom'
import { BRAND, mailtoComercial, mailtoOperacional } from '../lib/brand'
import './SiteFooter.css'

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-wrap">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <img src={BRAND.logo} alt={BRAND.name} />
            <p>{BRAND.tagline}</p>
          </div>

          <div className="site-footer-col">
            <h3>Sistema</h3>
            <Link to="/cotacao">Cotação</Link>
            <Link to="/rastrear">Rastrear encomenda</Link>
            <Link to="/cidades-atendidas">Cidades atendidas</Link>
            <Link to="/cadastrar-veiculo">Cadastrar veículo</Link>
            <Link to="/painel">Painel</Link>
          </div>

          <div className="site-footer-col">
            <h3>Contato</h3>
            <a href={mailtoComercial()}>{BRAND.emailComercial}</a>
            <a href={mailtoOperacional()}>{BRAND.emailOperacional}</a>
            <a href={BRAND.siteUrl} target="_blank" rel="noreferrer">
              {BRAND.siteLabel}
            </a>
          </div>
        </div>

        <div className="site-footer-bottom">
          <p>© {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
