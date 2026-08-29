import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

function PainelAlterarSenha() {
  const { user, signIn } = useAuth()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(false)

  function limparSenhas() {
    setAtual('')
    setNova('')
    setConfirmacao('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setInfo('')

    if (!user?.email) {
      setErro('Sessão inválida. Entre novamente para alterar a senha.')
      return
    }
    if (!atual) {
      setErro('Informe a senha atual.')
      return
    }
    if (nova.length < 8) {
      setErro('A nova senha precisa ter ao menos 8 caracteres.')
      return
    }
    if (nova !== confirmacao) {
      setErro('A confirmação não confere com a nova senha.')
      return
    }
    if (nova === atual) {
      setErro('A nova senha deve ser diferente da senha atual.')
      return
    }

    setSaving(true)
    const { error: checkError } = await signIn(user.email, atual)
    if (checkError) {
      setErro('Senha atual incorreta.')
      setSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: nova })
    if (error) {
      setErro(error.message || 'Não foi possível alterar a senha.')
      setSaving(false)
      return
    }

    limparSenhas()
    setInfo('Senha atualizada. Use a nova senha no próximo acesso.')
    setSaving(false)
  }

  return (
    <form className="painel-cadastro-form painel-senha" onSubmit={handleSubmit} autoComplete="off">
      <header className="painel-cadastro-head">
        <div>
          <h2>Senha de acesso</h2>
        </div>
      </header>

      <div className="painel-cadastro-grid">
        <label>
          <span>Senha atual *</span>
          <input
            type="password"
            name="lopesul-senha-atual"
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
          />
        </label>
        <label>
          <span>Nova senha *</span>
          <input
            type="password"
            name="lopesul-senha-nova"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            minLength={8}
          />
        </label>
        <label className="is-wide">
          <span>Confirmar nova senha *</span>
          <input
            type="password"
            name="lopesul-senha-confirma"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            minLength={8}
          />
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
          {saving ? 'Alterando…' : 'Alterar senha'}
        </button>
      </div>
    </form>
  )
}

export default PainelAlterarSenha
