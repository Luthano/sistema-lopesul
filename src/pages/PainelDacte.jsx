import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, supabaseConfigured } from '../lib/supabase'

const SSW_SIGLA = 'JLU'
const SSW_SERVICO_URL = 'https://ssw.inf.br/2/servico'

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function mapRow(row) {
  return {
    id: row.id,
    cnpj: row.cnpj_remetente,
    nroNf: row.nro_nf,
    senha: '',
    remetente: row.remetente || '',
    destinatario: row.destinatario || '',
    pedido: row.pedido || '',
    localizado: Boolean(row.localizado),
    mensagem: row.mensagem || '',
    consultadoEm: row.consulted_at || row.created_at,
  }
}

function openSswServico({ tipo, cnpj, nroNf, senha }) {
  const isXml = tipo === 'xml'
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = SSW_SERVICO_URL
  form.target = '_blank'
  form.rel = 'noopener'
  form.style.display = 'none'

  const fields = {
    action: isXml ? 'xml' : 'dacte',
    id: isXml ? '52' : '51',
    sigla_emp: SSW_SIGLA,
    sc: 'N',
    sm: 'N',
    cnpj: onlyDigits(cnpj),
    password: senha || '',
    nronf: onlyDigits(nroNf),
  }

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
  form.remove()
}

