import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './PainelCotacoes.css'

function formatMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num) || value == null || value === '') return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

function formatCep(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 8) return value || '—'
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function formatDoc(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return value ? String(value) : '—'
}

function formatPrazo(value) {
  if (value == null || value === '') return '—'
  const text = String(value).trim()
  if (/^\d+$/.test(text)) return `${text} dia(s)`
  return text
}

function extrairColeta(item) {
  const req = item.payload?.request || {}
  const res = item.payload?.response || {}
  return {
    numero: item.numero_coleta || res.numeroColeta || '',
    solicitante: item.solicitante || req.solicitante || '',
    cotacao: req.cotacao || '',
    transportadora: req.transportadoraNome || req.transportadoraId || '',
    nota: req.numeroNF || req.nroPedido || '',
    pagamento: req.tipoPagamento === 'D' ? 'Destino' : req.tipoPagamento === 'O' ? 'Origem' : '',
  }
}

function extrairDetalhes(item) {
  const req = item.payload?.request || {}
  const res = item.payload?.response || {}
  const numero = res.numeroCotacao || res.cotacao || req.numeroCotacao || null
  const transportadora =
    res.nome ||
    req.transportadoraNome ||
    (req.transportadoraId ? String(req.transportadoraId) : null)

  return {
    numero: numero ? String(numero).trim() : '',
    transportadora: transportadora ? String(transportadora).trim() : '',
    pagador: item.cnpj_pagador || req.cnpjPagador || '',
    remetente: item.cnpj_remetente || req.cnpjRemetente || '',
    destinatario: item.cnpj_destinatario || req.cnpjDestinatario || '',
  }
}

