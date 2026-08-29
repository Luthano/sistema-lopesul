import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authFetch } from '../lib/authFetch'
import { useAuth } from '../context/AuthContext'
import './CadastrarVeiculo.css'

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: ANO_ATUAL - 1979 }, (_, i) => ANO_ATUAL + 1 - i)

const INITIAL = {
  marca: '',
  ano: String(ANO_ATUAL),
  modelo: '',
  cor: '',
  rotas: '',
  nome: '',
  telefone: '',
  email: '',
}

function CadastrarVeiculo() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function limparForm() {
    setForm({
      ...INITIAL,
      email: user?.email || '',
      nome: profile?.nome_completo || '',
      telefone: profile?.whatsapp || profile?.telefone || '',
    })
  }

  useEffect(() => {
    if (!user) return undefined
    setForm((prev) => ({
      ...prev,
      email: prev.email || user.email || '',
      nome: prev.nome || profile?.nome_completo || '',
      telefone: prev.telefone || profile?.whatsapp || profile?.telefone || '',
    }))
    authFetch('/api/veiculos/reivindicar', { method: 'POST' }).catch(() => {})
    return undefined
  }, [user, profile?.nome_completo, profile?.whatsapp, profile?.telefone])

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setInfo('')
    setLoading(true)

    try {
      const res = await authFetch('/api/veiculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ano: Number(form.ano) }),
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        throw new Error(data.mensagem || 'Não foi possível salvar o cadastro.')
      }
      setInfo(data.mensagem || 'Cadastro salvo.')
      limparForm()
    } catch (error) {
      setErro(error.message || 'Erro de comunicação com a API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="page-block is-narrow veiculo-page">
        <header className="veiculo-hero">
          <p className="veiculo-kicker">Parceiros</p>
          <h1>Cadastrar veículo</h1>
          <p>
            Informe marca, ano, modelo, cor e rotas. Com login Lopesul, você edita depois no painel; o
            master analisa e aprova.
          </p>
          {!user ? (
            <p className="veiculo-login-hint">
              Já enviou sem conta? <Link to="/login">Crie login</Link> com o mesmo e-mail para
              acompanhar no painel.
            </p>
          ) : null}
        </header>

        <form className="veiculo-form" onSubmit={handleSubmit}>
          <section className="veiculo-card">
            <h2>Dados do veículo</h2>
            <div className="veiculo-grid">
              <label>
                <span>Marca *</span>
                <input
                  required
                  value={form.marca}
                  onChange={(e) => updateField('marca', e.target.value)}
                  placeholder="Ex.: Volkswagen"
                  maxLength={80}
                />
              </label>
              <label>
                <span>Ano *</span>
                <select required value={form.ano} onChange={(e) => updateField('ano', e.target.value)}>
                  {ANOS.map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Modelo *</span>
                <input
                  required
                  value={form.modelo}
                  onChange={(e) => updateField('modelo', e.target.value)}
                  placeholder="Ex.: Delivery 11.180"
                  maxLength={120}
                />
              </label>
              <label>
                <span>Cor *</span>
                <input
                  required
                  value={form.cor}
                  onChange={(e) => updateField('cor', e.target.value)}
                  placeholder="Ex.: Branco"
                  maxLength={60}
                />
              </label>
            </div>

            <label className="veiculo-field-full">
              <span>Rotas *</span>
              <textarea
                required
                value={form.rotas}
                onChange={(e) => updateField('rotas', e.target.value)}
                placeholder="Ex.: Cascavel/PR ↔ São Paulo/SP, Curitiba/PR e região"
                rows={4}
                maxLength={2000}
              />
            </label>
          </section>

          <section className="veiculo-card">
            <h2>Contato</h2>
            <p className="veiculo-hint">
              {user
                ? 'Usamos estes dados para retorno da equipe operacional.'
                : 'Informe o e-mail que usará no login Lopesul para acompanhar depois.'}
            </p>
            <div className="veiculo-grid">
              <label className="veiculo-span-2">
                <span>Nome</span>
                <input
                  value={form.nome}
                  onChange={(e) => updateField('nome', e.target.value)}
                  placeholder="Seu nome"
                  maxLength={120}
                />
              </label>
              <label>
                <span>Telefone / WhatsApp</span>
                <input
                  value={form.telefone}
                  onChange={(e) => updateField('telefone', e.target.value)}
                  placeholder="DDD + número"
                  inputMode="tel"
                  maxLength={20}
                />
              </label>
              <label>
                <span>E-mail {!user ? '*' : ''}</span>
                <input
                  type="email"
                  required={!user}
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="seu@email.com"
                  maxLength={160}
                />
              </label>
            </div>
          </section>

          {erro ? (
            <p className="veiculo-erro" role="alert">
              {erro}
            </p>
          ) : null}
          {info ? <p className="veiculo-info">{info}</p> : null}

          <button type="submit" className="veiculo-btn" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar cadastro'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CadastrarVeiculo
