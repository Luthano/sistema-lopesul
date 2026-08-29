import { useState } from 'react'
import './RastreioPanel.css'

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function RastreioPanel() {
  const [modo, setModo] = useState('danfe')
  const [chaveDanfe, setChaveDanfe] = useState('')
  const [documento, setDocumento] = useState('')
  const [nroNf, setNroNf] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setErro('')
    setResultado(null)

    if (modo === 'danfe' && onlyDigits(chaveDanfe).length !== 44) {
      setErro('Informe a chave DANFE com 44 dígitos.')
      return
    }

    const docDigits = onlyDigits(documento)
    if (modo === 'documento' && docDigits.length !== 11 && docDigits.length !== 14) {
      setErro('Informe um CPF ou CNPJ válido.')
      return
    }

    if (modo === 'documento' && !onlyDigits(nroNf)) {
      setErro('Informe o número da nota fiscal.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/rastreio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          modo === 'danfe'
            ? { modo: 'danfe', chaveDanfe }
            : { modo: 'documento', documento, nroNf, senha },
        ),
      })
      const data = await response.json().catch(() => null)
      if (!data) {
        setErro('Resposta inválida do servidor de rastreio.')
        return
      }
      if (!data.sucesso) {
        setErro(data.mensagem || 'Encomenda não localizada.')
        return
      }
      if (!Array.isArray(data.documentos) || data.documentos.length === 0) {
        setErro(data.mensagem || 'Encomenda localizada, mas sem eventos para exibir.')
        return
      }
      setResultado(data)
    } catch {
      setErro('Não foi possível consultar o rastreio. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rastreio-panel">
      <div className="rastreio-modes" role="tablist" aria-label="Tipo de consulta">
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'danfe'}
          className={modo === 'danfe' ? 'is-active' : ''}
          onClick={() => setModo('danfe')}
        >
          Chave DANFE
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'documento'}
          className={modo === 'documento' ? 'is-active' : ''}
          onClick={() => setModo('documento')}
        >
          NF + CPF/CNPJ
        </button>
      </div>

      <form className="rastreio-form" onSubmit={handleSubmit}>
        {modo === 'danfe' ? (
          <label>
            <span>Chave de acesso da NF-e (44 dígitos)</span>
            <input
              value={chaveDanfe}
              onChange={(event) => setChaveDanfe(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="3520 1234 5678 9012 3456 7890 1234 5678 9012 3456 7890"
              maxLength={54}
            />
          </label>
        ) : (
          <>
            <div className="rastreio-grid">
              <label>
                <span>CPF ou CNPJ</span>
                <input
                  value={documento}
                  onChange={(event) => setDocumento(event.target.value)}
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
            </div>
            <label>
              <span>Senha de rastreio (opcional, só para CNPJ)</span>
              <input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                autoComplete="off"
                placeholder="Se a Lopesul forneceu senha de consulta"
              />
            </label>
          </>
        )}

        <button type="submit" className="landing-cta" disabled={loading}>
          {loading ? 'Rastreando...' : 'Rastrear encomenda'}
        </button>
      </form>

      {erro ? <p className="rastreio-alert">{erro}</p> : null}

      {resultado?.documentos?.map((doc, index) => (
        <article key={`${doc.nroNf}-${index}`} className="rastreio-result">
          <header>
            <p>NF {doc.nroNf || '—'}</p>
            {doc.pedido ? <span>Pedido {doc.pedido}</span> : null}
          </header>
          <div className="rastreio-parties">
            {doc.remetente ? <p><strong>Remetente</strong> {doc.remetente}</p> : null}
            {doc.destinatario ? <p><strong>Destinatário</strong> {doc.destinatario}</p> : null}
          </div>
          {(doc.eventos?.length ?? 0) === 0 ? (
            <p className="rastreio-alert">Documento encontrado, sem eventos de rastreio disponíveis.</p>
          ) : (
            <ol className="rastreio-timeline">
              {doc.eventos.map((evento, eventIndex) => (
                <li key={`${evento.dataHora}-${eventIndex}`}>
                  <div>
                    <strong>{evento.ocorrencia || 'Atualização'}</strong>
                    <p>{evento.descricao}</p>
                    {evento.recebedor ? <p>Recebedor: {evento.recebedor}</p> : null}
                  </div>
                  <aside>
                    <time>{formatDateTime(evento.dataHora)}</time>
                    <span>{[evento.cidade, evento.filial].filter(Boolean).join(' · ')}</span>
                  </aside>
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </div>
  )
}

export default RastreioPanel