function PainelCotacoes({
  isApproved,
  busyResumo,
  resumo,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const aba = new URLSearchParams(location.search).get('aba') === 'coletas' ? 'coletas' : 'cotacoes'
  const [itens, setItens] = useState([])
  const [coletas, setColetas] = useState([])
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')

  function abrirAba(proxima) {
    navigate(proxima === 'coletas' ? '/painel/cotacoes?aba=coletas' : '/painel/cotacoes', { replace: true })
  }

  useEffect(() => {
    if (!isApproved) {
      setItens([])
      setColetas([])
      return undefined
    }

    let active = true
    setBusy(true)
    setErro('')

    const consulta =
      aba === 'coletas'
        ? supabase
            .from('coletas')
            .select(
              'id, created_at, numero_coleta, solicitante, cep_coleta, cep_entrega, quantidade, peso, limite_coleta, payload',
            )
            .order('created_at', { ascending: false })
            .limit(50)
        : supabase
            .from('cotacoes')
            .select(
              'id, created_at, cep_origem, cep_destino, total_frete, prazo, quantidade, peso, valor_nf, cnpj_pagador, cnpj_remetente, cnpj_destinatario, payload',
            )
            .order('created_at', { ascending: false })
            .limit(50)

    consulta
      .then(({ data, error }) => {
        if (!active) return
        if (error) throw error
        if (aba === 'coletas') setColetas(data || [])
        else setItens(data || [])
      })
      .catch((error) => {
        if (active) {
          setErro(
            error.message ||
              (aba === 'coletas'
                ? 'Não foi possível carregar as coletas.'
                : 'Não foi possível carregar as cotações.'),
          )
        }
      })
      .finally(() => {
        if (active) setBusy(false)
      })

    return () => {
      active = false
    }
  }, [isApproved, aba])

  return (
    <div className="painel-section">
      <section className="painel-cards painel-cards-stats" aria-label="Resumo de cotações">
        <button
          type="button"
          className={`painel-card is-stat is-clickable${aba === 'cotacoes' ? ' is-active-stat' : ''}`}
          aria-current={aba === 'cotacoes' ? 'true' : undefined}
          onClick={() => abrirAba('cotacoes')}
        >
          <span>Cotações</span>
          <strong>{isApproved ? (busyResumo ? '…' : resumo.cotacoes) : '—'}</strong>
        </button>
        <button
          type="button"
          className={`painel-card is-stat is-clickable${aba === 'coletas' ? ' is-active-stat' : ''}`}
          aria-current={aba === 'coletas' ? 'true' : undefined}
          onClick={() => abrirAba('coletas')}
        >
          <span>Coletas</span>
          <strong>{isApproved ? (busyResumo ? '…' : resumo.coletas) : '—'}</strong>
        </button>
        <article className="painel-card is-stat">
          <span>Último frete</span>
          <strong>{isApproved ? (busyResumo ? '…' : formatMoney(resumo.ultimoFrete)) : '—'}</strong>
          {resumo.ultimaData ? <small>{formatDate(resumo.ultimaData)}</small> : null}
        </article>
      </section>

      {isApproved && aba === 'cotacoes' ? (
        <section className="cotacoes-hist" aria-label="Lista de cotações">
          <div className="cotacoes-hist-head">
            <h3>Histórico de cotações</h3>
          </div>

          {erro ? (
            <p className="auth-alert" role="alert">
              {erro}
            </p>
          ) : null}

          {!busy && !erro && itens.length === 0 ? (
            <p className="painel-muted">Nenhuma cotação registrada nesta conta ainda.</p>
          ) : null}

          {itens.length > 0 ? (
            <ul className="cotacoes-hist-lista">
              {itens.map((item) => {
                const det = extrairDetalhes(item)
                return (
                  <li key={item.id}>
                    <div className="cotacoes-hist-main">
                      <div className="cotacoes-hist-titulo">
                        <strong>
                          {det.numero ? `Cotação nº ${det.numero}` : 'Cotação'}
                        </strong>
                        {det.transportadora ? (
                          <em className="cotacoes-hist-carrier">{det.transportadora}</em>
                        ) : null}
                      </div>
                      <span>{formatDate(item.created_at)}</span>
                    </div>

                    <div className="cotacoes-hist-valor">{formatMoney(item.total_frete)}</div>

                    <dl className="cotacoes-hist-empresas">
                      <div>
                        <dt>Pagador</dt>
                        <dd>{formatDoc(det.pagador)}</dd>
                      </div>
                      <div>
                        <dt>Remetente</dt>
                        <dd>{formatDoc(det.remetente)}</dd>
                      </div>
                      <div>
                        <dt>Destinatário</dt>
                        <dd>{formatDoc(det.destinatario)}</dd>
                      </div>
                    </dl>

                    <div className="cotacoes-hist-rota">
                      <span>{formatCep(item.cep_origem)}</span>
                      <span aria-hidden="true">→</span>
                      <span>{formatCep(item.cep_destino)}</span>
                    </div>
                    <div className="cotacoes-hist-meta">
                      <span>Prazo: {formatPrazo(item.prazo)}</span>
                      {item.quantidade != null ? <span>Vol: {item.quantidade}</span> : null}
                      {item.peso != null ? <span>Peso: {item.peso} kg</span> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      {isApproved && aba === 'coletas' ? (
        <section className="cotacoes-hist" aria-label="Lista de coletas">
          <div className="cotacoes-hist-head">
            <h3>Histórico de coletas</h3>
          </div>

          {erro ? (
            <p className="auth-alert" role="alert">
              {erro}
            </p>
          ) : null}

          {!busy && !erro && coletas.length === 0 ? (
            <p className="painel-muted">Nenhuma coleta solicitada nesta conta ainda.</p>
          ) : null}

          {coletas.length > 0 ? (
            <ul className="cotacoes-hist-lista">
              {coletas.map((item) => {
                const det = extrairColeta(item)
                return (
                  <li key={item.id}>
                    <div className="cotacoes-hist-main">
                      <div className="cotacoes-hist-titulo">
                        <strong>
                          {det.numero ? `Coleta nº ${det.numero}` : 'Coleta'}
                        </strong>
                        {det.transportadora ? (
                          <em className="cotacoes-hist-carrier">{det.transportadora}</em>
                        ) : null}
                      </div>
                      <span>{formatDate(item.created_at)}</span>
                    </div>

                    <dl className="cotacoes-hist-empresas">
                      <div>
                        <dt>Solicitante</dt>
                        <dd>{det.solicitante || '—'}</dd>
                      </div>
                      <div>
                        <dt>Cotação</dt>
                        <dd>{det.cotacao || '—'}</dd>
                      </div>
                      <div>
                        <dt>NF</dt>
                        <dd>{det.nota || '—'}</dd>
                      </div>
                    </dl>

                    <div className="cotacoes-hist-rota">
                      <span>{formatCep(item.cep_coleta)}</span>
                      <span aria-hidden="true">→</span>
                      <span>{formatCep(item.cep_entrega)}</span>
                    </div>
                    <div className="cotacoes-hist-meta">
                      {item.limite_coleta ? <span>Limite: {formatDate(item.limite_coleta)}</span> : null}
                      {det.pagamento ? <span>Pagamento: {det.pagamento}</span> : null}
                      {item.quantidade != null ? <span>Vol: {item.quantidade}</span> : null}
                      {item.peso != null ? <span>Peso: {item.peso} kg</span> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default PainelCotacoes
