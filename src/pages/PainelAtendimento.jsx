import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  buscarConversaCliente,
  conversaComPessoa,
  enviarMensagem,
  excluirConversa,
  excluirMensagem,
  formatarHoraMensagem,
  garantirConversaCliente,
  ehFiltroClientes,
  FILTRO_CLIENTES,
  labelSetor,
  listarAtendentes,
  listarClientes,
  listarConversasCliente,
  listarConversasMaster,
  outroDaConversa,
  listarMensagens,
  marcarLida,
  mensagemVisivelPara,
  nomeAtendente,
  SETORES_ATENDIMENTO,
} from '../lib/atendimento'
import { enviarArquivoConversa } from '../lib/atendimentoAnexos'
import { isPerfilInterno, setorDaConta, setoresDaConta } from '../lib/tiposConta'
import { supabase } from '../lib/supabase'
import { Trash2 } from 'lucide-react'
import AtendimentoComposer from './AtendimentoComposer'
import AtendimentoMidia from './AtendimentoMidia'
import './PainelAtendimento.css'

function iniciais(nome) {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!partes.length) return 'L'
  return ((partes[0][0] || '') + (partes[1]?.[0] || '')).toUpperCase()
}

function Avatar({ nome }) {
  return (
    <span className="atend-avatar" aria-hidden="true">
      {iniciais(nome)}
    </span>
  )
}

function ConfirmApagar({
  nome,
  titulo = 'Apagar conversa',
  texto,
  confirmLabel = 'Apagar conversa',
  busy,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="atend-confirm-backdrop" role="presentation" onClick={busy ? undefined : onCancel}>
      <div
        className="atend-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atend-apagar-titulo"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="atend-apagar-titulo">{titulo}</h3>
        <p>{texto || `Excluir toda a conversa com ${nome}? Mensagens e arquivos não voltam.`}</p>
        <div className="atend-confirm-actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="is-danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Apagando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function BotoesSetor({ ativo, onEscolher, naoLidas = {}, setores = SETORES_ATENDIMENTO }) {
  return (
    <div className="atend-setores" role="tablist" aria-label="Setor de atendimento">
      {setores.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={ativo === item.id}
          className={ativo === item.id ? 'is-active' : ''}
          onClick={() => onEscolher(ativo === item.id ? '' : item.id)}
        >
          {item.label}
          {naoLidas[item.id] > 0 ? <span>{naoLidas[item.id]}</span> : null}
        </button>
      ))}
    </div>
  )
}