function PainelDacte() {
  const { user, profile } = useAuth()
  const [cnpj, setCnpj] = useState(() => onlyDigits(profile?.cnpj || ''))
  const [nroNf, setNroNf] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingLista, setLoadingLista] = useState(true)
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [documentos, setDocumentos] = useState([])
  const [removingId, setRemovingId] = useState('')

  useEffect(() => {
    const fromProfile = onlyDigits(profile?.cnpj || '')
    if (fromProfile && !cnpj) setCnpj(fromProfile)
  }, [profile, cnpj])

  useEffect(() => {
    if (!user || !supabaseConfigured) {
      setLoadingLista(false)
      return undefined
    }

    let active = true
    setLoadingLista(true)

    supabase
      .from('dacte_consultas')
      .select('*')
      .order('consulted_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setErro(error.message || 'Não foi possível carregar o histórico de DACTE.')
          setDocumentos([])
        } else {
          setDocumentos((data || []).map(mapRow))
        }
      })
      .finally(() => {
        if (active) setLoadingLista(false)
      })

    return () => {
      active = false
    }
  }, [user])

  const podeBuscar = useMemo(() => {
    const doc = onlyDigits(cnpj)
    return (doc.length === 11 || doc.length === 14) && Boolean(onlyDigits(nroNf))
  }, [cnpj, nroNf])

  async function persistirConsulta(item) {
    if (!user || !supabaseConfigured) return item

    const payload = {
      user_id: user.id,
      cnpj_remetente: item.cnpj,
      nro_nf: item.nroNf,
      remetente: item.remetente || null,
      destinatario: item.destinatario || null,
      pedido: item.pedido || null,
      localizado: item.localizado,
      mensagem: item.mensagem || null,
      consulted_at: item.consultadoEm,
    }

    const { data, error } = await supabase
      .from('dacte_consultas')
      .upsert(payload, { onConflict: 'user_id,cnpj_remetente,nro_nf' })
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('Erro ao gravar DACTE:', error.message)
      return item
    }

    return data ? mapRow(data) : item
  }

  async function handleBuscar(event) {
    event.preventDefault()
    setErro('')
    setInfo('')

    const doc = onlyDigits(cnpj)
    const nf = onlyDigits(nroNf)

    if (doc.length !== 11 && doc.length !== 14) {
      setErro('Informe um CPF ou CNPJ do remetente válido.')
      return
    }
    if (!nf) {
      setErro('Informe o número da nota fiscal vinculada ao CT-e.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/rastreio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'documento',
          documento: doc,
          nroNf: nf,
          senha,
        }),
      })
      const data = await response.json().catch(() => null)

      const item = {
        id: `${doc}-${nf}`,
        cnpj: doc,
        nroNf: nf,
        senha: senha.trim(),
        remetente: data?.documentos?.[0]?.remetente || '',
        destinatario: data?.documentos?.[0]?.destinatario || '',
        pedido: data?.documentos?.[0]?.pedido || '',
        localizado: Boolean(data?.sucesso),
        mensagem: data?.mensagem || '',
        consultadoEm: new Date().toISOString(),
      }

      const salvo = await persistirConsulta(item)
      const comSenhaSessao = { ...salvo, senha: senha.trim() }

      setDocumentos((prev) => {
        const semDuplicata = prev.filter(
          (docItem) => !(docItem.cnpj === comSenhaSessao.cnpj && docItem.nroNf === comSenhaSessao.nroNf),
        )
        return [comSenhaSessao, ...semDuplicata]
      })

      if (data?.sucesso) {
        setInfo('CT-e localizado e salvo no histórico. Use os botões para imprimir ou baixar o XML.')
      } else {
        setInfo(
          data?.mensagem
            ? `${data.mensagem} A consulta foi salva; você ainda pode tentar imprimir no portal SSW.`
            : 'Documento não confirmado no rastreio. A consulta foi salva para nova tentativa de impressão.',
        )
      }
    } catch {
      setErro('Não foi possível consultar o CT-e. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function removerItem(id) {
    setRemovingId(id)
    setErro('')

    if (supabaseConfigured && user) {
      const { error } = await supabase.from('dacte_consultas').delete().eq('id', id)
      if (error) {
        setErro(error.message || 'Não foi possível remover a consulta.')
        setRemovingId('')
        return
      }
    }

    setDocumentos((prev) => prev.filter((item) => item.id !== id))
    setRemovingId('')
  }

  return (
    <div className="painel-section">
      <header className="painel-section-head">
        <div>
          <h2>Impressão de CT-e</h2>
          <p>Consulte pela NF do remetente e imprima o DACTE ou baixe o XML no portal SSW. O histórico fica salvo na sua conta.</p>
        </div>
        <div className="painel-dacte-quick">
          <a
            className="painel-section-cta is-ghost"
            href={`${SSW_SERVICO_URL}?id=51&sc=N&sm=N&sigla_emp=${SSW_SIGLA}`}
            target="_blank"
            rel="noreferrer"
          >
            Portal DACTE
          </a>
          <a
            className="painel-section-cta"
            href={`${SSW_SERVICO_URL}?id=52&sc=N&sm=N&sigla_emp=${SSW_SIGLA}`}
            target="_blank"
            rel="noreferrer"
          >
            Portal XML
          </a>
        </div>
      </header>

      <form className="painel-dacte-form" onSubmit={handleBuscar}>
        <label>
          <span>CPF/CNPJ do remetente</span>
          <input
            value={cnpj}
            onChange={(event) => setCnpj(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Somente números"
          />
        </label>
        <label>
          <span>Número da NF</span>
          <input
            value={nroNf}
            onChange={(event) => setNroNf(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ex.: 123456"
          />
        </label>
        <label>
          <span>Senha SSW (opcional)</span>
          <input
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            autoComplete="off"
            placeholder="Se a Lopesul forneceu senha"
          />
        </label>
        <button type="submit" className="painel-section-cta" disabled={loading || !podeBuscar}>
          {loading ? 'Consultando...' : 'Buscar CT-e'}
        </button>
      </form>

      {erro ? (
        <p className="auth-alert" role="alert">
          {erro}
        </p>
      ) : null}
      {info ? <p className="auth-info">{info}</p> : null}

      {loadingLista ? (
        <div className="painel-dacte-empty">
          <strong>Carregando histórico...</strong>
          <p>Buscando consultas DACTE salvas na sua conta.</p>
        </div>
      ) : documentos.length === 0 ? (
        <div className="painel-dacte-empty">
          <strong>Nenhum CT-e na lista</strong>
          <p>Busque por CPF/CNPJ do remetente e número da NF para montar a lista de impressão.</p>
        </div>
      ) : (
        <ul className="painel-dacte-list">
          {documentos.map((item) => (
            <li key={item.id} className="painel-dacte-item">
              <div className="painel-dacte-item-main">
                <div className="painel-dacte-item-title">
                  <strong>NF {item.nroNf}</strong>
                  <span className={`painel-dacte-badge ${item.localizado ? 'is-ok' : 'is-warn'}`}>
                    {item.localizado ? 'Localizado' : 'Não confirmado'}
                  </span>
                </div>
                <p>
                  <span>Remetente</span> {item.remetente || item.cnpj}
                </p>
                {item.destinatario ? (
                  <p>
                    <span>Destinatário</span> {item.destinatario}
                  </p>
                ) : null}
                {item.pedido ? (
                  <p>
                    <span>Pedido</span> {item.pedido}
                  </p>
                ) : null}
              </div>

              <div className="painel-dacte-actions">
                <button
                  type="button"
                  className="painel-section-cta"
                  onClick={() =>
                    openSswServico({
                      tipo: 'dacte',
                      cnpj: item.cnpj,
                      nroNf: item.nroNf,
                      senha: item.senha || senha,
                    })
                  }
                >
                  Imprimir DACTE
                </button>
                <button
                  type="button"
                  className="painel-section-cta is-ghost"
                  onClick={() =>
                    openSswServico({
                      tipo: 'xml',
                      cnpj: item.cnpj,
                      nroNf: item.nroNf,
                      senha: item.senha || senha,
                    })
                  }
                >
                  Baixar XML
                </button>
                <button
                  type="button"
                  className="painel-cancel"
                  disabled={removingId === item.id}
                  onClick={() => removerItem(item.id)}
                >
                  {removingId === item.id ? 'Removendo...' : 'Remover'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PainelDacte
