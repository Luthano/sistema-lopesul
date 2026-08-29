import { useEffect, useMemo, useState } from 'react'
import VolumesForm from './VolumesForm'
import CotacaoResultado from './CotacaoResultado'
import CotacaoColetaForm from './CotacaoColetaForm'
import {
  agregarVolumes,
  criarVolumeVazio,
  volumeLinhaValido,
} from './cotacaoVolumes'
import { Link } from 'react-router-dom'
import { authFetch } from '../lib/authFetch'
import { useAuth } from '../context/AuthContext'
import './Cotacao.css'

const INITIAL_FORM = {
  cnpjPagador: '',
  cnpjDestinatario: '',
  cnpjRemetente: '',
  cepOrigem: '',
  cepDestino: '',
  valorNF: '',
  qtdePares: '',
  mercadoria: '1',
  coletar: 'S',
  entDificil: 'N',
  destContribuinte: 'S',
}

function formatMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function isValidCpfCnpj(value) {
  const digits = onlyDigits(value)
  return digits.length === 11 || digits.length === 14
}

function ToggleGroup({ label, value, onChange, yesLabel = 'Sim', noLabel = 'Não' }) {
  return (
    <div className="field field-toggle">
      <span>{label}</span>
      <div className="toggle-group" role="group" aria-label={label}>
        <button
          type="button"
          className={value === 'S' ? 'toggle active' : 'toggle'}
          onClick={() => onChange('S')}
        >
          {yesLabel}
        </button>
        <button
          type="button"
          className={value === 'N' ? 'toggle active' : 'toggle'}
          onClick={() => onChange('N')}
        >
          {noLabel}
        </button>
      </div>
    </div>
  )
}

