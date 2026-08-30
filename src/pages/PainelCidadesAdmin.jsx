import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '../lib/authFetch'
import { supabase } from '../lib/supabase'
import { UF_NOMES, UFS_BRASIL } from '../lib/ufsAtendidas'
import './PainelCidadesAdmin.css'

function normalizeCityLine(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function formatCityName(name) {
  return String(name)
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase('pt-BR'))
}

function sortCidades(lista) {
  return [...lista].sort((a, b) =>
    String(a.cidade).localeCompare(String(b.cidade), 'pt-BR', { sensitivity: 'base' }),
  )
}

function CobConfirm({ titleId, title, children, onCancel, onConfirm, confirmLabel, saving, danger }) {
  return (
    <div
      className="cob-confirm-backdrop"
      role="presentation"
      onClick={() => !saving && onCancel()}
    >
      <div
        className="cob-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId}>{title}</h3>
        <p>{children}</p>
        <div className="cob-confirm-actions">
          <button type="button" className="cob-btn cob-btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className={`cob-btn ${danger ? 'cob-btn-danger' : 'cob-btn-primary'}`}
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function PainelCidadesAdmin() {
  const [carriers, setCarriers] = useState([])
  const [carrierId, setCarrierId] = useState('')
  const [uf, setUf] = useState('PR')
  const [cidades, setCidades] = useState([])
  const [lote, setLote] = useState('')
  const [novaCidade, setNovaCidade] = useState('')
  const [filtro, setFiltro] = useState('')
  const [modoAdd, setModoAdd] = useState('uma')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [loadingCarriers, setLoadingCarriers] = useState(true)
  const [loadingCidades, setLoadingCidades] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState('')
  const [editNome, setEditNome] = useState('')
  const [confirmLimparUf, setConfirmLimparUf] = useState(false)
  const [confirmSincronizar, setConfirmSincronizar] = useState(false)

  const carrier = useMemo(
    () => carriers.find((item) => item.id === carrierId) || null,
    [carriers, carrierId],
  )

  const cidadesFiltradas = useMemo(() => {
    const termo = filtro.trim().toLocaleLowerCase('pt-BR')
    if (!termo) return cidades
    return cidades.filter((item) => item.cidade.toLocaleLowerCase('pt-BR').includes(termo))
  }, [cidades, filtro])

  const carregarCarriers = useCallback(async () => {
    const { data, error } = await supabase
      .from('transportadoras_cobertura')
      .select('id, nome, sigla, ativo, ordem')
      .eq('id', 'lopesul')
      .order('ordem', { ascending: true })

    if (error) throw error
    setCarriers(data || [])
    setCarrierId((prev) => {
      if (prev && (data || []).some((item) => item.id === prev)) return prev
      return data?.[0]?.id || 'lopesul'
    })
  }, [])

  const carregarCidades = useCallback(async () => {
    if (!carrierId || !uf) {
      setCidades([])
      return
    }

    const { data, error } = await supabase
      .from('cobertura_cidades')
      .select('id, cidade, uf, transportadora_id')
      .eq('transportadora_id', carrierId)
      .eq('uf', uf)
      .order('cidade', { ascending: true })

    if (error) throw error
    setCidades(data || [])
  }, [carrierId, uf])

  useEffect(() => {
    let active = true
    setLoadingCarriers(true)
    setErro('')
    carregarCarriers()
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível carregar as transportadoras.')
      })
      .finally(() => {
        if (active) setLoadingCarriers(false)
      })
    return () => {
      active = false
    }
  }, [carregarCarriers])

  useEffect(() => {
    if (!carrierId) return undefined

    let active = true
    setLoadingCidades(true)
    setErro('')
    setEditId('')
    setEditNome('')
    setConfirmLimparUf(false)

    carregarCidades()
      .catch((error) => {
        if (active) setErro(error.message || 'Erro ao carregar cidades.')
      })
      .finally(() => {
        if (active) setLoadingCidades(false)
      })

    return () => {
      active = false
    }
  }, [carrierId, uf, carregarCidades])

  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'Escape' || saving) return
      if (confirmSincronizar) setConfirmSincronizar(false)
      else if (confirmLimparUf) setConfirmLimparUf(false)
      else if (editId) {
        setEditId('')
        setEditNome('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmSincronizar, confirmLimparUf, editId, saving])

  function abrirEdicao(item) {
    setEditId(item.id)
    setEditNome(item.cidade)
    setErro('')
    setInfo('')
  }

  function fecharEdicao() {
    setEditId('')
    setEditNome('')
  }

  async function salvarEdicao(event) {
    event.preventDefault()
    const cidade = normalizeCityLine(editNome)
    if (!editId) return
    if (cidade.length < 2) {
      setErro('Informe o nome da cidade.')
      return
    }

    setSaving(true)
    setErro('')
    setInfo('')
    const { data, error } = await supabase
      .from('cobertura_cidades')
      .update({ cidade })
      .eq('id', editId)
      .select('id, cidade, uf, transportadora_id')
      .maybeSingle()

    if (error) {
      setErro(error.message || 'Não foi possível salvar a edição.')
    } else if (data) {
      setCidades((prev) => sortCidades(prev.map((item) => (item.id === data.id ? data : item))))
      setInfo(`Cidade atualizada para ${formatCityName(data.cidade)}.`)
      fecharEdicao()
    }
    setSaving(false)
  }

  async function adicionarCidades(nomes) {
    const limpos = [...new Set(nomes.map(normalizeCityLine).filter((item) => item.length >= 2))]
    if (!carrierId || !uf) {
      setErro('Selecione a transportadora e a UF.')
      return
    }
    if (!limpos.length) {
      setErro('Informe ao menos uma cidade.')
      return
    }

    setSaving(true)
    setErro('')
    setInfo('')

    const rows = limpos.map((cidade) => ({
      transportadora_id: carrierId,
      uf,
      cidade,
    }))

    const { data, error } = await supabase
      .from('cobertura_cidades')
      .upsert(rows, {
        onConflict: 'transportadora_id,uf,cidade_norm',
        ignoreDuplicates: false,
      })
      .select('id, cidade, uf, transportadora_id')

    if (error) {
      setErro(error.message || 'Não foi possível salvar as cidades.')
    } else {
      const salvas = data || []
      setCidades((prev) => {
        const mapa = new Map(prev.map((item) => [item.id, item]))
        for (const item of salvas) mapa.set(item.id, item)
        return sortCidades([...mapa.values()])
      })
      setInfo(`${limpos.length} cidade(s) salva(s) em ${uf} · ${carrier?.sigla || carrierId}.`)
      setLote('')
      setNovaCidade('')
    }
    setSaving(false)
  }

  async function handleAddUma(event) {
    event.preventDefault()
    await adicionarCidades([novaCidade])
  }

  async function handleAddLote(event) {
    event.preventDefault()
    const nomes = lote.split(/\r?\n|;|,/).map((item) => item.trim())
    await adicionarCidades(nomes)
  }

  async function removerCidade(id) {
    if (!window.confirm('Remover esta cidade da cobertura?')) return
    setSaving(true)
    setErro('')
    const { error } = await supabase.from('cobertura_cidades').delete().eq('id', id)
    if (error) {
      setErro(error.message || 'Não foi possível remover.')
    } else {
      setCidades((prev) => prev.filter((item) => item.id !== id))
      if (editId === id) fecharEdicao()
      setInfo('Cidade removida da cobertura.')
    }
    setSaving(false)
  }

  function pedirConfirmacaoLimparUf() {
    if (!carrierId || !uf || !cidades.length || saving) return
    setConfirmLimparUf(true)
  }

  async function confirmarLimparUf() {
    if (!carrierId || !uf) return
    setConfirmLimparUf(false)
    setSaving(true)
    setErro('')
    setInfo('')
    const { error } = await supabase
      .from('cobertura_cidades')
      .delete()
      .eq('transportadora_id', carrierId)
      .eq('uf', uf)
    if (error) {
      setErro(error.message || 'Não foi possível limpar a UF.')
    } else {
      setCidades([])
      fecharEdicao()
      setInfo(`Cobertura de ${uf} limpa para ${carrier?.nome || carrierId}.`)
    }
    setSaving(false)
  }

  async function confirmarSincronizarSsw() {
    setConfirmSincronizar(false)
    setSaving(true)
    setErro('')
    setInfo('')
    try {
      const response = await authFetch('/api/cidades/sincronizar-ssw', {
        method: 'POST',
        body: JSON.stringify({ substituir: true }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.sucesso) {
        throw new Error(payload.mensagem || 'Não foi possível sincronizar a malha do SSW.')
      }
      await carregarCidades()
      const ufs = Object.keys(payload.porUf || {}).sort().join(', ')
      setInfo(`${payload.mensagem}${ufs ? ` UFs: ${ufs}.` : ''}`)
    } catch (error) {
      setErro(error.message || 'Erro ao sincronizar cidades do SSW.')
    }
    setSaving(false)
  }

  const toolbarBusy = loadingCarriers && !carriers.length
  const showListaVazia = !loadingCidades && cidadesFiltradas.length === 0
  const ufNome = UF_NOMES[uf] || uf
  const totalLabel = filtro.trim()
    ? `${cidadesFiltradas.length} de ${cidades.length}`
    : String(cidades.length)

  return (
    <section className="painel-admin cob-admin">
      {erro && (
        <p className="auth-alert" role="alert">
          {erro}
        </p>
      )}
      {info && <p className="auth-info">{info}</p>}

      <div className="cob-top">
        <div className="cob-top-copy">
          {carriers.length > 1 ? (
            <label className="cob-field">
              <span>Transportadora</span>
              <select
                value={carrierId}
                onChange={(e) => setCarrierId(e.target.value)}
                disabled={toolbarBusy || !carriers.length}
              >
                {!carriers.length && <option value="">Nenhuma cadastrada</option>}
                {carriers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome} ({item.sigla})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="cob-carrier-chip">
              <span>{carrier?.sigla || 'LS'}</span>
              {carrier?.nome || 'Lopesul'}
            </p>
          )}
        </div>
        <button
          type="button"
          className="cob-btn cob-btn-ghost"
          disabled={saving || !carrierId}
          onClick={() => {
            setErro('')
            setInfo('')
            setConfirmSincronizar(true)
          }}
        >
          Sincronizar do SSW
        </button>
      </div>

      <div className="cob-workspace">
        <div className="cob-board">
          <div className="cob-board-toolbar">
            <label className="cob-field cob-field-uf">
              <span>UF</span>
              <select value={uf} onChange={(e) => setUf(e.target.value)} disabled={toolbarBusy}>
                {UFS_BRASIL.map((item) => (
                  <option key={item} value={item}>
                    {item} — {UF_NOMES[item] || item}
                  </option>
                ))}
              </select>
            </label>
            <label className="cob-field cob-field-search">
              <span>Buscar na lista</span>
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Digite o nome da cidade"
              />
            </label>
          </div>

          <div className="cob-board-meta">
            <strong>
              {totalLabel} cidade{cidadesFiltradas.length === 1 ? '' : 's'}
            </strong>
            <span>
              {ufNome}
              {loadingCidades ? ' · atualizando…' : ''}
            </span>
          </div>

          <div className="cob-board-body">
          {loadingCidades && cidades.length === 0 ? (
            <div className="cob-empty">
              <strong>Carregando cidades…</strong>
              <p>Buscando a malha de {ufNome}.</p>
            </div>
          ) : showListaVazia ? (
            <div className="cob-empty">
              <strong>
                {filtro.trim()
                  ? `Nenhum resultado para “${filtro.trim()}”`
                  : `Nenhuma cidade em ${uf}`}
              </strong>
              <p>
                {filtro.trim()
                  ? 'Ajuste a busca ou limpe o filtro para ver a lista completa.'
                  : 'Inclua uma cidade ao lado ou sincronize a malha com o SSW.'}
              </p>
            </div>
          ) : (
            <ul className={`cob-lista${loadingCidades ? ' is-refreshing' : ''}`}>
              {cidadesFiltradas.map((item) => {
                const editando = editId === item.id
                return (
                  <li key={item.id} className={editando ? 'is-editing' : ''}>
                    {editando ? (
                      <form className="cob-edit-form" onSubmit={salvarEdicao}>
                        <input
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          disabled={saving}
                          autoFocus
                          aria-label="Nome da cidade"
                        />
                        <div className="cob-edit-actions">
                          <button type="submit" className="cob-btn cob-btn-primary cob-btn-sm" disabled={saving}>
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="cob-btn cob-btn-ghost cob-btn-sm"
                            onClick={fecharEdicao}
                            disabled={saving}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="cob-btn cob-btn-danger-ghost cob-btn-sm"
                            onClick={() => removerCidade(item.id)}
                            disabled={saving}
                          >
                            Remover
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span>{formatCityName(item.cidade)}</span>
                        <button
                          type="button"
                          className="cob-edit-open"
                          onClick={() => abrirEdicao(item)}
                          disabled={saving}
                        >
                          Editar
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          </div>
        </div>

        <aside className="cob-composer">
          <header className="cob-composer-head">
            <h3>Incluir cidades</h3>
            <p>
              Cadastro em <strong>{uf}</strong> · {ufNome}
            </p>
          </header>

          <div className="cob-tabs" role="tablist" aria-label="Forma de inclusão">
            <button
              type="button"
              role="tab"
              aria-selected={modoAdd === 'uma'}
              className={modoAdd === 'uma' ? 'is-active' : ''}
              onClick={() => setModoAdd('uma')}
            >
              Uma cidade
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modoAdd === 'lote'}
              className={modoAdd === 'lote' ? 'is-active' : ''}
              onClick={() => setModoAdd('lote')}
            >
              Em lote
            </button>
          </div>

          {modoAdd === 'uma' ? (
            <form className="cob-composer-form" onSubmit={handleAddUma}>
              <label className="cob-field">
                <span>Nome da cidade</span>
                <input
                  value={novaCidade}
                  onChange={(e) => setNovaCidade(e.target.value)}
                  placeholder="Ex.: Cascavel"
                  disabled={saving || !carrierId}
                />
              </label>
              <button type="submit" className="cob-btn cob-btn-primary" disabled={saving || !carrierId}>
                Salvar cidade
              </button>
            </form>
          ) : (
            <form className="cob-composer-form" onSubmit={handleAddLote}>
              <label className="cob-field">
                <span>Lista de cidades</span>
                <textarea
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  rows={7}
                  placeholder={'Cascavel\nMaringá\nLondrina'}
                  disabled={saving || !carrierId}
                />
              </label>
              <p className="cob-hint">Uma por linha, ou separadas por vírgula.</p>
              <button type="submit" className="cob-btn cob-btn-primary" disabled={saving || !carrierId}>
                Importar lista
              </button>
            </form>
          )}

          <div className="cob-danger">
            <p>Remove todas as cidades desta UF.</p>
            <button
              type="button"
              className="cob-btn cob-btn-danger-ghost"
              onClick={pedirConfirmacaoLimparUf}
              disabled={saving || loadingCidades || !cidades.length}
            >
              Limpar {uf}
            </button>
          </div>
        </aside>
      </div>

      {confirmSincronizar && (
        <CobConfirm
          titleId="cob-sync-title"
          title="Sincronizar cobertura com o SSW?"
          confirmLabel="Sim, sincronizar"
          saving={saving}
          onCancel={() => setConfirmSincronizar(false)}
          onConfirm={confirmarSincronizarSsw}
        >
          Isso consulta as cidades atendidas da Lopesul no SSW e <strong>substitui</strong> a
          cobertura atual no sistema. A consulta leva cerca de um minuto.
        </CobConfirm>
      )}

      {confirmLimparUf && (
        <CobConfirm
          titleId="cob-confirm-title"
          title="Limpar cobertura desta UF?"
          confirmLabel={`Sim, limpar ${uf}`}
          saving={saving}
          danger
          onCancel={() => setConfirmLimparUf(false)}
          onConfirm={confirmarLimparUf}
        >
          Isso remove <strong>todas as {cidades.length} cidade(s)</strong> de <strong>{ufNome}</strong>{' '}
          em <strong>{carrier ? `${carrier.nome} (${carrier.sigla})` : 'esta transportadora'}</strong>.
          A ação não pode ser desfeita pelo painel.
        </CobConfirm>
      )}
    </section>
  )
}

export default PainelCidadesAdmin
