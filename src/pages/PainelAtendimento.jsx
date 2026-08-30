import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  buscarConversaCliente,
  enviarMensagem,
  formatarHoraMensagem,
  garantirConversaCliente,
  labelSetor,
  listarConversasCliente,
  listarConversasMaster,
  listarMensagens,
  marcarLida,
  SETORES_ATENDIMENTO,
} from '../lib/atendimento'
import { enviarArquivoConversa } from '../lib/atendimentoAnexos'
import { setoresDaConta } from '../lib/tiposConta'
import { supabase } from '../lib/supabase'
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

function ChatThread({ mensagens, userId, vazio }) {
  const fimRef = useRef(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length])

  if (!mensagens.length) {
    return <p className="atend-vazio">{vazio}</p>
  }

  return (
    <ul className="atend-msgs">
      {mensagens.map((item) => {
        const propria = item.autor_id === userId
        return (
          <li key={item.id} className={propria ? 'is-own' : 'is-other'}>
            <AtendimentoMidia item={item} />
            {item.corpo ? <p>{item.corpo}</p> : null}
            <time dateTime={item.created_at}>{formatarHoraMensagem(item.created_at)}</time>
          </li>
        )
      })}
      <li ref={fimRef} className="atend-msgs-end" aria-hidden="true" />
    </ul>
  )
}


function useMensagens(conversaId) {
  const [mensagens, setMensagens] = useState([])
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!conversaId) {
      setMensagens([])
      return
    }
    const lista = await listarMensagens(conversaId)
    setMensagens(lista)
  }, [conversaId])

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
          if (!nova?.id) return
          setMensagens((prev) => (prev.some((item) => item.id === nova.id) ? prev : [...prev, nova]))
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversaId, carregar])

  return { mensagens, setMensagens, erro, setErro, carregar }
}

