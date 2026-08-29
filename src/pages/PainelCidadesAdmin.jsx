import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '../lib/authFetch'
import { supabase } from '../lib/supabase'
import { UFS_BRASIL } from '../lib/ufsAtendidas'
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

function PainelCidadesAdmin() {
  const [carriers, setCarriers] = useState([])
  const [carrierId, setCarrierId] = useState('')
  const [uf, setUf] = useState('PR')
  const [cidades, setCidades] = useState([])
  const [lote, setLote] = useState('')
  const [novaCidade, setNovaCidade] = useState('')
  const [filtro, setFiltro] = useState('')
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

  return (
    <section className="painel-admin cob-admin">
      {erro && (
        <p className="auth-alert" role="alert">
          {erro}
        </p>
      )}
      {info && <p className="auth-info">{info}</p>}

      <div className="cob-toolbar">
        <label>
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
        <label>
          <span>UF</span>
          <select value={uf} onChange={(e) => setUf(e.target.value)} disabled={toolbarBusy}>
            {UFS_BRASIL.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="cob-filter">
          <span>Filtrar lista</span>
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar cidade" />
        </label>
      </div>

      <div className="cob-grid">
        <form className="cob-card" onSubmit={handleAddUma}>
          <h3>Adicionar cidade</h3>
          <p className="cob-hint">
            Em {uf} · {carrier ? `${carrier.nome} (${carrier.sigla})` : '—'}
          </p>
          <input
            value={novaCidade}
            onChange={(e) => setNovaCidade(e.target.value)}
            placeholder="Ex.: Cascavel"
            disabled={saving || !carrierId}
          />
          <button type="submit" className="painel-section-cta" disabled={saving || !carrierId}>
            Salvar cidade
          </button>
        </form>

        <form className="cob-card" onSubmit={handleAddLote}>
          <h3>Importar em lote</h3>
          <p className="cob-hint">Uma cidade por linha (ou separadas por vírgula).</p>
          <textarea
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            rows={8}
            placeholder={'Cascavel\nMaringa\nLondrina'}
            disabled={saving || !carrierId}
          />
          <button type="submit" className="painel-section-cta" disabled={saving || !carrierId}>
            Importar lista
          </button>
        </form>

        <div className="cob-card">
          <h3>Sincronizar do SSW</h3>
          <p className="cob-hint">
            Lê a malha pública da Lopesul no SSW (área atendida) e substitui as cidades cadastradas.
          </p>
          <button
            type="button"
            className="painel-section-cta"
            disabled={saving || !carrierId}
            onClick={() => {
              setErro('')
              setInfo('')
              setConfirmSincronizar(true)
            }}
          >
            Buscar cidades no SSW
          </button>
        </div>
      </div>

      <div className="cob-list-head">
        <div>
          <strong>
            {cidadesFiltradas.length} cidade(s) em {uf}
            {loadingCidades ? ' · atualizando…' : ''}
          </strong>
          <span>{carrier ? `${carrier.nome} · ${carrier.sigla}` : ''}</span>
        </div>
        <button
          type="button"
          className="painel-section-cta cob-btn-compact"
          onClick={pedirConfirmacaoLimparUf}
          disabled={saving || loadingCidades || !cidades.length}
        >
          Limpar UF
        </button>
      </div>

      {confirmSincronizar && (
        <div
          className="cob-confirm-backdrop"
          role="presentation"
          onClick={() => !saving && setConfirmSincronizar(false)}
        >
          <div
            className="cob-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cob-sync-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cob-sync-title">Sincronizar cobertura com o SSW?</h3>
            <p>
              Isso consulta as cidades atendidas da Lopesul no SSW e <strong>substitui</strong> a
              cobertura atual no sistema. A consulta leva cerca de um minuto.
            </p>
            <div className="cob-confirm-actions">
              <button
                type="button"
                className="painel-section-cta is-ghost cob-btn-compact"
                onClick={() => setConfirmSincronizar(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="painel-section-cta cob-btn-compact"
                onClick={confirmarSincronizarSsw}
                disabled={saving}
              >
                Sim, sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmLimparUf && (
        <div
          className="cob-confirm-backdrop"
          role="presentation"
          onClick={() => !saving && setConfirmLimparUf(false)}
        >
          <div
            className="cob-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cob-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cob-confirm-title">Limpar cobertura desta UF?</h3>
            <p>
              Isso remove <strong>todas as {cidades.length} cidade(s)</strong> de{' '}
              <strong>{uf}</strong> em{' '}
              <strong>{carrier ? `${carrier.nome} (${carrier.sigla})` : 'esta transportadora'}</strong>.
              A ação não pode ser desfeita pelo painel.
            </p>
            <div className="cob-confirm-actions">
              <button
                type="button"
                className="painel-section-cta is-ghost cob-btn-compact"
                onClick={() => setConfirmLimparUf(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="painel-section-cta cob-btn-compact"
                onClick={confirmarLimparUf}
                disabled={saving}
              >
                Sim, limpar UF
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingCidades && cidades.length === 0 ? (
        <p className="painel-muted">Carregando…</p>
      ) : showListaVazia ? (
        <p className="painel-muted">Nenhuma cidade nesta UF para a transportadora selecionada.</p>
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
                      <button type="submit" className="painel-section-cta cob-btn-compact" disabled={saving}>
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="painel-section-cta is-ghost cob-btn-compact"
                        onClick={fecharEdicao}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="painel-section-cta cob-btn-compact"
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
                    <button type="button" className="cob-edit-open" onClick={() => abrirEdicao(item)} disabled={saving}>
                      Editar
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default PainelCidadesAdmin