function ChatThread({ mensagens, setMensagens, userId, vazio }) {
  const fimRef = useRef(null)
  const [apagarItem, setApagarItem] = useState(null)
  const [apagando, setApagando] = useState(false)
  const [erroApagar, setErroApagar] = useState('')

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length])

  async function handleApagarMensagem() {
    if (!apagarItem) return
    setErroApagar('')
    setApagando(true)
    try {
      await excluirMensagem(apagarItem, userId)
      setMensagens((prev) => prev.filter((item) => item.id !== apagarItem.id))
      setApagarItem(null)
    } catch (error) {
      setErroApagar(error.message || 'Não foi possível apagar a mensagem.')
    } finally {
      setApagando(false)
    }
  }

  if (!mensagens.length) {
    return <p className="atend-vazio">{vazio}</p>
  }

  return (
    <>
      {erroApagar ? <p className="atend-vazio">{erroApagar}</p> : null}
      <ul className="atend-msgs">
        {mensagens.map((item) => {
          const propria = item.autor_id === userId
          return (
            <li key={item.id} className={propria ? 'is-own' : 'is-other'}>
              <AtendimentoMidia item={item} />
              {item.corpo ? <p>{item.corpo}</p> : null}
              <div className="atend-msg-meta">
                {propria ? (
                  <button
                    type="button"
                    className="atend-msg-apagar"
                    aria-label="Apagar mensagem"
                    onClick={() => {
                      setErroApagar('')
                      setApagarItem(item)
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
                <time dateTime={item.created_at}>{formatarHoraMensagem(item.created_at)}</time>
              </div>
            </li>
          )
        })}
        <li ref={fimRef} className="atend-msgs-end" aria-hidden="true" />
      </ul>
      {apagarItem ? (
        <ConfirmApagar
          titulo="Apagar mensagem"
          texto="Apagar só esta mensagem, e só na sua tela. Quem recebeu continua vendo. As mensagens da outra pessoa não são apagadas."
          confirmLabel="Apagar mensagem"
          busy={apagando}
          onCancel={() => (apagando ? null : setApagarItem(null))}
          onConfirm={handleApagarMensagem}
        />
      ) : null}
    </>
  )
}


function useMensagens(conversaId, userId) {
  const [mensagens, setMensagens] = useState([])
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!conversaId) {
      setMensagens([])
      return
    }
    const lista = await listarMensagens(conversaId, userId)
    setMensagens(lista)
  }, [conversaId, userId])

  useEffect(() => {
    let active = true
    setErro('')
    if (!conversaId) {
      setMensagens([])
      return undefined
    }

    carregar().catch((error) => {
      if (active) setErro(error.message || 'Não foi possível carregar as mensagens.')
    })

    const channel = supabase
      .channel(`atend-msgs-${conversaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'atendimento_mensagens',
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const nova = payload.new
          if (!nova?.id || !mensagemVisivelPara(nova, userId)) return
          setMensagens((prev) => (prev.some((item) => item.id === nova.id) ? prev : [...prev, nova]))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'atendimento_mensagens',
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const atualizada = payload.new
          if (!atualizada?.id) return
          if (!mensagemVisivelPara(atualizada, userId)) {
            setMensagens((prev) => prev.filter((item) => item.id !== atualizada.id))
            return
          }
          setMensagens((prev) => prev.map((item) => (item.id === atualizada.id ? atualizada : item)))
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversaId, userId, carregar])

  return { mensagens, setMensagens, erro, setErro, carregar }
}

function ChatCliente({ user, setor, atendenteId, onSetor, onAtendente }) {
  const [conversa, setConversa] = useState(null)
  const [conversas, setConversas] = useState([])
  const [atendentes, setAtendentes] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [confirmarId, setConfirmarId] = useState('')
  const { mensagens, setMensagens, erro: erroMsgs } = useMensagens(conversa?.id, user.id)

  const carregarConversas = useCallback(async () => {
    setConversas(await listarConversasCliente(user.id))
  }, [user.id])

  useEffect(() => {
    carregarConversas().catch(() => {})
    const channel = supabase
      .channel(`atend-fila-cliente-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendimento_conversas' },
        () => {
          carregarConversas().catch(() => {})
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [carregarConversas, user.id])

  useEffect(() => {
    if (!setor) {
      setAtendentes([])
      return undefined
    }
    let active = true
    listarAtendentes(setor, user.id)
      .then((lista) => {
        if (active) setAtendentes(lista)
      })
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível listar os atendentes.')
      })
    return () => {
      active = false
    }
  }, [setor, user.id])

  useEffect(() => {
    if (!setor || !atendenteId) {
      setConversa(null)
      setCarregando(false)
      return undefined
    }

    let active = true
    setCarregando(true)
    setErro('')
    buscarConversaCliente(user.id, setor, atendenteId)
      .then(async (atual) => {
        if (!active) return
        setConversa(atual)
        if (atual?.nao_lidas_cliente) await marcarLida(atual.id, false)
      })
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível abrir o atendimento.')
      })
      .finally(() => {
        if (active) setCarregando(false)
      })
    return () => {
      active = false
    }
  }, [user.id, setor, atendenteId])

  useEffect(() => {
    if (!conversa?.id || !mensagens.length) return undefined
    marcarLida(conversa.id, false).catch(() => {})
    return undefined
  }, [conversa?.id, mensagens.length])

  async function handleSend(corpo, arquivo) {
    if (!setor || !atendenteId) return
    setErro('')
    const atual = conversa || (await garantirConversaCliente(user.id, setor, atendenteId))
    if (!conversa) setConversa(atual)
    const anexo = arquivo ? await enviarArquivoConversa(atual.id, arquivo) : null
    const salva = await enviarMensagem({
      conversaId: atual.id,
      autorId: user.id,
      papel: 'cliente',
      corpo,
      anexo,
    })
    setMensagens((prev) => (prev.some((item) => item.id === salva.id) ? prev : [...prev, salva]))
    carregarConversas().catch(() => {})
  }

  async function handleApagar(conversaId) {
    setErro('')
    setApagando(true)
    try {
      await excluirConversa(conversaId)
      if (conversa?.id === conversaId) {
        setConversa(null)
        setMensagens([])
        onAtendente('')
      }
      setConfirmarId('')
      await carregarConversas()
    } catch (error) {
      setErro(error.message || 'Não foi possível apagar a conversa.')
    } finally {
      setApagando(false)
    }
  }

  const atendenteAtivo =
    atendentes.find((item) => item.id === atendenteId) ||
    (conversa?.atendente_id === atendenteId ? conversa.atendente : null)
  const nomePessoa = nomeAtendente(atendenteAtivo)
  const filaSetor = setor
    ? atendentes.map((pessoa) => ({
        key: pessoa.id,
        pessoa,
        conversa: conversas.find((item) => item.atendente_id === pessoa.id && item.setor === setor),
      }))
    : conversas
        .filter((item) => item.ultima_mensagem_at || item.preview)
        .map((item) => ({
          key: item.id,
          pessoa: item.atendente,
          conversa: item,
        }))

  return (
    <section className="atend-master">
      <aside className="atend-fila">
        {!setor && filaSetor.length === 0 ? (
          <p className="atend-vazio">Escolha um departamento acima para ver com quem você pode falar.</p>
        ) : filaSetor.length === 0 ? (
          <p className="atend-vazio">Nenhum atendente neste departamento no momento.</p>
        ) : (
          <ul className="atend-fila-lista">
            {filaSetor.map(({ key, pessoa, conversa: itemConversa }) => {
              const nome = nomeAtendente(pessoa)
              const ativo = atendenteId && (pessoa?.id === atendenteId || itemConversa?.atendente_id === atendenteId)
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={`atend-fila-abrir${ativo ? ' is-active' : ''}`}
                    onClick={() => {
                      if (itemConversa?.setor && itemConversa.setor !== setor) onSetor(itemConversa.setor)
                      onAtendente(pessoa?.id || itemConversa?.atendente_id)
                    }}
                  >
                    <Avatar nome={nome} />
                    <span className="atend-fila-copy">
                      <strong>
                        {nome}
                        {itemConversa?.ultima_mensagem_at ? (
                          <time>{formatarHoraMensagem(itemConversa.ultima_mensagem_at)}</time>
                        ) : null}
                      </strong>
                      <small>
                        {setor ? labelSetor(setor) : labelSetor(itemConversa?.setor)}
                        {itemConversa?.preview ? ` · ${itemConversa.preview}` : ' · Iniciar conversa'}
                      </small>
                    </span>
                    {itemConversa?.nao_lidas_cliente > 0 ? (
                      <span className="atend-unread">{itemConversa.nao_lidas_cliente}</span>
                    ) : null}
                  </button>
                  {itemConversa?.id ? (
                    <button
                      type="button"
                      className="atend-fila-apagar"
                      aria-label={`Apagar conversa com ${nome}`}
                      onClick={() => setConfirmarId(itemConversa.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <div className="atend-chat">
        {setor && atendenteId ? (
          <>
            <header className="atend-chat-head">
              <Avatar nome={nomePessoa} />
              <div>
                <h2>{nomePessoa}</h2>
                <p>{labelSetor(setor)} · Online · responda quando quiser</p>
              </div>
              {conversa?.id ? (
                <button type="button" className="atend-apagar" onClick={() => setConfirmarId(conversa.id)}>
                  Excluir conversa
                </button>
              ) : null}
            </header>
            {(erro || erroMsgs) && (
              <p className="auth-alert" role="alert">
                {erro || erroMsgs}
              </p>
            )}
            <div className="atend-chat-body">
              {carregando ? (
                <p className="atend-vazio">Carregando conversa…</p>
              ) : (
                <ChatThread
                  mensagens={mensagens}
                  setMensagens={setMensagens}
                  userId={user.id}
                  vazio={`Envie uma mensagem para ${nomePessoa}.`}
                />
              )}
            </div>
            <AtendimentoComposer
              onSend={handleSend}
              disabled={carregando}
              placeholder={`Escreva para ${nomePessoa}`}
            />
          </>
        ) : (
          <div className="atend-vazio-painel">
            <Avatar nome="Lopesul" />
            <p>
              {setor
                ? 'Escolha à esquerda a pessoa com quem deseja falar.'
                : 'Escolha um departamento acima e depois a pessoa.'}
            </p>
          </div>
        )}
      </div>
      {confirmarId ? (
        <ConfirmApagar
          nome={
            confirmarId === conversa?.id
              ? nomePessoa
              : nomeAtendente(conversas.find((item) => item.id === confirmarId)?.atendente)
          }
          busy={apagando}
          onCancel={() => (apagando ? null : setConfirmarId(''))}
          onConfirm={() => handleApagar(confirmarId)}
        />
      ) : null}
    </section>
  )
}

function perfilConversa(item) {
  const perfil = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
  return perfil || {}
}

function nomeCliente(item) {
  const perfil = perfilConversa(item)
  return perfil.nome_completo || perfil.email || 'Cliente'
}

function nomeOutro(item, userId) {
  return nomeAtendente(outroDaConversa(item, userId)) || nomeCliente(item)
}

function ChatMaster({ user, setor, onSetor }) {
  const { profile } = useAuth()
  const [conversas, setConversas] = useState([])
  const [colegas, setColegas] = useState([])
  const [clientes, setClientes] = useState([])
  const [selecionadaId, setSelecionadaId] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [apagando, setApagando] = useState(false)
  const [confirmarId, setConfirmarId] = useState('')
  const { mensagens, setMensagens, erro: erroMsgs } = useMensagens(selecionadaId, user.id)
  const selecionada = conversas.find((item) => item.id === selecionadaId) || null
  const filaClientes = ehFiltroClientes(setor)
    ? clientes.map((pessoa) => ({
        pessoa,
        conversa:
          conversas.find((item) => item.cliente_id === pessoa.id && item.atendente_id === user.id) ||
          conversas.find((item) => item.cliente_id === pessoa.id) ||
          null,
      }))
    : conversas
        .filter((item) => {
          if (setor && item.setor !== setor) return false
          return !isPerfilInterno(item.profiles)
        })
        .map((item) => ({ pessoa: item.profiles, conversa: item }))
  const filaColegas = ehFiltroClientes(setor)
    ? []
    : setor
    ? colegas.map((pessoa) => ({
        pessoa,
        conversa: conversaComPessoa(conversas, user.id, pessoa.id, setor),
      }))
    : conversas
        .filter((item) => isPerfilInterno(item.profiles) && isPerfilInterno(item.atendente))
        .map((item) => ({
          pessoa: outroDaConversa(item, user.id),
          conversa: item,
        }))

  const carregarFila = useCallback(async () => {
    const lista = await listarConversasMaster()
    setConversas(lista)
  }, [])

  useEffect(() => {
    let active = true
    setCarregando(true)
    carregarFila()
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível carregar as conversas.')
      })
      .finally(() => {
        if (active) setCarregando(false)
      })

    const channel = supabase
      .channel('atend-fila-master')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendimento_conversas' },
        () => {
          carregarFila().catch(() => {})
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [carregarFila])

  useEffect(() => {
    if (!setor || ehFiltroClientes(setor)) {
      setColegas([])
      return undefined
    }
    let active = true
    listarAtendentes(setor, user.id)
      .then((lista) => {
        if (active) setColegas(lista)
      })
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível listar a equipe.')
      })
    return () => {
      active = false
    }
  }, [setor, user.id])

  useEffect(() => {
    if (!ehFiltroClientes(setor)) {
      setClientes([])
      return undefined
    }
    let active = true
    listarClientes(user.id)
      .then((lista) => {
        if (active) setClientes(lista)
      })
      .catch((error) => {
        if (active) setErro(error.message || 'Não foi possível listar os clientes.')
      })
    return () => {
      active = false
    }
  }, [setor, user.id])

  useEffect(() => {
    if (!selecionadaId) return undefined
    const souCliente = selecionada?.cliente_id === user.id
    marcarLida(selecionadaId, !souCliente).catch(() => {})
    return undefined
  }, [selecionadaId, selecionada?.cliente_id, user.id, mensagens.length])

  async function abrirColega(pessoa) {
    if (!setor || ehFiltroClientes(setor) || !pessoa?.id) return
    setErro('')
    try {
      const atual = await garantirConversaCliente(user.id, setor, pessoa.id)
      setConversas((prev) => (prev.some((item) => item.id === atual.id) ? prev : [atual, ...prev]))
      setSelecionadaId(atual.id)
    } catch (error) {
      setErro(error.message || 'Não foi possível abrir a conversa.')
    }
  }

  async function abrirCliente(pessoa) {
    if (!pessoa?.id) return
    setErro('')
    try {
      const atual = await garantirConversaCliente(pessoa.id, setorDaConta(profile), user.id)
      setConversas((prev) => (prev.some((item) => item.id === atual.id) ? prev : [atual, ...prev]))
      setSelecionadaId(atual.id)
    } catch (error) {
      setErro(error.message || 'Não foi possível abrir a conversa.')
    }
  }

  async function handleSend(corpo, arquivo) {
    if (!selecionadaId || !selecionada) return
    setErro('')
    const anexo = arquivo ? await enviarArquivoConversa(selecionadaId, arquivo) : null
    const souCliente = selecionada.cliente_id === user.id
    const salva = await enviarMensagem({
      conversaId: selecionadaId,
      autorId: user.id,
      papel: souCliente ? 'cliente' : 'atendente',
      corpo,
      anexo,
    })
    setMensagens((prev) => (prev.some((item) => item.id === salva.id) ? prev : [...prev, salva]))
    carregarFila().catch(() => {})
  }

  async function handleApagar(conversaId) {
    setErro('')
    setApagando(true)
    try {
      await excluirConversa(conversaId)
      if (selecionadaId === conversaId) {
        setSelecionadaId('')
        setMensagens([])
      }
      setConfirmarId('')
      await carregarFila()
    } catch (error) {
      setErro(error.message || 'Não foi possível apagar a conversa.')
    } finally {
      setApagando(false)
    }
  }

  return (
    <section className="atend-master">
      <aside className="atend-fila">
        {erro && (
          <p className="auth-alert" role="alert">
            {erro}
          </p>
        )}
        {carregando && !setor ? (
          <p className="atend-vazio">Buscando fila…</p>
        ) : (
          <>
            {ehFiltroClientes(setor) ? null : <p className="atend-fila-grupo">Equipe</p>}
            {!ehFiltroClientes(setor) && filaColegas.length > 0 ? (
              <ul className="atend-fila-lista">
                {filaColegas.map(({ pessoa, conversa: itemConversa }) => {
                  const nome = nomeAtendente(pessoa)
                  const ativo = itemConversa?.id === selecionadaId
                  return (
                    <li key={pessoa?.id || itemConversa?.id}>
                      <button
                        type="button"
                        className={`atend-fila-abrir${ativo ? ' is-active' : ''}`}
                        onClick={() => (itemConversa ? setSelecionadaId(itemConversa.id) : abrirColega(pessoa))}
                      >
                        <Avatar nome={nome} />
                        <span className="atend-fila-copy">
                          <strong>
                            {nome}
                            {itemConversa?.ultima_mensagem_at ? (
                              <time>{formatarHoraMensagem(itemConversa.ultima_mensagem_at)}</time>
                            ) : null}
                          </strong>
                          <small>
                            {labelSetor(setor || itemConversa?.setor)}
                            {itemConversa?.preview ? ` · ${itemConversa.preview}` : ' · Iniciar conversa'}
                          </small>
                        </span>
                      </button>
                      {itemConversa?.id ? (
                        <button
                          type="button"
                          className="atend-fila-apagar"
                          aria-label={`Apagar conversa com ${nome}`}
                          onClick={() => setConfirmarId(itemConversa.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}
            <p className="atend-fila-grupo">Clientes</p>
            {filaClientes.length > 0 ? (
              <ul className="atend-fila-lista">
                {filaClientes.map(({ pessoa, conversa: itemConversa }) => {
                  const nome = nomeCliente({ profiles: pessoa })
                  return (
                    <li key={pessoa?.id || itemConversa?.id}>
                      <button
                        type="button"
                        className={`atend-fila-abrir${itemConversa?.id === selecionadaId ? ' is-active' : ''}`}
                        onClick={() => {
                          if (itemConversa) {
                            setSelecionadaId(itemConversa.id)
                            if (!ehFiltroClientes(setor)) onSetor?.(itemConversa.setor)
                            return
                          }
                          abrirCliente(pessoa)
                        }}
                      >
                        <Avatar nome={nome} />
                        <span className="atend-fila-copy">
                          <strong>
                            {nome}
                            {itemConversa?.ultima_mensagem_at ? (
                              <time>{formatarHoraMensagem(itemConversa.ultima_mensagem_at)}</time>
                            ) : null}
                          </strong>
                          <small>
                            {labelSetor(itemConversa?.setor || (ehFiltroClientes(setor) ? 'cliente' : setor))}
                            {itemConversa?.preview ? ` · ${itemConversa.preview}` : ' · Iniciar conversa'}
                          </small>
                        </span>
                        {itemConversa?.nao_lidas_master > 0 ? (
                          <span className="atend-unread">{itemConversa.nao_lidas_master}</span>
                        ) : null}
                      </button>
                      {itemConversa?.id ? (
                        <button
                          type="button"
                          className="atend-fila-apagar"
                          aria-label={`Apagar conversa com ${nome}`}
                          onClick={() => setConfirmarId(itemConversa.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </>
        )}
      </aside>

      <div className="atend-chat">
        {selecionada ? (
          <>
            <header className="atend-chat-head">
              <Avatar nome={nomeOutro(selecionada, user.id)} />
              <div>
                <h2>{nomeOutro(selecionada, user.id)}</h2>
                <p>
                  {labelSetor(selecionada.setor)}
                  {(() => {
                    const outro = outroDaConversa(selecionada, user.id)
                    const email = (Array.isArray(outro) ? outro[0] : outro)?.email
                    return email ? ` · ${email}` : ''
                  })()}
                </p>
              </div>
              <button type="button" className="atend-apagar" onClick={() => setConfirmarId(selecionada.id)}>
                Excluir conversa
              </button>
            </header>
            {erroMsgs && (
              <p className="auth-alert" role="alert">
                {erroMsgs}
              </p>
            )}
            <div className="atend-chat-body">
              <ChatThread
                mensagens={mensagens}
                setMensagens={setMensagens}
                userId={user.id}
                vazio={`Envie uma mensagem para ${nomeOutro(selecionada, user.id)}.`}
              />
            </div>
            <AtendimentoComposer
              onSend={handleSend}
              placeholder={`Escrever para ${nomeOutro(selecionada, user.id)}`}
            />
          </>
        ) : (
          <div className="atend-vazio-painel">
            <Avatar nome="Lopesul" />
            <p>Escolha um departamento e um colega ou cliente à esquerda.</p>
          </div>
        )}
      </div>
      {confirmarId ? (
        <ConfirmApagar
          nome={nomeOutro(conversas.find((item) => item.id === confirmarId) || selecionada || {}, user.id)}
          busy={apagando}
          onCancel={() => (apagando ? null : setConfirmarId(''))}
          onConfirm={() => handleApagar(confirmarId)}
        />
      ) : null}
    </section>
  )
}

function PainelAtendimento({ isMaster, user }) {
  const { isEquipe, profile } = useAuth()
  const isAtendente = isMaster || isEquipe
  const [setor, setSetor] = useState('')
  const [atendenteId, setAtendenteId] = useState('')
  const [naoLidas, setNaoLidas] = useState({})
  const setoresFiltro = useMemo(
    () => setoresDaConta(),
    [],
  )
  const setoresBotoes = useMemo(() => {
    const base =
      setoresFiltro == null
        ? SETORES_ATENDIMENTO
        : SETORES_ATENDIMENTO.filter((item) => setoresFiltro.includes(item.id))
    return isAtendente ? [...base, FILTRO_CLIENTES] : base
  }, [setoresFiltro, isAtendente])

  useEffect(() => {
    if (setoresFiltro?.length === 1) setSetor(setoresFiltro[0])
  }, [setoresFiltro])

  const atualizarNaoLidas = useCallback(async () => {
    if (isAtendente) {
      const lista = await listarConversasMaster()
      const mapa = {}
      for (const item of lista) {
        mapa[item.setor] = (mapa[item.setor] || 0) + (item.nao_lidas_master || 0)
        if (!isPerfilInterno(item.profiles) && item.nao_lidas_master) {
          mapa.cliente = (mapa.cliente || 0) + item.nao_lidas_master
        }
      }
      setNaoLidas(mapa)
      return
    }
    const lista = await listarConversasCliente(user.id)
    const mapa = {}
    for (const item of lista) {
      mapa[item.setor] = item.nao_lidas_cliente || 0
    }
    setNaoLidas(mapa)
  }, [isAtendente, user.id])

  useEffect(() => {
    atualizarNaoLidas().catch(() => {})
    const channel = supabase
      .channel(`atend-setores-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendimento_conversas' },
        () => {
          atualizarNaoLidas().catch(() => {})
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [atualizarNaoLidas, user.id])

  return (
    <div className="painel-section atend-page">
      <div className="atend-app">
        <BotoesSetor
          ativo={setor}
          onEscolher={(id) => {
            setAtendenteId('')
            setSetor(id)
          }}
          naoLidas={naoLidas}
          setores={setoresBotoes}
        />
        {isAtendente ? (
          <ChatMaster user={user} setor={setor} onSetor={setSetor} />
        ) : (
          <ChatCliente
            user={user}
            setor={setor}
            atendenteId={atendenteId}
            onSetor={setSetor}
            onAtendente={setAtendenteId}
          />
        )}
      </div>
    </div>
  )
}

export default PainelAtendimento
