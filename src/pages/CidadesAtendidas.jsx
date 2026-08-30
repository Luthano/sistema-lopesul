import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import MapaBrasil from '../components/MapaBrasil'
import Reveal from '../components/Reveal'
import {
  buscarCidadesPorUf,
  buscarUfsCobertura,
  cityName,
  citySiglas,
  formatCityName,
  matchCity,
} from './cidadesBusca'
import { UFS_ATENDIDAS } from '../lib/ufsAtendidas'
import './CidadesAtendidas.css'

function cacheUfValido(data) {
  if (!data || !Array.isArray(data.cidades) || !Array.isArray(data.carriers)) return false
  if (data.cidades.length === 0) return true
  const first = data.cidades[0]
  return Boolean(first && typeof first === 'object' && Array.isArray(first.siglas))
}

function intersecaoSiglas(a = [], b = []) {
  const setB = new Set(b)
  return a.filter((sigla) => setB.has(sigla))
}

function filtrarCidades(lista = [], termo = '') {
  const t = String(termo).trim().toLocaleLowerCase('pt-BR')
  if (!t) return lista
  return lista.filter((item) => cityName(item).toLocaleLowerCase('pt-BR').includes(t))
}

function CidadeCampo({
  label,
  placeholder,
  value,
  onChange,
  onFocusCampo,
  cidades,
  aberto,
  onAbrir,
  onFechar,
}) {
  const [filtro, setFiltro] = useState('')
  const onFecharRef = useRef(onFechar)
  onFecharRef.current = onFechar
  const filtradas = useMemo(() => filtrarCidades(cidades, filtro), [cidades, filtro])

  useEffect(() => {
    if (!aberto) return undefined
    setFiltro('')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event) {
      if (event.key === 'Escape') onFecharRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [aberto])

  function abrir() {
    onFocusCampo()
    onAbrir()
  }

  return (
    <label className="cidades-field-wide cidades-campo-cidade">
      <div className="cidades-campo-cidade-wrap">
        <button type="button" className="cidades-campo-cidade-trigger" aria-label={label} onClick={abrir}>
          <span className={value ? '' : 'is-placeholder'}>{value || placeholder}</span>
          <span className="cidades-campo-cidade-hint" aria-hidden="true">
            ▾
          </span>
        </button>

        {aberto
          ? createPortal(
              <div className="cidades-popup-backdrop" role="presentation" onClick={onFechar}>
                <div
                  className="cidades-popup"
                  role="dialog"
                  aria-modal="true"
                  aria-label={label}
                  onClick={(e) => e.stopPropagation()}
                >
                  <header className="cidades-popup-head">
                    <div>
                      <p className="cidades-map-label">{label}</p>
                      <h3>
                        {cidades.length
                          ? `${cidades.length} cidade${cidades.length === 1 ? '' : 's'} disponíveis`
                          : 'Selecione a UF primeiro'}
                      </h3>
                    </div>
                    <button type="button" className="cidades-popup-fechar" onClick={onFechar}>
                      Fechar
                    </button>
                  </header>

                  <input
                    className="cidades-popup-busca"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    placeholder="Buscar cidade…"
                    autoFocus
                  />

                  <div className="cidades-popup-grid" role="listbox" aria-label={label}>
                    {!cidades.length ? (
                      <p className="cidades-suggest-vazio">Selecione a UF para listar as cidades.</p>
                    ) : filtradas.length === 0 ? (
                      <p className="cidades-suggest-vazio">Nenhuma cidade encontrada.</p>
                    ) : (
                      filtradas.map((item) => {
                        const nome = cityName(item)
                        const formatado = formatCityName(nome)
                        const siglas = citySiglas(item)
                        const selecionada =
                          String(value || '').trim().toLocaleLowerCase('pt-BR') ===
                          nome.toLocaleLowerCase('pt-BR')
                        return (
                          <button
                            key={`${nome}-${siglas.join('-')}`}
                            type="button"
                            role="option"
                            aria-selected={selecionada}
                            className={`cidades-suggest-item${selecionada ? ' is-selected' : ''}`}
                            onClick={() => {
                              onChange(formatado)
                              onFechar()
                            }}
                          >
                            <span>{formatado}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </label>
  )
}

function CidadesAtendidas() {
  const [ufOrigem, setUfOrigem] = useState('')
  const [cidadeOrigem, setCidadeOrigem] = useState('')
  const [ufDestino, setUfDestino] = useState('')
  const [cidadeDestino, setCidadeDestino] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingLista, setLoadingLista] = useState(false)
  const [erro, setErro] = useState('')
  const [consulta, setConsulta] = useState(null)
  const [cacheUf, setCacheUf] = useState({})
  const [ufsDisponiveis, setUfsDisponiveis] = useState(UFS_ATENDIDAS)
  const [mapaFoco, setMapaFoco] = useState('destino')
  const [painelCidade, setPainelCidade] = useState(null)

  useEffect(() => {
    let cancelled = false
    buscarUfsCobertura()
      .then((ufs) => {
        if (!cancelled && ufs.length) setUfsDisponiveis(ufs)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const sugestoesOrigem = cacheUf[ufOrigem]?.cidades || []
  const sugestoesDestino = cacheUf[ufDestino]?.cidades || []

  const ufLista = mapaFoco === 'origem' ? ufOrigem : ufDestino
  const cidadeListaFiltro = mapaFoco === 'origem' ? cidadeOrigem : cidadeDestino
  const cidadesDaUf = cacheUf[ufLista]?.cidades || []
  const carregandoLista = Boolean(ufLista && !cacheUfValido(cacheUf[ufLista]) && loadingLista)

  const cidadesFiltradas = useMemo(() => {
    const termo = String(cidadeListaFiltro || '').trim().toLocaleLowerCase('pt-BR')
    if (!termo) return cidadesDaUf
    return cidadesDaUf.filter((item) => cityName(item).toLocaleLowerCase('pt-BR').includes(termo))
  }, [cidadesDaUf, cidadeListaFiltro])

  const ufsSelect = useMemo(() => {
    const base = ufsDisponiveis.length ? ufsDisponiveis : UFS_ATENDIDAS
    return base
  }, [ufsDisponiveis])

  async function carregarUf(proximaUf, { comLoadingLista = false } = {}) {
    if (!proximaUf) return null
    const cached = cacheUf[proximaUf]
    if (cacheUfValido(cached)) return cached

    if (comLoadingLista) setLoadingLista(true)
    try {
      const data = await buscarCidadesPorUf(proximaUf)
      setCacheUf((prev) => ({ ...prev, [proximaUf]: data }))
      return data
    } finally {
      if (comLoadingLista) setLoadingLista(false)
    }
  }

  async function pesquisar({ mostrarLoading = true } = {}) {
    const origemUf = ufOrigem
    const destinoUf = ufDestino
    const origemNome = String(cidadeOrigem || '').trim()
    const destinoNome = String(cidadeDestino || '').trim()

    if (!origemUf || !origemNome || !destinoUf || !destinoNome) {
      setErro('Informe UF e cidade de saída e de destino.')
      return
    }

    setErro('')
    if (mostrarLoading) setLoading(true)

    try {
      const [dataOrigem, dataDestino] = await Promise.all([
        carregarUf(origemUf),
        carregarUf(destinoUf),
      ])

      const origemMatch = matchCity(origemNome, dataOrigem?.cidades || [])
      const destinoMatch = matchCity(destinoNome, dataDestino?.cidades || [])

      const siglasOrigem = origemMatch ? citySiglas(origemMatch) : []
      const siglasDestino = destinoMatch ? citySiglas(destinoMatch) : []
      const siglasDiretas = intersecaoSiglas(siglasOrigem, siglasDestino)

      let tipo = 'nao'
      let siglas = []

      if (origemMatch && destinoMatch && siglasDiretas.length) {
        tipo = 'direta'
        siglas = siglasDiretas
      }

      setConsulta({
        tipo,
        atendida: tipo !== 'nao',
        siglas,
        origem: {
          uf: origemUf,
          cidade: origemMatch ? cityName(origemMatch) : origemNome,
          encontrada: Boolean(origemMatch),
        },
        destino: {
          uf: destinoUf,
          cidade: destinoMatch ? cityName(destinoMatch) : destinoNome,
          encontrada: Boolean(destinoMatch),
        },
      })

      requestAnimationFrame(() => {
        document.getElementById('cidades-resultado')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (error) {
      setConsulta(null)
      setErro(error.message || 'Erro de comunicação com a API.')
    } finally {
      if (mostrarLoading) setLoading(false)
    }
  }

  function limparPesquisa() {
    setUfOrigem('')
    setCidadeOrigem('')
    setUfDestino('')
    setCidadeDestino('')
    setConsulta(null)
    setErro('')
    setLoading(false)
    setLoadingLista(false)
    setMapaFoco('destino')
    setPainelCidade(null)
  }

  async function handlePesquisar(event) {
    event.preventDefault()
    if (consulta) {
      limparPesquisa()
      return
    }
    await pesquisar()
  }

  async function handleMapaUf(proximaUf) {
    setErro('')
    setConsulta(null)

    if (mapaFoco === 'origem') {
      setUfOrigem(proximaUf)
      setCidadeOrigem('')
    } else {
      setUfDestino(proximaUf)
      setCidadeDestino('')
    }

    try {
      await carregarUf(proximaUf, { comLoadingLista: true })
      requestAnimationFrame(() => {
        document.getElementById('cidades-lista-uf')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (error) {
      setErro(error.message || 'Não foi possível carregar as cidades da UF.')
    }
  }

  function escolherCidadeLista(nome) {
    const formatado = formatCityName(nome)
    if (mapaFoco === 'origem') setCidadeOrigem(formatado)
    else setCidadeDestino(formatado)
  }

  const selectedMapUf = mapaFoco === 'origem' ? ufOrigem : ufDestino

  const statusClass = consulta?.tipo === 'direta' ? 'is-ok' : 'is-no'
  const statusTitulo = consulta?.tipo === 'direta' ? 'Rota atendida pela Lopesul' : 'Rota não atendida'

  return (
    <div className="page-shell">
      <div className="page-block cidades-page">
        <section className="cidades-map">
          <div className="cidades-wrap cidades-map-grid">
            <Reveal className="cidades-map-copy">
              <h1>Cidades atendidas</h1>
              <form className="cidades-map-search cidades-map-search-rota" onSubmit={handlePesquisar}>
                <fieldset className="cidades-rota-group">
                  <legend>Saída</legend>
                  <div className="cidades-rota-fields">
                    <label>
                      <select
                        aria-label="UF de saída"
                        value={ufOrigem}
                        onFocus={() => setMapaFoco('origem')}
                        onChange={(e) => {
                          setUfOrigem(e.target.value)
                          setConsulta(null)
                          setMapaFoco('origem')
                          setPainelCidade(null)
                          if (e.target.value) carregarUf(e.target.value, { comLoadingLista: true }).catch(() => {})
                        }}
                      >
                        <option value="">UF</option>
                        {ufsSelect.map((item) => (
                          <option key={`o-${item}`} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <CidadeCampo
                      label="Cidade de saída"
                      placeholder="Cidade de origem"
                      value={cidadeOrigem}
                      onChange={setCidadeOrigem}
                      onFocusCampo={() => setMapaFoco('origem')}
                      cidades={sugestoesOrigem}
                      aberto={painelCidade === 'origem'}
                      onAbrir={() => setPainelCidade('origem')}
                      onFechar={() => setPainelCidade((atual) => (atual === 'origem' ? null : atual))}
                    />
                  </div>
                </fieldset>

                <fieldset className="cidades-rota-group">
                  <legend>Destino</legend>
                  <div className="cidades-rota-fields">
                    <label>
                      <select
                        aria-label="UF de destino"
                        value={ufDestino}
                        onFocus={() => setMapaFoco('destino')}
                        onChange={(e) => {
                          setUfDestino(e.target.value)
                          setConsulta(null)
                          setMapaFoco('destino')
                          setPainelCidade(null)
                          if (e.target.value) carregarUf(e.target.value, { comLoadingLista: true }).catch(() => {})
                        }}
                      >
                        <option value="">UF</option>
                        {ufsSelect.map((item) => (
                          <option key={`d-${item}`} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <CidadeCampo
                      label="Cidade de destino"
                      placeholder="Cidade de destino"
                      value={cidadeDestino}
                      onChange={setCidadeDestino}
                      onFocusCampo={() => setMapaFoco('destino')}
                      cidades={sugestoesDestino}
                      aberto={painelCidade === 'destino'}
                      onAbrir={() => setPainelCidade('destino')}
                      onFechar={() => setPainelCidade((atual) => (atual === 'destino' ? null : atual))}
                    />
                  </div>
                </fieldset>

                <button type="submit" className="cidades-cta" disabled={loading}>
                  {loading ? 'Pesquisando…' : consulta ? 'Nova pesquisa' : 'Pesquisar'}
                </button>
              </form>
              {erro && (
                <p className="cidades-map-erro" role="alert">
                  {erro}
                </p>
              )}
            </Reveal>
            <MapaBrasil onSelectUf={handleMapaUf} selectedUf={selectedMapUf} />
          </div>
        </section>

        {(consulta || ufLista) && (
          <section className="cidades-wrap cidades-resultado" id="cidades-resultado">
            {consulta ? (
              <div id="cidades-lista-uf" className={`cidades-status cidades-status-unificado ${statusClass}`}>
                {consulta.tipo !== 'direta' ? (
                  <div className="cidades-status-titulo">
                    <strong>{statusTitulo}</strong>
                  </div>
                ) : null}

                <div className={`cidades-selecionadas-grid${consulta.atendida ? ' has-cta' : ''}`}>
                  <div className="cidades-selecionadas-card">
                    <span className="cidades-lista-papel">Saída</span>
                    <strong>
                      {formatCityName(consulta.origem.cidade)}
                      <span> / {consulta.origem.uf}</span>
                    </strong>
                  </div>
                  <div className="cidades-selecionadas-seta" aria-hidden="true">
                    →
                  </div>
                  <div className="cidades-selecionadas-card">
                    <span className="cidades-lista-papel">Destino</span>
                    <strong>
                      {formatCityName(consulta.destino.cidade)}
                      <span> / {consulta.destino.uf}</span>
                    </strong>
                  </div>
                  {consulta.atendida ? (
                    <Link to="/cotacao" className="cidades-cta cidades-cta-inline">
                      Fazer cotação
                    </Link>
                  ) : null}
                </div>

                {consulta.tipo === 'nao' && (
                  <p className="cidades-map-note">
                    {!consulta.origem.encontrada && !consulta.destino.encontrada
                      ? 'Saída e destino não encontrados na cobertura cadastrada.'
                      : !consulta.origem.encontrada
                        ? 'Cidade de saída não encontrada na cobertura.'
                        : !consulta.destino.encontrada
                          ? 'Cidade de destino não encontrada na cobertura.'
                          : 'A Lopesul não atende esta combinação de saída e destino.'}
                  </p>
                )}
              </div>
            ) : (
              ufLista && (
                <div id="cidades-lista-uf">
                  <div className="cidades-resultado-head">
                    <div>
                      <p className="cidades-map-label">
                        Cidades de {mapaFoco === 'origem' ? 'saída' : 'destino'}
                      </p>
                      <h2>
                        {carregandoLista
                          ? `Carregando cidades em ${ufLista}…`
                          : `${cidadesDaUf.length} cidade${cidadesDaUf.length === 1 ? '' : 's'} em ${ufLista}`}
                      </h2>
                    </div>
                  </div>

                  {carregandoLista ? (
                    <p className="cidades-map-note">Buscando cobertura cadastrada…</p>
                  ) : cidadesFiltradas.length === 0 ? (
                    <p className="cidades-map-note">
                      {cidadesDaUf.length === 0
                        ? 'Nenhuma cidade cadastrada para esta UF.'
                        : 'Nenhuma cidade encontrada com esse filtro.'}
                    </p>
                  ) : (
                    <ul className="cidades-lista">
                      {cidadesFiltradas.map((item) => {
                        const nome = cityName(item)
                        const siglas = citySiglas(item)
                        const selecionada =
                          String(cidadeListaFiltro || '').trim().toLocaleLowerCase('pt-BR') ===
                          nome.toLocaleLowerCase('pt-BR')
                        return (
                          <li key={`${ufLista}-${nome}-${siglas.join('-')}`} className={selecionada ? 'is-match' : ''}>
                            <button
                              type="button"
                              className="cidades-lista-btn"
                              onClick={() => escolherCidadeLista(nome)}
                            >
                              <span className="cidades-lista-nome">{formatCityName(nome)}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default CidadesAtendidas