function Cotacao() {
  const { user, loading: authLoading, canUseCotacao, profileComplete, isRejected } = useAuth()
  const [form, setForm] = useState(INITIAL_FORM)
  const [transportadoras, setTransportadoras] = useState([])
  const [volumes, setVolumes] = useState([criarVolumeVazio()])
  const [mercadorias, setMercadorias] = useState([{ codigo: 1, descricao: 'DIVERSOS' }])
  const [loadingMercadorias, setLoadingMercadorias] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState(null)
  const [ofertaSelecionadaId, setOfertaSelecionadaId] = useState(null)
  const [coletaAberta, setColetaAberta] = useState(false)
  const [coletaGerada, setColetaGerada] = useState(null)

  const totais = useMemo(() => agregarVolumes(volumes), [volumes])

  const ofertaSelecionada = useMemo(() => {
    const ofertas = (resultado?.ofertas || []).filter((o) => o.sucesso)
    return ofertas.find((o) => o.transportadoraId === ofertaSelecionadaId) || null
  }, [resultado, ofertaSelecionadaId])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/transportadoras')
        const data = await res.json()
        if (!cancelled && Array.isArray(data.transportadoras)) {
          setTransportadoras(data.transportadoras)
        }
      } catch {
        // lista opcional
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const documento = onlyDigits(form.cnpjPagador)
    if (documento.length !== 11 && documento.length !== 14) return undefined

    const timer = setTimeout(async () => {
      setLoadingMercadorias(true)
      try {
        const res = await authFetch(`/api/mercadorias?cnpjPagador=${documento}`)
        const data = await res.json()
        if (data.mercadorias?.length) {
          setMercadorias(data.mercadorias)
          setForm((prev) => ({
            ...prev,
            mercadoria: String(data.mercadorias[0].codigo),
          }))
        }
      } catch {
        // Mantém mercadoria padrão
      } finally {
        setLoadingMercadorias(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [form.cnpjPagador])

  useEffect(() => {
    if (!coletaAberta) return undefined
    requestAnimationFrame(() => {
      document.getElementById('formulario-coleta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return undefined
  }, [coletaAberta])

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setResultado(null)
    setOfertaSelecionadaId(null)
    setColetaAberta(false)
    setColetaGerada(null)

    if (user && !canUseCotacao) {
      setErro('Complete seus dados no painel e aguarde a aprovação para cotar.')
      return
    }

    if (!isValidCpfCnpj(form.cnpjPagador)) {
      setErro('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) do pagador.')
      return
    }

    const dest = onlyDigits(form.cnpjDestinatario)
    if (dest && !isValidCpfCnpj(dest)) {
      setErro('CPF/CNPJ do destinatário inválido.')
      return
    }

    const remet = onlyDigits(form.cnpjRemetente)
    if (remet && !isValidCpfCnpj(remet)) {
      setErro('CPF/CNPJ do remetente inválido.')
      return
    }

    if (!volumes.every(volumeLinhaValido)) {
      setErro('Cada volume precisa de quantidade e peso ou medidas (altura × largura × comprimento).')
      return
    }

    if (totais.quantidade <= 0 || (totais.peso <= 0 && totais.volume <= 0)) {
      setErro('Informe ao menos um volume com peso ou cubagem.')
      return
    }

    setLoading(true)

    try {
      const res = await authFetch('/api/cotacao', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          valorNF: Number(form.valorNF),
          qtdePares: form.qtdePares ? Number(form.qtdePares) : undefined,
          mercadoria: Number(form.mercadoria) || 1,
          quantidade: totais.quantidade,
          peso: totais.peso,
          volume: totais.volume,
        }),
      })

      const data = await res.json()

      if (!data.sucesso) {
        setErro(data.mensagem || 'A Lopesul não atende esta rota com os dados informados.')
        setResultado(null)
        return
      }

      setResultado(data)
      const primeiraOk = (data.ofertas || []).find((o) => o.sucesso)
      setOfertaSelecionadaId(primeiraOk?.transportadoraId || data.transportadoraId || null)
      setColetaAberta(false)
      setColetaGerada(null)
      if (data.alerta && data.mensagem) {
        setErro(data.mensagem)
      }

      requestAnimationFrame(() => {
        document.getElementById('resultado-cotacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (error) {
      setErro(error.message || 'Erro de comunicação com a API.')
    } finally {
      setLoading(false)
    }
  }

  function selecionarOferta(id) {
    setOfertaSelecionadaId(id)
    setColetaAberta(false)
    setColetaGerada(null)
  }

  function abrirColeta() {
    setColetaAberta(true)
  }

  if (!authLoading && user && !canUseCotacao) {
    return (
      <div className="page-shell">
        <div className="page-block cotacao-page">
        <p className="cotacao-kicker">Cotação online</p>
        <section className="form-section cotacao-bloqueio">
          <h2>Acesso às cotações</h2>
          {isRejected ? (
            <p>Sua conta foi recusada. Fale com o administrador Lopesul.</p>
          ) : (
            <p>
              {profileComplete
                ? 'Seus dados já foram enviados. Aguarde a aprovação do master para calcular fretes.'
                : 'Para usar as cotações, preencha no painel: nome completo, endereço, CPF, CNPJ, telefone da conta e WhatsApp.'}
            </p>
          )}
          <Link to="/painel" className="cotacao-bloqueio-link">
            Ir para o painel
          </Link>
        </section>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-block cotacao-page">
      <p className="cotacao-kicker">Cotação online</p>

      <form className="cotacao-layout" onSubmit={handleSubmit}>
        <div className="cotacao-main">
          <section className="form-section">
            <div className="section-heading">
              <span className="section-step">1</span>
              <div>
                <h2>Quem paga o frete</h2>
              </div>
            </div>

            <div className="fields-grid">
              <label className="field field-span-2">
                <span>CPF ou CNPJ do pagador *</span>
                <input
                  required
                  value={form.cnpjPagador}
                  onChange={(e) => updateField('cnpjPagador', e.target.value)}
                  placeholder="Digite somente números"
                  inputMode="numeric"
                />
              </label>

              <label className="field">
                <span>Remetente (opcional)</span>
                <input
                  value={form.cnpjRemetente}
                  onChange={(e) => updateField('cnpjRemetente', e.target.value)}
                  placeholder="CPF ou CNPJ"
                  inputMode="numeric"
                />
              </label>
              <label className="field">
                <span>Destinatário (opcional)</span>
                <input
                  value={form.cnpjDestinatario}
                  onChange={(e) => updateField('cnpjDestinatario', e.target.value)}
                  placeholder="CPF ou CNPJ"
                  inputMode="numeric"
                />
              </label>
              <label className="field field-span-2">
                <span>Tipo de mercadoria *</span>
                <select
                  value={form.mercadoria}
                  onChange={(e) => updateField('mercadoria', e.target.value)}
                  disabled={loadingMercadorias}
                >
                  {mercadorias.map((item) => (
                    <option key={item.codigo} value={item.codigo}>
                      {item.descricao}
                    </option>
                  ))}
                </select>
                {loadingMercadorias && <small className="field-hint">Buscando mercadorias…</small>}
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <span className="section-step">2</span>
              <div>
                <h2>Rota e serviço</h2>
              </div>
            </div>

            <div className="fields-grid">
              <label className="field">
                <span>CEP de origem *</span>
                <input
                  required
                  value={form.cepOrigem}
                  onChange={(e) => updateField('cepOrigem', e.target.value)}
                  placeholder="00000-000"
                />
              </label>
              <label className="field">
                <span>CEP de destino *</span>
                <input
                  value={form.cepDestino}
                  onChange={(e) => updateField('cepDestino', e.target.value)}
                  placeholder="00000-000"
                  required
                />
              </label>
              <ToggleGroup
                label="Precisa de coleta?"
                value={form.coletar}
                onChange={(v) => updateField('coletar', v)}
              />
              <ToggleGroup
                label="Entrega difícil?"
                value={form.entDificil}
                onChange={(v) => updateField('entDificil', v)}
              />
              <ToggleGroup
                label="Destinatário é contribuinte de ICMS?"
                value={form.destContribuinte}
                onChange={(v) => updateField('destContribuinte', v)}
              />
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <span className="section-step">3</span>
              <div>
                <h2>Nota fiscal</h2>
              </div>
            </div>

            <div className="fields-grid">
              <label className="field">
                <span>Valor da NF (R$) *</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.valorNF}
                  onChange={(e) => updateField('valorNF', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Quantidade de pares</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Se a tabela cobrar por par"
                  value={form.qtdePares}
                  onChange={(e) => updateField('qtdePares', e.target.value)}
                />
              </label>
            </div>
          </section>

          <VolumesForm volumes={volumes} onChange={setVolumes} totais={totais} />

          {erro && (
            <p className={`cotacao-msg ${resultado?.sucesso ? 'alerta' : 'erro'}`} role="alert">
              {erro}
            </p>
          )}

          {resultado && (resultado.sucesso || resultado.ofertas?.length > 0) && (
            <CotacaoResultado
              resultado={resultado}
              transportadoras={transportadoras}
              ofertaSelecionadaId={ofertaSelecionadaId}
              onSelecionarOferta={selecionarOferta}
              coletaAberta={coletaAberta}
              numeroColeta={coletaGerada?.numeroColeta}
              onSolicitarColeta={abrirColeta}
            >
              {coletaAberta && ofertaSelecionada?.sucesso && (
                <CotacaoColetaForm
                  quoteForm={{
                    ...form,
                    cnpjPagador: ofertaSelecionada.cnpjPagador || form.cnpjPagador,
                  }}
                  totais={totais}
                  cotacao={ofertaSelecionada.numeroCotacao}
                  token={ofertaSelecionada.token}
                  transportadoraId={ofertaSelecionada.transportadoraId}
                  transportadoraNome={ofertaSelecionada.nome}
                  locked={Boolean(coletaGerada?.numeroColeta)}
                  numeroColeta={coletaGerada?.numeroColeta}
                  onSuccess={setColetaGerada}
                />
              )}
            </CotacaoResultado>
          )}
        </div>

        <aside className="cotacao-aside">
          <div className="aside-card">
            <h3>Resumo</h3>
            <ul className="aside-list">
              <li>
                <span>Volumes</span>
                <strong>{totais.quantidade || '—'}</strong>
              </li>
              <li>
                <span>Peso</span>
                <strong>{totais.peso ? `${totais.peso} kg` : '—'}</strong>
              </li>
              <li>
                <span>Cubagem</span>
                <strong>{totais.volume ? `${totais.volume} m³` : '—'}</strong>
              </li>
              <li>
                <span>Valor NF</span>
                <strong>{form.valorNF ? formatMoney(form.valorNF) : '—'}</strong>
              </li>
            </ul>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Consultando rotas…' : 'Calcular frete'}
            </button>
          </div>
        </aside>
      </form>
        </div>
      </div>
  )
}

export default Cotacao
