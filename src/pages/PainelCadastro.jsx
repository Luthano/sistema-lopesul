import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatCnpj, formatCpf, formatPhone, isProfileComplete, onlyDigits } from '../lib/profile'
import PainelAlterarSenha from './PainelAlterarSenha'
import PainelExcluirConta from './PainelExcluirConta'

function formFromProfile(profile) {
  return {
    nome_completo: profile?.nome_completo || '',
    endereco: profile?.endereco || '',
    cpf: profile?.cpf || '',
    cnpj: profile?.cnpj || '',
    telefone: profile?.telefone || '',
    whatsapp: profile?.whatsapp || '',
  }
}

function ViewField({ label, value }) {
  return (
    <div className={`painel-view-field ${label === 'Endereço' ? 'is-wide' : ''}`}>
      <span>{label}</span>
      <strong className={value ? '' : 'is-empty'}>{value || 'Não informado'}</strong>
    </div>
  )
}

function PainelCadastro({ profile, canDelete = false, onSaved }) {
  const { user } = useAuth()
  const completo = isProfileComplete(profile)
  const [editing, setEditing] = useState(!completo)
  const [form, setForm] = useState(() => formFromProfile(profile))
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(formFromProfile(profile))
    setEditing(!isProfileComplete(profile))
  }, [profile])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function cancelar() {
    setErro('')
    setInfo('')
    setForm(formFromProfile(profile))
    setEditing(!completo)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setInfo('')

    const profileId = profile?.id || user?.id
    if (!profileId) {
      setErro('Perfil não carregado. Atualize a página e tente novamente.')
      return
    }

    if (String(form.nome_completo).trim().length < 3) {
      setErro('Informe o nome completo.')
      return
    }
    if (String(form.endereco).trim().length < 8) {
      setErro('Informe o endereço completo.')
      return
    }
    if (onlyDigits(form.cpf).length !== 11) {
      setErro('Informe um CPF válido com 11 dígitos.')
      return
    }
    if (onlyDigits(form.cnpj).length !== 14) {
      setErro('Informe um CNPJ válido com 14 dígitos.')
      return
    }
    if (onlyDigits(form.telefone).length < 10) {
      setErro('Informe o telefone da conta.')
      return
    }
    if (onlyDigits(form.whatsapp).length < 10) {
      setErro('Informe o WhatsApp.')
      return
    }

    setSaving(true)
    const payload = {
      nome_completo: form.nome_completo.trim(),
      endereco: form.endereco.trim(),
      cpf: onlyDigits(form.cpf),
      cnpj: onlyDigits(form.cnpj),
      telefone: onlyDigits(form.telefone),
      whatsapp: onlyDigits(form.whatsapp),
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', profileId)
      .select(
        'id, email, status, role, nome_completo, endereco, cpf, cnpj, telefone, whatsapp, created_at, approved_at, approved_by',
      )
      .maybeSingle()

    if (error) {
      const mensagem = String(error.message || '')
      setErro(
        /schema cache|column/i.test(mensagem)
          ? 'Falta rodar o SQL de cadastro no Supabase (arquivo 012_profiles_cadastro_update.sql).'
          : mensagem || 'Não foi possível salvar seus dados.',
      )
      setSaving(false)
      return
    }

    if (!data) {
      setErro(
        'Não foi possível gravar o cadastro (nenhuma linha atualizada). Rode o SQL 012_profiles_cadastro_update.sql no Supabase e tente de novo.',
      )
      setSaving(false)
      return
    }

    setInfo(data.status === 'approved' ? 'Dados atualizados.' : 'Dados salvos. Aguarde a aprovação do master.')
    setForm(formFromProfile(data))
    setEditing(false)
    await onSaved?.()
    setSaving(false)
  }

  return (
    <section className="painel-cadastro">
      <header className="painel-cadastro-head">
        <div>
          <h2>Meus dados</h2>
        </div>
        {!editing && (
          <button
            type="button"
            className="painel-edit"
            onClick={() => {
              setInfo('')
              setErro('')
              setEditing(true)
            }}
          >
            Editar informações
          </button>
        )}
      </header>

      {editing ? (
        <form className="painel-cadastro-form" onSubmit={handleSubmit}>
          <div className="painel-cadastro-grid">
            <label>
              <span>Nome completo *</span>
              <input value={form.nome_completo} onChange={(e) => updateField('nome_completo', e.target.value)} />
            </label>
            <label className="is-wide">
              <span>Endereço *</span>
              <input value={form.endereco} onChange={(e) => updateField('endereco', e.target.value)} />
            </label>
            <label>
              <span>CPF *</span>
              <input value={form.cpf} onChange={(e) => updateField('cpf', e.target.value)} inputMode="numeric" />
            </label>
            <label>
              <span>CNPJ *</span>
              <input value={form.cnpj} onChange={(e) => updateField('cnpj', e.target.value)} inputMode="numeric" />
            </label>
            <label>
              <span>Telefone da conta *</span>
              <input value={form.telefone} onChange={(e) => updateField('telefone', e.target.value)} inputMode="numeric" />
            </label>
            <label>
              <span>WhatsApp *</span>
              <input value={form.whatsapp} onChange={(e) => updateField('whatsapp', e.target.value)} inputMode="numeric" />
            </label>
          </div>

          {erro && (
            <p className="auth-alert" role="alert">
              {erro}
            </p>
          )}
          {info && <p className="auth-info">{info}</p>}

          <div className="painel-cadastro-actions">
            <button type="submit" className="auth-submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
            {completo && (
              <button type="button" className="painel-cancel" onClick={cancelar}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="painel-view-grid">
          <ViewField label="E-mail" value={profile?.email || user?.email} />
          <ViewField label="Nome completo" value={profile?.nome_completo || form.nome_completo} />
          <ViewField label="Endereço" value={profile?.endereco || form.endereco} />
          <ViewField label="CPF" value={formatCpf(profile?.cpf || form.cpf)} />
          <ViewField label="CNPJ" value={formatCnpj(profile?.cnpj || form.cnpj)} />
          <ViewField label="Telefone da conta" value={formatPhone(profile?.telefone || form.telefone)} />
          <ViewField label="WhatsApp" value={formatPhone(profile?.whatsapp || form.whatsapp)} />
          {info && <p className="auth-info">{info}</p>}
        </div>
      )}

      <PainelAlterarSenha />

      {canDelete && <PainelExcluirConta email={profile.email} />}
    </section>
  )
}

export default PainelCadastro
