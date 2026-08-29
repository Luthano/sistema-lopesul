import { useEffect, useMemo, useState } from 'react'
import { authFetch } from '../lib/authFetch'
import './PainelUsuarios.css'
import './PainelVeiculos.css'

const FILTROS = [
  { id: 'novo', label: 'Novos' },
  { id: 'em_contato', label: 'Em contato' },
  { id: 'aprovado', label: 'Aprovados' },
  { id: 'recusado', label: 'Recusados' },
  { id: 'all', label: 'Todos' },
]

function statusMeta(status) {
  if (status === 'aprovado') return { label: 'Aprovado', className: 'is-ok' }
  if (status === 'recusado') return { label: 'Recusado', className: 'is-danger' }
  if (status === 'em_contato') return { label: 'Em contato', className: 'is-warn' }
  return { label: 'Novo', className: 'is-warn' }
}

function Field({ label, value }) {
  return (
    <div className="user-card-field">
      <dt>{label}</dt>
      <dd className={value ? '' : 'is-empty'}>{value || 'Não informado'}</dd>
    </div>
  )
}

function PainelVeiculos({ isMaster }) {
  const [veiculos, setVeiculos] = useState([])
  const [filtro, setFiltro] = useState(isMaster ? 'novo' : 'all')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [notas, setNotas] = useState({})

  async function carregar() {
    setBusy(true)
    setErro('')
    try {
      if (!isMaster) {
        await authFetch('/api/veiculos/reivindicar', { method: 'POST' })
      }
      const res = await authFetch('/api/veiculos')
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        throw new Error(data.mensagem || 'Não foi possível carregar os veículos.')
      }
      setVeiculos(data.veiculos || [])
      const mapa = {}
      for (const item of data.veiculos || []) {
        mapa[item.id] = item.notas_master || ''
      }
      setNotas(mapa)
    } catch (error) {
      setErro(error.message || 'Erro ao carregar veículos.')
      setVeiculos([])
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster])

  async function atualizarStatus(veiculo, status) {
    setSavingId(veiculo.id)
    setErro('')
    setInfo('')
    try {
      const res = await authFetch(`/api/veiculos/${veiculo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          marca: veiculo.marca,
          ano: veiculo.ano,
          modelo: veiculo.modelo,
          cor: veiculo.cor,
          rotas: veiculo.rotas,
          nome: veiculo.nome,
          telefone: veiculo.telefone,
          email: veiculo.email,
          status,
          notas_master: notas[veiculo.id] || '',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.sucesso) {
        throw new Error(data.mensagem || 'Não foi possível atualizar.')
      }
      setInfo(data.mensagem || 'Atualizado.')
      await carregar()
    } catch (error) {
      setErro(error.message || 'Erro ao atualizar status.')
    } finally {
      setSavingId('')
    }
  }

  const lista = useMemo(() => {
    if (filtro === 'all') return veiculos
    return veiculos.filter((item) => item.status === filtro)
  }, [veiculos, filtro])

  const contagens = useMemo(
    () => ({
      all: veiculos.length,
      novo: veiculos.filter((item) => item.status === 'novo').length,
      em_contato: veiculos.filter((item) => item.status === 'em_contato').length,
      aprovado: veiculos.filter((item) => item.status === 'aprovado').length,
      recusado: veiculos.filter((item) => item.status === 'recusado').length,
    }),
    [veiculos],
  )

  return (
    <section className="painel-admin veiculos-admin">
      {erro ? (
        <p className="auth-alert" role="alert">
          {erro}
        </p>
      ) : null}
      {info ? <p className="auth-info">{info}</p> : null}

      {isMaster ? (
        <div className="user-filters" role="tablist" aria-label="Filtrar veículos">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filtro === item.id}
              className={filtro === item.id ? 'is-active' : ''}
              onClick={() => setFiltro(item.id)}
            >
              {item.label}
              <span>{contagens[item.id]}</span>
            </button>
          ))}
        </div>
      ) : null}

      {busy ? <p className="auth-info">Carregando…</p> : null}

      {!busy && lista.length === 0 ? (
        <p className="auth-info">Nenhum veículo neste filtro.</p>
      ) : (
        <div className="user-cards">
          {lista.map((veiculo) => {
            const meta = statusMeta(veiculo.status)
            const saving = savingId === veiculo.id
            return (
              <article key={veiculo.id} className="user-card">
                <header className="user-card-head">
                  <div>
                    <strong>
                      {veiculo.marca} {veiculo.modelo} · {veiculo.ano}
                    </strong>
                    <p>{veiculo.cor}</p>
                  </div>
                  <span className={`user-status ${meta.className}`}>{meta.label}</span>
                </header>

                <dl className="user-card-grid">
                  <Field label="Marca" value={veiculo.marca} />
                  <Field label="Modelo" value={veiculo.modelo} />
                  <Field label="Rotas" value={veiculo.rotas} />
                  <Field label="Nome" value={veiculo.nome} />
                  <Field label="Telefone" value={veiculo.telefone} />
                  <Field label="E-mail" value={veiculo.email} />
                  <Field
                    label="Conta"
                    value={veiculo.user_id ? 'Vinculado a usuário' : 'Cadastro sem login'}
                  />
                </dl>

                {isMaster ? (
                  <label className="veiculo-notas">
                    <span>Notas internas</span>
                    <textarea
                      value={notas[veiculo.id] || ''}
                      onChange={(e) =>
                        setNotas((prev) => ({
                          ...prev,
                          [veiculo.id]: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Observações da análise"
                    />
                  </label>
                ) : null}

                {isMaster ? (
                  <div className="user-card-actions">
                    <button
                      type="button"
                      className="painel-section-cta is-ghost"
                      disabled={saving || veiculo.status === 'em_contato'}
                      onClick={() => atualizarStatus(veiculo, 'em_contato')}
                    >
                      Em contato
                    </button>
                    <button
                      type="button"
                      className="painel-section-cta"
                      disabled={saving || veiculo.status === 'aprovado'}
                      onClick={() => atualizarStatus(veiculo, 'aprovado')}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="painel-danger-btn"
                      disabled={saving || veiculo.status === 'recusado'}
                      onClick={() => atualizarStatus(veiculo, 'recusado')}
                    >
                      Recusar
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default PainelVeiculos
