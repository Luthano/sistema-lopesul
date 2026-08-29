import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCnpj, formatCpf, formatPhone, isProfileComplete, profileInitials } from '../lib/profile'
import './PainelUsuarios.css'

const FILTROS = [
  { id: 'pending', label: 'Pendentes' },
  { id: 'approved', label: 'Aprovados' },
  { id: 'rejected', label: 'Recusados' },
  { id: 'all', label: 'Todos' },
]

function statusMeta(status) {
  if (status === 'approved') return { label: 'Aprovado', className: 'is-ok' }
  if (status === 'rejected') return { label: 'Recusado', className: 'is-danger' }
  return { label: 'Pendente', className: 'is-warn' }
}

function Field({ label, value }) {
  return (
    <div className="user-card-field">
      <dt>{label}</dt>
      <dd className={value ? '' : 'is-empty'}>{value || 'Não informado'}</dd>
    </div>
  )
}

function ConfirmDialog({ titulo, texto, confirmLabel, danger = false, busy, onConfirm, onCancel }) {
  return (
    <div className="user-confirm-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="user-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="user-confirm-title">{titulo}</h3>
        <p>{texto}</p>
        <div className="user-confirm-actions">
          <button type="button" className="user-confirm-cancel" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className={danger ? 'user-confirm-danger' : 'user-confirm-ok'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Confirmando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function PainelUsuarios({ masterId, onChanged }) {
  const [usuarios, setUsuarios] = useState([])
  const [filtro, setFiltro] = useState('all')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [confirmacao, setConfirmacao] = useState(null)

  async function carregar() {
    setBusy(true)
    setErro('')
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setErro(error.message || 'Não foi possível carregar os usuários.')
      setUsuarios([])
    } else {
      setUsuarios(data || [])
    }
    setBusy(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function aplicarStatus(usuario, status) {
    setSavingId(usuario.id)
    setErro('')
    setInfo('')

    const { data, error } = await supabase
      .from('profiles')
      .update({
        status,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        approved_by: status === 'approved' ? masterId : null,
      })
      .eq('id', usuario.id)
      .select('id, email, status, approved_at, approved_by')
      .maybeSingle()

    if (error) {
      setErro(error.message || 'Não foi possível atualizar o usuário.')
      setSavingId('')
      return false
    }

    if (!data || data.status !== status) {
      setErro(
        'A alteração não foi gravada no banco. Confirme se a conta master está aprovada e rode o SQL 013_profiles_aprovacao_exclusao.sql.',
      )
      setSavingId('')
      return false
    }

    setInfo(
      status === 'approved'
        ? `Usuário ${data.email} aprovado no banco.`
        : `Usuário ${data.email} recusado no banco.`,
    )
    await carregar()
    onChanged?.()
    setSavingId('')
    return true
  }

  async function excluirUsuario(usuario) {
    setSavingId(usuario.id)
    setErro('')
    setInfo('')

    const { error } = await supabase.rpc('admin_delete_user', { target_id: usuario.id })
    if (error) {
      setErro(
        /function|schema cache|admin_delete_user/i.test(String(error.message || ''))
          ? 'Falta rodar o SQL 013_profiles_aprovacao_exclusao.sql no Supabase para excluir usuários.'
          : error.message || 'Não foi possível excluir o usuário.',
      )
      setSavingId('')
      return false
    }

    setInfo(`Usuário ${usuario.email} excluído do Auth e do cadastro.`)
    await carregar()
    onChanged?.()
    setSavingId('')
    return true
  }

  async function confirmarAcao() {
    if (!confirmacao) return
    const { tipo, usuario } = confirmacao
    let ok = false
    if (tipo === 'approved' || tipo === 'rejected') {
      ok = await aplicarStatus(usuario, tipo)
    } else if (tipo === 'delete') {
      ok = await excluirUsuario(usuario)
    }
    if (ok) setConfirmacao(null)
  }

  const contagens = useMemo(
    () => ({
      all: usuarios.length,
      pending: usuarios.filter((item) => item.status === 'pending').length,
      approved: usuarios.filter((item) => item.status === 'approved').length,
      rejected: usuarios.filter((item) => item.status === 'rejected').length,
    }),
    [usuarios],
  )

  const lista = useMemo(() => {
    const filtrados = filtro === 'all' ? usuarios : usuarios.filter((item) => item.status === filtro)
    return [...filtrados].sort((a, b) => Number(b.role === 'master') - Number(a.role === 'master'))
  }, [usuarios, filtro])

  const confirmMeta = confirmacao
    ? {
        approved: {
          titulo: 'Aprovar usuário',
          texto: `Confirma a aprovação de ${confirmacao.usuario.nome_completo || confirmacao.usuario.email}? Isso libera o acesso às cotações.`,
          confirmLabel: 'Confirmar aprovação',
          danger: false,
        },
        rejected: {
          titulo: 'Recusar usuário',
          texto: `Confirma a recusa de ${confirmacao.usuario.nome_completo || confirmacao.usuario.email}? O acesso às cotações permanecerá bloqueado.`,
          confirmLabel: 'Confirmar recusa',
          danger: true,
        },
        delete: {
          titulo: 'Excluir usuário',
          texto: `Excluir permanentemente ${confirmacao.usuario.email}? Isso remove login, cadastro e histórico. Não dá para desfazer.`,
          confirmLabel: 'Excluir permanentemente',
          danger: true,
        },
      }[confirmacao.tipo]
    : null

  return (
    <section className="painel-admin">
      <div className="user-filters" role="tablist" aria-label="Filtrar usuários">
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

      {erro && (
        <p className="auth-alert" role="alert">
          {erro}
        </p>
      )}
      {info && <p className="auth-info">{info}</p>}
      {busy && <p className="user-empty">Carregando usuários…</p>}

      {!busy && lista.length === 0 ? (
        <div className="user-empty">
          <strong>Nenhum usuário neste filtro</strong>
          <span>Quando houver cadastros, eles aparecem aqui para revisão.</span>
        </div>
      ) : (
        <ul className="user-cards">
          {lista.map((usuario) => {
            const completo = isProfileComplete(usuario)
            const status = statusMeta(usuario.status)
            const isMasterAccount = usuario.role === 'master'
            const titulo = usuario.nome_completo || usuario.email
            const salvando = savingId === usuario.id

            return (
              <li key={usuario.id} className="user-card">
                <header className="user-card-head">
                  <div className="user-card-identity">
                    <span className="user-card-avatar" aria-hidden="true">
                      {profileInitials(usuario)}
                    </span>
                    <div>
                      <h3>{titulo}</h3>
                      {usuario.nome_completo ? <p>{usuario.email}</p> : null}
                    </div>
                  </div>
                  <div className="user-card-badges">
                    <span className={`user-badge ${status.className}`}>{status.label}</span>
                    {isMasterAccount ? <span className="user-badge is-role">Master</span> : null}
                    <span className={`user-badge ${completo ? 'is-ok' : 'is-warn'}`}>
                      {completo ? 'Dados completos' : 'Dados incompletos'}
                    </span>
                  </div>
                </header>

                <dl className="user-card-grid">
                  <Field label="Endereço" value={usuario.endereco} />
                  <Field label="CPF" value={formatCpf(usuario.cpf)} />
                  <Field label="CNPJ" value={formatCnpj(usuario.cnpj)} />
                  <Field label="Telefone da conta" value={formatPhone(usuario.telefone)} />
                  <Field label="WhatsApp" value={formatPhone(usuario.whatsapp)} />
                </dl>

                {isMasterAccount ? null : (
                  <footer className="user-card-footer">
                    <div className="user-card-actions">
                      <button
                        type="button"
                        className="is-approve"
                        disabled={salvando || usuario.status === 'approved' || !completo}
                        onClick={() => setConfirmacao({ tipo: 'approved', usuario })}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="is-reject"
                        disabled={salvando || usuario.status === 'rejected'}
                        onClick={() => setConfirmacao({ tipo: 'rejected', usuario })}
                      >
                        Recusar
                      </button>
                      <button
                        type="button"
                        className="is-delete"
                        disabled={salvando}
                        onClick={() => setConfirmacao({ tipo: 'delete', usuario })}
                      >
                        Excluir
                      </button>
                    </div>
                  </footer>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {confirmacao && confirmMeta ? (
        <ConfirmDialog
          titulo={confirmMeta.titulo}
          texto={confirmMeta.texto}
          confirmLabel={confirmMeta.confirmLabel}
          danger={confirmMeta.danger}
          busy={Boolean(savingId)}
          onCancel={() => (savingId ? null : setConfirmacao(null))}
          onConfirm={confirmarAcao}
        />
      ) : null}
    </section>
  )
}

export default PainelUsuarios