function ChatCliente({ user, setor, onSetor }) {
  const [conversa, setConversa] = useState(null)
  const [conversas, setConversas] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const { mensagens, setMensagens, erro: erroMsgs } = useMensagens(conversa?.id)
  const fila = conversas.filter((item) => item.ultima_mensagem_at || item.preview)

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
      setConversa(null)
      setCarregando(false)
      return undefined
    }

    let active = true
    setCarregando(true)
    setErro('')
    buscarConversaCliente(user.id, setor)
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
  }, [user.id, setor])

  useEffect(() => {
    if (!conversa?.id || !mensagens.length) return undefined
    marcarLida(conversa.id, false).catch(() => {})
    return undefined
  }, [conversa?.id, mensagens.length])

  async function handleSend(corpo, arquivo) {
    if (!setor) return
    setErro('')
    const atual = conversa || (await garantirConversaCliente(user.id, setor))
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

  return (
    <section className="atend-master">
      <aside className="atend-fila">
        {fila.length === 0 ? (
          <p className="atend-vazio">Nenhuma conversa ainda. Escolha um setor acima para começar.</p>
        ) : (
          <ul className="atend-fila-lista">
            {fila.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={setor === item.setor ? 'is-active' : ''}
                  onClick={() => onSetor(item.setor)}
                >
                  <Avatar nome={labelSetor(item.setor)} />
                  <span className="atend-fila-copy">
                    <strong>
                      {labelSetor(item.setor)}
                      <time>{formatarHoraMensagem(item.ultima_mensagem_at)}</time>
                    </strong>
                    <small>{item.preview || 'Conversa iniciada'}</small>
                  </span>
                  {item.nao_lidas_cliente > 0 ? (
                    <span className="atend-unread">{item.nao_lidas_cliente}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="atend-chat">
        {setor ? (
          <>
            <header className="atend-chat-head">
              <Avatar nome={labelSetor(setor)} />
              <div>
                <h2>{labelSetor(setor)}</h2>
                <p>Online · responda quando quiser</p>
              </div>
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
                  userId={user.id}
                  vazio={`Envie uma mensagem para o setor ${labelSetor(setor)}.`}
                />
              )}
            </div>
            <AtendimentoComposer
              onSend={handleSend}
              disabled={carregando}
              placeholder={`Escreva para ${labelSetor(setor)}`}
            />
          </>
        ) : (
          <div className="atend-vazio-painel">
            <Avatar nome="Lopesul" />
            <p>Selecione um setor à esquerda para começar.</p>
          </div>
        )}
      </div>
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

function ChatMaster({ user, setor, onSetor }) {
  const [conversas, setConversas] = useState([])
  const [selecionadaId, setSelecionadaId] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const { mensagens, setMensagens, erro: erroMsgs } = useMensagens(selecionadaId)
  const fila = setor ? conversas.filter((item) => item.setor === setor) : conversas
  const selecionada = conversas.find((item) => item.id === selecionadaId) || null

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
    if (!selecionadaId) return undefined
    marcarLida(selecionadaId, true).catch(() => {})
    return undefined
  }, [selecionadaId, mensagens.length])

  async function handleSend(corpo, arquivo) {
    if (!selecionadaId) return
    setErro('')
    const anexo = arquivo ? await enviarArquivoConversa(selecionadaId, arquivo) : null
    const salva = await enviarMensagem({
      conversaId: selecionadaId,
      autorId: user.id,
      papel: 'atendente',
      corpo,
      anexo,
    })
    setMensagens((prev) => (prev.some((item) => item.id === salva.id) ? prev : [...prev, salva]))
  }

  return (
    <section className="atend-master">
      <aside className="atend-fila">
        {erro && (
          <p className="auth-alert" role="alert">
            {erro}
          </p>
        )}
        {carregando ? (
          <p className="atend-vazio">Buscando fila…</p>
        ) : fila.length === 0 ? (
          <p className="atend-vazio">
            {setor ? `Nenhuma conversa em ${labelSetor(setor)}.` : 'Nenhuma conversa ainda.'}
          </p>
        ) : (
          <ul className="atend-fila-lista">
            {fila.map((item) => {
              const nome = nomeCliente(item)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === selecionadaId ? 'is-active' : ''}
                    onClick={() => {
                      setSelecionadaId(item.id)
                      onSetor?.(item.setor)
                    }}
                  >
                    <Avatar nome={nome} />
                    <span className="atend-fila-copy">
                      <strong>
                        {nome}
                        <time>{formatarHoraMensagem(item.ultima_mensagem_at)}</time>
                      </strong>
                      <small>
                        {labelSetor(item.setor)}
                        {item.preview ? ` · ${item.preview}` : ''}
                      </small>
                    </span>
                    {item.nao_lidas_master > 0 ? <span className="atend-unread">{item.nao_lidas_master}</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <div className="atend-chat">
        {selecionada ? (
          <>
            <header className="atend-chat-head">
              <Avatar nome={nomeCliente(selecionada)} />
              <div>
                <h2>{nomeCliente(selecionada)}</h2>
                <p>
                  {labelSetor(selecionada.setor)}
                  {perfilConversa(selecionada).email ? ` · ${perfilConversa(selecionada).email}` : ''}
                </p>
              </div>
            </header>
            {erroMsgs && (
              <p className="auth-alert" role="alert">
                {erroMsgs}
              </p>
            )}
            <div className="atend-chat-body">
              <ChatThread
                mensagens={mensagens}
                userId={user.id}
                vazio="Aguardando a primeira mensagem deste cliente."
              />
            </div>
            <AtendimentoComposer onSend={handleSend} placeholder="Responder ao cliente" />
          </>
        ) : (
          <div className="atend-vazio-painel">
            <Avatar nome="Lopesul" />
            <p>Selecione uma conversa à esquerda para responder.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function PainelAtendimento({ isMaster, user }) {
  const { isEquipe, profile } = useAuth()
  const isAtendente = isMaster || isEquipe
  const [setor, setSetor] = useState('')
  const [naoLidas, setNaoLidas] = useState({})
  const setoresFiltro = useMemo(
    () => setoresDaConta(profile?.tipo_conta, isMaster),
    [profile?.tipo_conta, isMaster],
  )
  const setoresBotoes = useMemo(
    () =>
      setoresFiltro
        ? SETORES_ATENDIMENTO.filter((item) => setoresFiltro.includes(item.id))
        : SETORES_ATENDIMENTO,
    [setoresFiltro],
  )

  useEffect(() => {
    if (setoresFiltro?.length === 1) setSetor(setoresFiltro[0])
  }, [setoresFiltro])

  const atualizarNaoLidas = useCallback(async () => {
    if (isAtendente) {
      const lista = await listarConversasMaster()
      const mapa = {}
      for (const item of lista) {
        mapa[item.setor] = (mapa[item.setor] || 0) + (item.nao_lidas_master || 0)
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
        <BotoesSetor ativo={setor} onEscolher={setSetor} naoLidas={naoLidas} setores={setoresBotoes} />
        {isAtendente ? (
          <ChatMaster user={user} setor={setor} onSetor={setSetor} />
        ) : (
          <ChatCliente user={user} setor={setor} onSetor={setSetor} />
        )}
      </div>
    </div>
  )
}

export default PainelAtendimento
