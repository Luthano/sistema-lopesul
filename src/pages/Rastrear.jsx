import RastreioPanel from '../components/RastreioPanel'
import './Rastrear.css'

function Rastrear() {
  return (
    <div className="page-shell">
      <div className="page-block rastrear-page">
        <header className="rastrear-hero">
          <p className="rastrear-kicker">Rastrear</p>
          <h1>Localize sua encomenda</h1>
        </header>

        <RastreioPanel />
      </div>
    </div>
  )
}

export default Rastrear
